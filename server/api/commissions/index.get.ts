import { getDb } from '../../utils/db'

/**
 * Comisiones, solo lectura:
 *  ?source=renewal (por defecto): las que calcula el panel al confirmarse una renovación, con la regla del afiliado.
 *  ?source=td: la comisión de la venta original según Tradedoubler (histórico de transacciones).
 */
export default defineEventHandler((event) => {
  const db = getDb()
  if (getQuery(event).source === 'td') {
    return db
      .prepare(
        `SELECT s.transaction_id, s.occurred_at, s.order_number, s.order_value, s.program_name, s.affiliate_id,
                s.td_status, s.td_paid, s.td_commission, s.td_total_commission, a.name AS affiliate_name
         FROM sales s LEFT JOIN affiliates a ON a.id = s.affiliate_id
         WHERE s.td_commission IS NOT NULL ORDER BY s.occurred_at DESC LIMIT 500`
      )
      .all()
  }
  return db
    .prepare(
      `SELECT c.*, a.name AS affiliate_name, s.order_number FROM commissions c
       LEFT JOIN affiliates a ON a.id = c.affiliate_id
       LEFT JOIN sales s ON s.transaction_id = c.transaction_id
       ORDER BY c.created_at DESC LIMIT 500`
    )
    .all()
})
