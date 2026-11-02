import { getDb } from '../../utils/db'
import { dayAfter, dimensionWhere, parseFilters } from '../../utils/filters'
import { filterableKeys } from '../../utils/glossary'

/** Lista de ventas con los mismos filtros que el informe, más el estado de renovación. Solo lectura. */
export default defineEventHandler((event) => {
  const db = getDb()
  const q = getQuery(event)
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
  const offset = Math.max(Number(q.offset) || 0, 0)
  const f = parseFilters(q, filterableKeys(db))
  const dim = dimensionWhere(f)
  const parts: string[] = []
  const args: Array<string | number> = []
  if (dim.sql) { parts.push(dim.sql); args.push(...dim.args) }
  if (f.from) { parts.push('occurred_at >= ?'); args.push(`${f.from}T00:00:00.000Z`) }
  if (f.to) { parts.push('occurred_at < ?'); args.push(dayAfter(f.to)) }
  const status = typeof q.status === 'string' ? q.status : ''
  if (['pending', 'renewed', 'not_renewed', 'unknown'].includes(status)) { parts.push('renewal_status = ?'); args.push(status) }
  const where = parts.length ? `WHERE ${parts.join(' AND ')}` : ''
  const sub = `(SELECT * FROM sales ${where})`
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM ${sub}`).get(...args) as { n: number }).n
  const rows = db
    .prepare(
      `SELECT s.transaction_id, s.occurred_at, s.program_id, s.program_name, s.affiliate_id, s.order_number, s.order_value,
              s.valid, s.renewal_due_at, s.renewal_status, s.renewal_amount, s.td_status, s.td_paid, s.td_commission,
              s.extra, a.name AS affiliate_name
       FROM ${sub} s LEFT JOIN affiliates a ON a.id = s.affiliate_id
       ORDER BY s.occurred_at DESC LIMIT ? OFFSET ?`
    )
    .all(...args, limit, offset) as Array<Record<string, any>>
  return { total, items: rows.map((r) => ({ ...r, extra: r.extra ? JSON.parse(r.extra) : {} })) }
})
