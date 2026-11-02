import { getDb } from '../../utils/db'

export default defineEventHandler(() =>
  getDb()
    .prepare(
      `SELECT a.id, a.name, a.commission_type, a.commission_value,
        (SELECT COUNT(*) FROM sales s WHERE s.affiliate_id = a.id AND s.valid = 1) AS sales,
        (SELECT COALESCE(SUM(amount),0) FROM commissions c WHERE c.affiliate_id = a.id) AS commissions
       FROM affiliates a ORDER BY a.name, a.id`
    )
    .all()
)
