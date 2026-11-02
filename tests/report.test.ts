import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initSchema } from '../server/utils/db.ts'
import { buildReport, delta, monthKeys, parsePeriod, topWithOthers } from '../server/utils/report.ts'

const NOW = new Date('2026-11-15T12:00:00Z')

function seed() {
  const db = new DatabaseSync(':memory:')
  initSchema(db)
  db.exec(`INSERT INTO affiliates (id, name) VALUES (1, 'Norte'), (2, 'Sur')`)
  const sale = db.prepare(
    `INSERT INTO sales (transaction_id, occurred_at, program_id, program_name, affiliate_id, order_number, order_value, valid,
       renewal_due_at, renewal_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  // Periodo actual (3m = sep-nov 2026)
  sale.run('1', '2026-11-02T10:00:00Z', 10, 'Antivirus', 1, 'A1', 100, 1, '2026-11-25T00:00:00Z', 'pending')
  sale.run('2', '2026-10-10T10:00:00Z', 10, 'Antivirus', 2, 'A2', 50, 1, '2027-10-10T00:00:00Z', 'pending')
  sale.run('3', '2026-09-05T10:00:00Z', 20, 'VPN', 2, 'A3', 30, 0, '2027-09-05T00:00:00Z', 'pending')
  // Periodo anterior (jun-ago 2026)
  sale.run('4', '2026-07-01T10:00:00Z', 20, 'VPN', 1, 'A4', 75, 1, '2026-07-01T00:00:00Z', 'renewed')
  sale.run('5', '2025-01-01T10:00:00Z', 20, 'VPN', 1, 'A5', 10, 1, '2026-01-01T00:00:00Z', 'not_renewed')
  db.exec(`INSERT INTO commissions (transaction_id, affiliate_id, base_amount, rule_type, rule_value, amount, status, created_at)
    VALUES ('4', 1, 75, 'percent', 10, 7.5, 'pending', '2026-07-02'), ('5', 1, 10, 'fixed', 2, 2, 'paid', '2026-01-02')`)
  return db
}

test('parsePeriod admite 3m, 6m y 12m, y por defecto 12m', () => {
  assert.equal(parsePeriod('3m'), '3m')
  assert.equal(parsePeriod('x'), '12m')
  assert.equal(parsePeriod(undefined), '12m')
})

test('monthKeys: meses en orden, incluido el actual, cruzando el año', () => {
  assert.deepEqual(monthKeys(new Date('2026-02-10T00:00:00Z'), 4), ['2025-11', '2025-12', '2026-01', '2026-02'])
})

test('delta: variación en % y null sin base', () => {
  assert.equal(delta(150, 100), 50)
  assert.equal(delta(1, 3), -66.7)
  assert.equal(delta(5, 0), null)
})

test('topWithOthers agrupa el resto en «Otros»', () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ label: `P${i}`, value: 10, count: 1 }))
  const out = topWithOthers(rows, 6)
  assert.equal(out.length, 6)
  assert.deepEqual(out.at(-1), { label: 'Otros', value: 30, count: 3 })
})

test('buildReport: indicadores, evolución y desgloses del periodo', () => {
  const r = buildReport(seed(), '3m', NOW)
  assert.equal(r.kpis.sales.value, 2) // la anulada no cuenta
  assert.equal(r.kpis.revenue.value, 150)
  assert.equal(r.kpis.sales.delta, 100) // 2 frente a 1
  assert.equal(r.kpis.revenue.delta, 100) // 150 frente a 75
  assert.equal(r.kpis.pendingRenewals.value, 2)
  assert.equal(r.kpis.renewalRate.value, 50) // 1 renovada de 2 con respuesta
  assert.equal(r.kpis.pendingCommissions.value, 7.5)

  assert.deepEqual(r.monthly.map((m) => m.month), ['2026-09', '2026-10', '2026-11'])
  assert.deepEqual(r.monthly[0], { month: '2026-09', valid: 0, invalid: 1, value: 0 })
  assert.deepEqual(r.monthly[2], { month: '2026-11', valid: 1, invalid: 0, value: 100 })

  assert.deepEqual(r.byProgram, [{ label: 'Antivirus', count: 2, value: 150 }])
  assert.deepEqual(r.topAffiliates.map((a) => [a.label, a.value]), [['Norte', 100], ['Sur', 50]])

  assert.equal(r.upcoming.in30, 1)
  assert.equal(r.upcoming.in90, 1)
  assert.equal(r.upcoming.next.length, 2)
  assert.deepEqual(r.commissions.paid, { count: 1, amount: 2 })
  assert.equal(r.commissions.approved.count, 0)
  assert.equal(r.latest.length, 5)
})

test('buildReport con la base vacía no falla', () => {
  const db = new DatabaseSync(':memory:')
  initSchema(db)
  const r = buildReport(db, '12m', NOW)
  assert.equal(r.kpis.sales.value, 0)
  assert.equal(r.kpis.renewalRate.value, null)
  assert.equal(r.monthly.length, 12)
  assert.deepEqual(r.byProgram, [])
})
