import { getDb, kvGet, kvSet } from './db'
import { computeCommission, type CommissionType } from './commission'
import { getPartner } from './partner'
import { saveTransactions } from './sales-store'
import { TradedoublerClient, type TdTransaction } from './tradedoubler'

type Config = ReturnType<typeof useRuntimeConfig>

/** Ventas de ejemplo para desarrollar sin credenciales (TD_CLIENT_ID vacío). */
function sampleTransactions(from: Date): TdTransaction[] {
  const names = ['Afiliado Norte', 'Afiliado Sur', 'Afiliado Este']
  return Array.from({ length: 30 }, (_, i) => ({
    transactionId: String(900000 + i),
    timestamp: new Date(from.getTime() + i * 86_400_000 * 3).toISOString(),
    programId: 1,
    programName: 'Programa demo',
    publisherOrganizationId: 1000 + (i % 3),
    publisherOrganizationName: names[i % 3],
    rxNumber: `DEMO-${i}`,
    orderValue: 40 + (i % 5) * 10,
    eventTypeId: 5,
    valid: true
  }))
}

export async function syncSales(config: Config) {
  const db = getDb()
  const useReal = Boolean(config.td.clientId)
  const defaultFrom = new Date(config.td.syncFrom)
  // Solapamos 7 días con la última sincronización para recoger cambios de estado (válida/inválida).
  const last = kvGet('last_sync_at')
  const from = last ? new Date(new Date(last).getTime() - 7 * 86_400_000) : defaultFrom
  const now = new Date()

  const txs = useReal
    ? await new TradedoublerClient(config.td).fetchTransactions(from, now)
    : sampleTransactions(defaultFrom)

  const imported = saveTransactions(db, txs, config.renewalDays)
  kvSet('last_sync_at', now.toISOString())
  return { imported, mode: useReal ? 'tradedoubler' : 'demo' }
}

/** Crea las comisiones de ventas ya renovadas que no la tienen (p. ej. tras configurar la regla del afiliado). */
export function backfillCommissions(affiliateId: number): number {
  const db = getDb()
  const rule = db.prepare('SELECT commission_type, commission_value FROM affiliates WHERE id = ?').get(affiliateId) as
    | { commission_type: CommissionType; commission_value: number }
    | undefined
  if (!rule) return 0
  const rows = db
    .prepare(
      `SELECT s.transaction_id, COALESCE(s.renewal_amount, s.order_value, 0) AS base FROM sales s
       LEFT JOIN commissions c ON c.transaction_id = s.transaction_id
       WHERE s.affiliate_id = ? AND s.renewal_status = 'renewed' AND c.id IS NULL`
    )
    .all(affiliateId) as Array<{ transaction_id: string; base: number }>
  const insert = db.prepare(`
    INSERT OR IGNORE INTO commissions (transaction_id, affiliate_id, base_amount, rule_type, rule_value, amount, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  let n = 0
  for (const r of rows) {
    const amount = computeCommission({ type: rule.commission_type, value: rule.commission_value }, r.base)
    if (amount > 0) {
      insert.run(r.transaction_id, affiliateId, r.base, rule.commission_type, rule.commission_value, amount, new Date().toISOString())
      n++
    }
  }
  return n
}

/** Pregunta al partner por las ventas cuyo plazo de renovación ya venció y crea las comisiones. */
export async function processRenewals(config: Config) {
  const db = getDb()
  const partner = getPartner(config.partner.mode)
  const due = db
    .prepare(
      `SELECT transaction_id, order_number, affiliate_id, order_value FROM sales
       WHERE valid = 1 AND renewal_status IN ('pending','unknown') AND renewal_due_at <= ?`
    )
    .all(new Date().toISOString()) as Array<{
    transaction_id: string
    order_number: string | null
    affiliate_id: number
    order_value: number | null
  }>

  const setStatus = db.prepare(
    'UPDATE sales SET renewal_status = ?, renewal_amount = ?, renewal_checked_at = ? WHERE transaction_id = ?'
  )
  const getRule = db.prepare('SELECT commission_type, commission_value FROM affiliates WHERE id = ?')
  const insertCommission = db.prepare(`
    INSERT OR IGNORE INTO commissions (transaction_id, affiliate_id, base_amount, rule_type, rule_value, amount, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const result = { checked: 0, renewed: 0, notRenewed: 0, unknown: 0, commissions: 0 }
  for (const s of due) {
    const check = await partner.checkRenewal({
      transactionId: s.transaction_id,
      orderNumber: s.order_number,
      affiliateId: s.affiliate_id,
      orderValue: s.order_value
    })
    result.checked++
    const nowIso = new Date().toISOString()
    setStatus.run(check.status, check.amount ?? null, nowIso, s.transaction_id)
    if (check.status === 'unknown') result.unknown++
    else if (check.status === 'not_renewed') result.notRenewed++
    else {
      result.renewed++
      const rule = getRule.get(s.affiliate_id) as { commission_type: CommissionType; commission_value: number }
      const base = check.amount ?? s.order_value ?? 0
      const amount = computeCommission({ type: rule.commission_type, value: rule.commission_value }, base)
      // Con regla a 0 no se crea comisión: el afiliado aún no está configurado y se recalcula al configurarlo.
      if (amount > 0) {
        insertCommission.run(s.transaction_id, s.affiliate_id, base, rule.commission_type, rule.commission_value, amount, nowIso)
        result.commissions++
      }
    }
  }
  return result
}
