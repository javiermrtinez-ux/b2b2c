import { getDb } from '../../utils/db'
import { getGlossary } from '../../utils/glossary'

/** Histórico de un pedido: venta original (Tradedoubler), respuestas del conector de renovaciones y comisión. */
export default defineEventHandler((event) => {
  const id = String(getRouterParam(event, 'id') || '')
  if (!/^\d{1,30}$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'ID no válido' })
  const db = getDb()
  const sale = db
    .prepare(
      `SELECT s.*, a.name AS affiliate_name, a.commission_type, a.commission_value
       FROM sales s LEFT JOIN affiliates a ON a.id = s.affiliate_id WHERE s.transaction_id = ?`
    )
    .get(id) as Record<string, any> | undefined
  if (!sale) throw createError({ statusCode: 404, statusMessage: 'Venta no encontrada' })
  const extra = sale.extra ? JSON.parse(sale.extra) : {}
  const labels = new Map(getGlossary(db).map((g) => [g.key, g]))
  return {
    sale: { ...sale, extra: undefined },
    fields: Object.entries(extra).map(([key, value]) => ({ key, label: labels.get(key)?.label ?? key, group: labels.get(key)?.group ?? '', value })),
    checks: db.prepare('SELECT checked_at, status, amount, source FROM renewal_checks WHERE transaction_id = ? ORDER BY checked_at').all(id),
    commission: db.prepare('SELECT base_amount, rule_type, rule_value, amount, status, created_at FROM commissions WHERE transaction_id = ?').get(id) ?? null
  }
})
