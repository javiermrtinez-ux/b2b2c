import { getDb } from '../../utils/db'

/**
 * Afiliados: ID y nombre (Tradedoubler), programas en los que tienen ventas (ID y nombre), sus webs con URL
 * (endpoint de fuentes), ventas, comisiones y la regla con la que se calcula la comisión por renovación.
 */
export default defineEventHandler(() => {
  const db = getDb()
  const affiliates = db
    .prepare(
      `SELECT a.id, a.name, a.commission_type, a.commission_value,
        (SELECT COUNT(*) FROM sales s WHERE s.affiliate_id = a.id AND s.valid = 1) AS sales,
        (SELECT COALESCE(SUM(amount),0) FROM commissions c WHERE c.affiliate_id = a.id) AS commissions,
        (SELECT COALESCE(SUM(td_commission),0) FROM sales s WHERE s.affiliate_id = a.id AND COALESCE(s.td_status, '') != 'denied') AS td_commissions
       FROM affiliates a ORDER BY a.name, a.id`
    )
    .all() as Array<Record<string, any>>
  const programs = db
    .prepare(
      `SELECT affiliate_id, program_id AS id, COALESCE(MAX(program_name), 'Programa ' || program_id) AS name, COUNT(*) AS count
       FROM sales WHERE program_id IS NOT NULL GROUP BY affiliate_id, program_id ORDER BY count DESC`
    )
    .all() as Array<{ affiliate_id: number; id: number; name: string; count: number }>
  // Webs: las del afiliado según /network/sources y, si falta ese dato, las que aparecen en sus ventas.
  const sources = db
    .prepare(
      `SELECT id, name, url, publisher_org_id AS affiliate_id FROM sources WHERE publisher_org_id IS NOT NULL
       UNION
       SELECT DISTINCT CAST(json_extract(s.extra, '$.sourceId') AS INTEGER), json_extract(s.extra, '$.sourceName'), src.url, s.affiliate_id
       FROM sales s LEFT JOIN sources src ON src.id = json_extract(s.extra, '$.sourceId')
       WHERE json_extract(s.extra, '$.sourceId') IS NOT NULL AND src.id IS NULL`
    )
    .all() as Array<{ id: number; name: string | null; url: string | null; affiliate_id: number }>
  return affiliates.map((a) => ({
    ...a,
    programs: programs.filter((p) => p.affiliate_id === a.id).map(({ id, name, count }) => ({ id, name, count })),
    sources: sources.filter((s) => s.affiliate_id === a.id).map(({ id, name, url }) => ({ id, name, url }))
  }))
})
