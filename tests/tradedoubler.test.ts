import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initSchema } from '../server/utils/db.ts'
import { saveTransactions } from '../server/utils/sales-store.ts'
import {
  TdHttpError,
  normalizePage,
  obtainToken,
  parseIdList,
  parseTdJson,
  type TdToken,
  type TdTransaction
} from '../server/utils/tradedoubler-core.ts'

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
  const items = [{ transactionId: '1' }] as TdTransaction[]
  assert.deepEqual(normalizePage({ total: 1, items }), { total: 1, items })
  assert.deepEqual(normalizePage([{ total: 1, items }]), { total: 1, items })
  assert.deepEqual(normalizePage([]), { total: 0, items: [] })
})

const tx = (id: string, extra: Partial<TdTransaction> = {}): TdTransaction => ({
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
  const batch = [tx('1'), tx('2'), tx('3', { orderValue: null })]
  assert.equal(saveTransactions(db, batch, 365), 2)
  assert.equal(saveTransactions(db, [tx('1', { valid: false }), tx('2')], 365), 2)
  const rows = db.prepare('SELECT transaction_id, valid FROM sales ORDER BY transaction_id').all()
  assert.deepEqual(
    rows.map((r) => ({ ...r })),
    [
      { transaction_id: '1', valid: 0 },
      { transaction_id: '2', valid: 1 }
    ]
  )
})

test('IDs reales de 64 bits: no se redondean ni se mezclan', () => {
  // Dos IDs que como Number serían el mismo (6312377666274735000).
  const raw = '{"total":2,"items":[{"transactionId":6312377666274734981},{"transactionId":6312377666274735012}]}'
  const page = normalizePage(parseTdJson(raw))
  assert.deepEqual(
    page.items.map((i) => i.transactionId),
    ['6312377666274734981', '6312377666274735012']
  )
  const db = new DatabaseSync(':memory:')
  initSchema(db)
  saveTransactions(db, page.items.map((i) => tx(i.transactionId)), 365)
  saveTransactions(db, page.items.map((i) => tx(i.transactionId)), 365)
  const ids = db.prepare('SELECT transaction_id FROM sales ORDER BY transaction_id').all().map((r) => r.transaction_id)
  assert.deepEqual(ids, ['6312377666274734981', '6312377666274735012'])
})

test('fecha de Tradedoubler con zona +0200', () => {
  const db = new DatabaseSync(':memory:')
  initSchema(db)
  saveTransactions(db, [tx('1', { timestamp: '2026-10-09T14:43:32.000+0200' })], 365)
  assert.equal((db.prepare('SELECT occurred_at FROM sales').get() as { occurred_at: string }).occurred_at, '2026-10-09T12:43:32.000Z')
})

test('parseIdList: fuentes separadas por comas', () => {
  assert.deepEqual(parseIdList(' 3473966, 3483152 ,'), ['3473966', '3483152'])
  assert.deepEqual(parseIdList(3473966), ['3473966'])
  assert.deepEqual(parseIdList(''), [])
})

test('migra bases antiguas con transaction_id INTEGER conservando ventas y comisiones', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE sales (transaction_id INTEGER PRIMARY KEY, occurred_at TEXT NOT NULL, program_id INTEGER, program_name TEXT,
      affiliate_id INTEGER NOT NULL, order_number TEXT, order_value REAL, valid INTEGER NOT NULL DEFAULT 1, renewal_due_at TEXT NOT NULL,
      renewal_status TEXT NOT NULL DEFAULT 'pending', renewal_amount REAL, renewal_checked_at TEXT);
    CREATE TABLE commissions (id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id INTEGER NOT NULL UNIQUE REFERENCES sales (transaction_id),
      affiliate_id INTEGER NOT NULL, base_amount REAL NOT NULL, rule_type TEXT NOT NULL, rule_value REAL NOT NULL, amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL);
    INSERT INTO sales (transaction_id, occurred_at, affiliate_id, renewal_due_at, renewal_status) VALUES (900001, 'a', 1, 'b', 'renewed');
    INSERT INTO commissions (transaction_id, affiliate_id, base_amount, rule_type, rule_value, amount, created_at) VALUES (900001, 1, 10, 'fixed', 2, 2, 'c');
  `)
  initSchema(db)
  initSchema(db) // idempotente
  assert.deepEqual({ ...db.prepare('SELECT transaction_id, renewal_status FROM sales').get() }, { transaction_id: '900001', renewal_status: 'renewed' })
  assert.deepEqual({ ...db.prepare('SELECT transaction_id, amount FROM commissions').get() }, { transaction_id: '900001', amount: 2 })
  const t = db.prepare("SELECT type FROM pragma_table_info('sales') WHERE name = 'transaction_id'").get() as { type: string }
  assert.equal(t.type, 'TEXT')
})

test('una fecha ilegible aborta sin dejar ventas a medias', () => {
  const db = new DatabaseSync(':memory:')
  initSchema(db)
  assert.throws(() => saveTransactions(db, [tx('1'), tx('2', { timestamp: 'no-es-fecha' })], 365), /transacción 2/)
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }).n, 0)
})
