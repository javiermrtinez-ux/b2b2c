import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initSchema } from '../server/utils/db.ts'
import { saveTransactions } from '../server/utils/sales-store.ts'
import { TdHttpError, normalizePage, obtainToken, type TdToken, type TdTransaction } from '../server/utils/tradedoubler-core.ts'

const creds = { refreshToken: '', username: 'usuario', password: 'clave' }
const token = (n: number): TdToken => ({ access_token: `a${n}`, refresh_token: `r${n}`, expires_in: 899 })

test('primer token: grant_type=password con usuario y contraseña (no client_credentials)', async () => {
  const bodies: URLSearchParams[] = []
  const saved: string[] = []
  const t = await obtainToken(creds, undefined, async (b) => (bodies.push(b), token(1)), (rt) => saved.push(rt))
  assert.equal(t.access_token, 'a1')
  assert.equal(bodies.length, 1)
  assert.equal(bodies[0].get('grant_type'), 'password')
  assert.equal(bodies[0].get('username'), 'usuario')
  assert.deepEqual(saved, ['r1'])
})

test('con refresh token guardado se usa ese y se guarda el nuevo', async () => {
  const bodies: URLSearchParams[] = []
  const saved: string[] = []
  await obtainToken(creds, 'guardado', async (b) => (bodies.push(b), token(2)), (rt) => saved.push(rt))
  assert.equal(bodies[0].get('grant_type'), 'refresh_token')
  assert.equal(bodies[0].get('refresh_token'), 'guardado')
  assert.deepEqual(saved, ['r2'])
})

test('refresh token caducado: vuelve a entrar con usuario y contraseña', async () => {
  const grants: string[] = []
  const t = await obtainToken(
    creds,
    'caducado',
    async (b) => {
      grants.push(b.get('grant_type')!)
      if (b.get('grant_type') === 'refresh_token') throw new TdHttpError('auth', 400)
      return token(3)
    },
    () => {}
  )
  assert.deepEqual(grants, ['refresh_token', 'password'])
  assert.equal(t.access_token, 'a3')
})

test('sin refresh token ni credenciales falla con un mensaje claro', async () => {
  await assert.rejects(
    obtainToken({ refreshToken: '', username: '', password: '' }, undefined, async () => token(4), () => {}),
    /TD_USERNAME/
  )
})

test('normalizePage acepta objeto o array con un objeto', () => {
  const items = [{ transactionId: 1 }] as TdTransaction[]
  assert.deepEqual(normalizePage({ total: 1, items }), { total: 1, items })
  assert.deepEqual(normalizePage([{ total: 1, items }]), { total: 1, items })
  assert.deepEqual(normalizePage([]), { total: 0, items: [] })
})

const tx = (id: number, extra: Partial<TdTransaction> = {}): TdTransaction => ({
  transactionId: id,
  timestamp: '2026-10-01T10:00:00Z',
  programId: 7,
  programName: 'P',
  publisherOrganizationId: 50,
  publisherOrganizationName: 'Afiliado',
  rxNumber: `R${id}`,
  orderValue: 100,
  eventTypeId: 5,
  valid: true,
  ...extra
})

test('sincronizar dos veces no duplica y actualiza el estado', () => {
  const db = new DatabaseSync(':memory:')
  initSchema(db)
  const batch = [tx(1), tx(2), tx(3, { orderValue: null })]
  assert.equal(saveTransactions(db, batch, 365), 2)
  assert.equal(saveTransactions(db, [tx(1, { valid: false }), tx(2)], 365), 2)
  const rows = db.prepare('SELECT transaction_id, valid FROM sales ORDER BY transaction_id').all()
  assert.deepEqual(
    rows.map((r) => ({ ...r })),
    [
      { transaction_id: 1, valid: 0 },
      { transaction_id: 2, valid: 1 }
    ]
  )
})

test('una fecha ilegible aborta sin dejar ventas a medias', () => {
  const db = new DatabaseSync(':memory:')
  initSchema(db)
  assert.throws(() => saveTransactions(db, [tx(1), tx(2, { timestamp: 'no-es-fecha' })], 365), /transacción 2/)
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }).n, 0)
})
