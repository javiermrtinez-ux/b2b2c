import { getDb } from '../../utils/db'

/** Ficha de un afiliado: datos de Tradedoubler (webs, programas), ventas, comisiones y renovaciones. Solo lectura. */
export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'ID no válido' })
  const db = getDb()
  const affiliate = db.prepare('SELECT id, name, commission_type, commission_value FROM affiliates WHERE id = ?').get(id)
  if (!affiliate) throw createError({ statusCode: 404, statusMessage: 'Afiliado no encontrado' })

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS transactions, SUM(valid = 1) AS valid, SUM(valid = 0) AS invalid,
              COALESCE(SUM(CASE WHEN valid = 1 THEN order_value END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN valid = 0 THEN order_value END), 0) AS invalid_value,
              COUNT(DISTINCT order_number) AS orders,
              MIN(occurred_at) AS first_sale, MAX(occurred_at) AS last_sale,
              SUM(renewal_status = 'renewed') AS renewed, SUM(renewal_status = 'not_renewed') AS not_renewed,
              SUM(valid = 1 AND renewal_status = 'pending') AS pending_renewals,
              COALESCE(SUM(renewal_amount), 0) AS renewal_value
       FROM sales WHERE affiliate_id = ?`
    )
    .get(id) as Record<string, number | string | null>

  const td = db
    .prepare(
      `SELECT td_status AS status, COUNT(*) AS count, COALESCE(SUM(td_commission), 0) AS amount,
              COALESCE(SUM(CASE WHEN td_paid = 1 THEN td_commission END), 0) AS paid
       FROM sales WHERE affiliate_id = ? AND td_commission IS NOT NULL GROUP BY td_status`
    )
    .all(id)
  const renewalCommissions = db
    .prepare('SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM commissions WHERE affiliate_id = ? GROUP BY status')
    .all(id)

  const sources = db
    .prepare(
      `SELECT src.id, src.name, src.url, src.country_code AS country, src.promotion_type,
              (SELECT COUNT(*) FROM sales s WHERE s.affiliate_id = ? AND json_extract(s.extra, '$.sourceId') = src.id) AS sales
       FROM sources src WHERE src.publisher_org_id = ?
       UNION
       SELECT CAST(json_extract(s.extra, '$.sourceId') AS INTEGER), MAX(json_extract(s.extra, '$.sourceName')), NULL, NULL, NULL, COUNT(*)
       FROM sales s WHERE s.affiliate_id = ? AND json_extract(s.extra, '$.sourceId') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM sources x WHERE x.id = json_extract(s.extra, '$.sourceId'))
       GROUP BY json_extract(s.extra, '$.sourceId')`
    )
    .all(id, id, id)

  const programs = db
    .prepare(
      `SELECT s.program_id AS id, COALESCE(MAX(s.program_name), 'Programa ' || s.program_id) AS name, MAX(p.country_code) AS country,
              MAX(p.active) AS active, COUNT(*) AS sales, COALESCE(SUM(CASE WHEN s.valid = 1 THEN s.order_value END), 0) AS revenue
       FROM sales s LEFT JOIN programs p ON p.id = s.program_id
       WHERE s.affiliate_id = ? AND s.program_id IS NOT NULL GROUP BY s.program_id ORDER BY revenue DESC`
    )
    .all(id)

  // Importe válido de los últimos 12 meses, mes a mes.
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1)).toISOString().slice(0, 7))
  const monthRows = db
    .prepare(
      `SELECT substr(occurred_at, 1, 7) AS month, COALESCE(SUM(order_value), 0) AS value, COUNT(*) AS count
       FROM sales WHERE affiliate_id = ? AND valid = 1 AND occurred_at >= ? GROUP BY month`
    )
    .all(id, `${months[0]}-01`) as Array<{ month: string; value: number; count: number }>
  const monthly = months.map((m) => ({ month: m, value: monthRows.find((r) => r.month === m)?.value ?? 0, count: monthRows.find((r) => r.month === m)?.count ?? 0 }))

  // Desglose por dispositivo y país del comprador (campos extra guardados).
  const breakdown = (key: string) =>
    db
      .prepare(
        `SELECT CAST(json_extract(extra, '$.${key}') AS TEXT) AS label, COUNT(*) AS count FROM sales
         WHERE affiliate_id = ? AND valid = 1 AND json_extract(extra, '$.${key}') IS NOT NULL GROUP BY label ORDER BY count DESC LIMIT 6`
      )
      .all(id)

  const latest = db
    .prepare(
      `SELECT transaction_id, occurred_at, order_number, order_value, valid, program_name, td_status, td_commission, renewal_status
       FROM sales WHERE affiliate_id = ? ORDER BY occurred_at DESC LIMIT 10`
    )
    .all(id)

  return {
    affiliate,
    totals,
    td,
    renewalCommissions,
    sources,
    programs,
    monthly,
    devices: breakdown('deviceClass'),
    countries: breakdown('ipCountry'),
    latest
  }
})
