import { getDb } from '../../utils/db'

export default defineEventHandler(() =>
  getDb()
    .prepare(
      `SELECT c.*, a.name AS affiliate_name, s.order_number FROM commissions c
       LEFT JOIN affiliates a ON a.id = c.affiliate_id
       LEFT JOIN sales s ON s.transaction_id = c.transaction_id
       ORDER BY c.created_at DESC LIMIT 500`
    )
    .all()
)
