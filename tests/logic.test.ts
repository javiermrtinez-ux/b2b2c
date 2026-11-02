import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCommission } from '../server/utils/commission.ts'
import { splitRange, syncWindowStart, toYmd } from '../server/utils/dates.ts'

test('comisión porcentual redondea a céntimos', () => {
  assert.equal(computeCommission({ type: 'percent', value: 12.5 }, 99.99), 12.5)
  assert.equal(computeCommission({ type: 'percent', value: 10 }, 33.33), 3.33)
})

test('comisión fija ignora la base', () => {
  assert.equal(computeCommission({ type: 'fixed', value: 5 }, 1000), 5)
})

test('regla vacía o inválida da 0', () => {
  assert.equal(computeCommission({ type: 'percent', value: 0 }, 100), 0)
  assert.equal(computeCommission({ type: 'percent', value: NaN }, 100), 0)
  assert.equal(computeCommission({ type: 'fixed', value: -3 }, 100), 0)
})

test('splitRange: tramos de máx. 60 días, sin huecos ni solapes', () => {
  const from = new Date('2025-01-01')
  const to = new Date('2025-06-30')
  const chunks = splitRange(from, to)
  assert.equal(toYmd(chunks[0].from), '20250101')
  assert.equal(toYmd(chunks.at(-1)!.to), '20250630')
  for (let i = 0; i < chunks.length; i++) {
    const days = (chunks[i].to.getTime() - chunks[i].from.getTime()) / 86_400_000 + 1
    assert.ok(days <= 60)
    if (i) assert.equal(chunks[i].from.getTime() - chunks[i - 1].to.getTime(), 86_400_000)
  }
})

test('splitRange: un solo día', () => {
  assert.equal(splitRange(new Date('2025-03-03'), new Date('2025-03-03')).length, 1)
})

test('cada sincronización vuelve a revisar 90 días para recoger cambios de estado tardíos', () => {
  const defaultFrom = new Date('2025-01-01T00:00:00Z')
  assert.equal(syncWindowStart(null, defaultFrom, 90).toISOString(), defaultFrom.toISOString())
  assert.equal(
    syncWindowStart('2026-11-02T00:00:00Z', defaultFrom, 90).toISOString(),
    '2026-08-04T00:00:00.000Z'
  )
  // Nunca antes de la fecha inicial configurada
  assert.equal(syncWindowStart('2025-02-01T00:00:00Z', defaultFrom, 90).toISOString(), defaultFrom.toISOString())
  // Valor inválido (p. ej. variable vacía) → 90 días
  assert.equal(
    syncWindowStart('2026-11-02T00:00:00Z', defaultFrom, Number('')).toISOString(),
    '2026-08-04T00:00:00.000Z'
  )
})
