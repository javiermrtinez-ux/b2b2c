import { getDb } from '../utils/db'

export default defineEventHandler(() => {
  const db = getDb()
  const one = (sql: string) => db.prepare(sql).get() as Record<string, number>
  return {
    sales: one(`SELECT COUNT(*) AS total, COALESCE(SUM(order_value),0) AS value FROM sales WHERE valid = 1`),
    renewals: one(`SELECT
      SUM(renewal_status = 'pending') AS pending,
      SUM(renewal_status = 'renewed') AS renewed,
      SUM(renewal_status = 'not_renewed') AS not_renewed,
      SUM(renewal_status = 'unknown') AS unknown FROM sales WHERE valid = 1`),
    commissions: one(`SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS amount FROM commissions`),
    lastSyncAt: (db.prepare(`SELECT value FROM kv WHERE key = 'last_sync_at'`).get() as { value: string } | undefined)?.value ?? null
  }
})
