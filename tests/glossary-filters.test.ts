import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initSchema } from '../server/utils/db.ts'
import { applyHistory, normalizeTdStatus, saveTransactions } from '../server/utils/sales-store.ts'
import { FIELDS, extractExtra, filterableKeys, getGlossary, updateGlossary } from '../server/utils/glossary.ts'
import { dimensionWhere, parseFilters } from '../server/utils/filters.ts'
import { buildReport } from '../server/utils/report.ts'

const item = (id: string, over: Record<string, unknown> = {}) => ({
  transactionId: id,
  timestamp: '2026-10-09T10:00:00Z',
  programId: 7,
  programName: 'Kaspersky ES',
  publisherOrganizationId: 11,
  publisherOrganizationName: 'Test ORG',
  rxNumber: `R-${id}`,
  orderValue: 100,
  eventTypeId: 5,
  valid: true,
  eventName: 'Venta',
  sourceName: 'Blog',
  device: { dvClass: 'Desktop', osName: 'Windows' },
  ipAddress: '203.0.113.9',
  ipCity: 'Madrid',
  userAgent: 'Mozilla/5.0',
  referrerUrl: 'https://example.com/?email=a@b.c',
  ...over
})

function db() {
  const d = new DatabaseSync(':memory:')
  initSchema(d)
  return d
}

test('extractExtra guarda los campos permitidos y nunca los datos personales', () => {
  const extra = JSON.parse(extractExtra(item('1'))!)
  assert.equal(extra.deviceClass, 'Desktop')
  assert.equal(extra.sourceName, 'Blog')
  for (const f of FIELDS.filter((x) => x.personal)) assert.equal(extra[f.key], undefined, f.key)
  assert.ok(!JSON.stringify(extra).includes('203.0.113.9'))
  // Del histórico solo salen sus campos (la ciudad del dispositivo extendido no se guarda).
  const h = JSON.parse(extractExtra({ voucherCode: 'X', extendedDeviceInfo: { city: 'Madrid' }, ipCity: 'Madrid' }, 'history')!)
  assert.deepEqual(h, { voucherCode: 'X' })
})

test('la sincronización guarda extra y el histórico añade comisión, estado y pago de Tradedoubler', () => {
  const d = db()
  saveTransactions(d, [item('1'), item('2')] as any, 365)
  const n = applyHistory(d, [
    { transactionId: '1', status: 'A', paid: true, commission: 10, totalCommission: 13, voucherCode: 'V1', ipAddress: '1.2.3.4' },
    { transactionId: '2', status: 'P', paid: false, commission: 4 },
    { transactionId: '999', status: 'A', commission: 1 }
  ])
  assert.equal(n, 2)
  const r = d.prepare("SELECT td_status, td_paid, td_commission, td_total_commission, extra FROM sales WHERE transaction_id = '1'").get() as any
  assert.equal(r.td_status, 'accepted')
  assert.equal(r.td_paid, 1)
  assert.equal(r.td_commission, 10)
  assert.equal(r.td_total_commission, 13)
  const extra = JSON.parse(r.extra)
  assert.equal(extra.voucherCode, 'V1')
  assert.equal(extra.deviceClass, 'Desktop')
  assert.ok(!r.extra.includes('1.2.3.4'))
  // Repetir la sincronización de /latest no borra lo que trajo el histórico.
  saveTransactions(d, [item('1')] as any, 365)
  assert.equal(JSON.parse((d.prepare("SELECT extra FROM sales WHERE transaction_id = '1'").get() as any).extra).voucherCode, 'V1')
  assert.equal((d.prepare('SELECT COUNT(*) AS n FROM sales').get() as any).n, 2)
})

test('normalizeTdStatus entiende letras y palabras', () => {
  assert.equal(normalizeTdStatus('A'), 'accepted')
  assert.equal(normalizeTdStatus('Pending'), 'pending')
  assert.equal(normalizeTdStatus('D'), 'denied')
  assert.equal(normalizeTdStatus(''), null)
  assert.equal(normalizeTdStatus('x'), null)
})

test('el glosario guarda etiquetas propias, vuelve al valor original y no deja mostrar datos personales', () => {
  const d = db()
  const row = updateGlossary(d, 'deviceClass', { label: '  Dispositivo  ', visible: true, filterable: false })!
  assert.equal(row.label, 'Dispositivo')
  assert.equal(row.visible, true)
  assert.equal(row.filterable, false)
  assert.ok(!filterableKeys(d).includes('deviceClass'))
  assert.equal(updateGlossary(d, 'deviceClass', { label: 'Tipo de dispositivo' })!.label, 'Tipo de dispositivo')
  assert.equal((d.prepare("SELECT label FROM glossary WHERE key = 'deviceClass'").get() as any).label, null)
  const ip = updateGlossary(d, 'ipAddress', { visible: true })!
  assert.equal(ip.visible, false)
  assert.equal(ip.stored, false)
  assert.equal(updateGlossary(d, 'noExiste', { label: 'x' }), null)
  assert.ok(getGlossary(d).every((g) => !(g.personal && (g.visible || g.filterable))))
})

test('parseFilters solo acepta fechas válidas y claves extra permitidas', () => {
  const f = parseFilters(
    { from: '2026-10-31', to: '2026-10-01', programId: '7', affiliateId: 'abc', 'x.deviceClass': 'Desktop', "x.a') OR 1=1--": '1', 'x.ipAddress': '1' },
    ['deviceClass']
  )
  assert.equal(f.from, '2026-10-01')
  assert.equal(f.to, '2026-10-31')
  assert.equal(f.programId, 7)
  assert.equal(f.affiliateId, undefined)
  assert.deepEqual(f.extra, { deviceClass: 'Desktop' })
  assert.equal(parseFilters({ from: '2026-13-45' }, []).from, undefined)
  const w = dimensionWhere(f)
  assert.deepEqual(w.args, [7, 'Desktop'])
})

test('el informe aplica programa, afiliado, campo extra y rango de fechas', () => {
  const d = db()
  saveTransactions(
    d,
    [
      item('1'),
      item('2', { programId: 8, programName: 'Otro', orderValue: 50 }),
      item('3', { publisherOrganizationId: 12, publisherOrganizationName: 'B', device: { dvClass: 'Smartphone' }, orderValue: 30 }),
      item('4', { timestamp: '2026-08-15T10:00:00Z', orderValue: 20 })
    ] as any,
    365
  )
  applyHistory(d, [{ transactionId: '1', status: 'A', paid: true, commission: 10 }, { transactionId: '3', status: 'P', commission: 3 }])
  const now = new Date('2026-11-02T12:00:00Z')
  assert.equal(buildReport(d, '12m', now).kpis.revenue.value, 200)
  assert.equal(buildReport(d, '12m', now, { programId: 7, extra: {} }).kpis.revenue.value, 150)
  assert.equal(buildReport(d, '12m', now, { affiliateId: 12, extra: {} }).kpis.revenue.value, 30)
  assert.equal(buildReport(d, '12m', now, { extra: { deviceClass: 'Smartphone' } }).kpis.sales.value, 1)
  const oct = buildReport(d, '12m', now, { from: '2026-10-01', to: '2026-10-31', extra: {} })
  assert.equal(oct.custom, true)
  assert.equal(oct.kpis.revenue.value, 180)
  assert.deepEqual(oct.monthly.map((m) => m.month), ['2026-10'])
  assert.equal(oct.latest.length, 3)
  assert.deepEqual(oct.tdCommissions.accepted, { count: 1, amount: 10 })
  assert.deepEqual(oct.tdCommissions.pending, { count: 1, amount: 3 })
  assert.equal(oct.tdCommissions.paid, 10)
})

test('initSchema añade columnas nuevas a una base existente sin perder ventas', () => {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE sales (transaction_id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, program_id INTEGER, program_name TEXT,
    affiliate_id INTEGER NOT NULL, order_number TEXT, order_value REAL, valid INTEGER NOT NULL DEFAULT 1, renewal_due_at TEXT NOT NULL,
    renewal_status TEXT NOT NULL DEFAULT 'pending', renewal_amount REAL, renewal_checked_at TEXT);
    INSERT INTO sales (transaction_id, occurred_at, affiliate_id, renewal_due_at) VALUES ('1', '2026-01-01', 1, '2027-01-01');`)
  initSchema(d)
  initSchema(d)
  const cols = (d.prepare("SELECT name FROM pragma_table_info('sales')").all() as any[]).map((c) => c.name)
  for (const c of ['extra', 'td_status', 'td_paid', 'td_commission', 'td_total_commission']) assert.ok(cols.includes(c), c)
  assert.equal((d.prepare('SELECT COUNT(*) AS n FROM sales').get() as any).n, 1)
  assert.ok(d.prepare("SELECT 1 FROM sqlite_master WHERE name = 'renewal_checks'").get())
})
