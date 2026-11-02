import { getDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
  const offset = Math.max(Number(q.offset) || 0, 0)
  const status = typeof q.status === 'string' ? q.status : ''
  const allowed = ['pending', 'renewed', 'not_renewed', 'unknown']
  const where = allowed.includes(status) ? 'WHERE s.renewal_status = ?' : ''
  const args = allowed.includes(status) ? [status] : []
  return getDb()
    .prepare(
      `SELECT s.*, a.name AS affiliate_name FROM sales s
       LEFT JOIN affiliates a ON a.id = s.affiliate_id ${where}
       ORDER BY s.occurred_at DESC LIMIT ? OFFSET ?`
    )
    .all(...args, limit, offset)
})
