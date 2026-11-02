/**
 * Filtros del informe y de la lista de ventas: fechas, programa, afiliado, estado y los campos extra que el
 * glosario marque como filtrables. Todo valor va como parámetro; las claves extra solo se aceptan si están
 * en la lista permitida (y además deben ser identificadores simples), así nunca entra texto libre en el SQL.
 */
export interface Filters {
  from?: string
  to?: string
  programId?: number
  affiliateId?: number
  valid?: 0 | 1
  extra: Record<string, string>
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
const KEY = /^[A-Za-z][A-Za-z0-9]*$/

const ymd = (v: unknown) => (typeof v === 'string' && YMD.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : undefined)
const intId = (v: unknown) => {
  const n = Number(v)
  return v !== '' && v != null && Number.isInteger(n) ? n : undefined
}

/** Lee los filtros de la query (?from=&to=&programId=&affiliateId=&valid=&x.deviceClass=…). */
export function parseFilters(q: Record<string, unknown>, allowedExtra: string[]): Filters {
  const f: Filters = { from: ymd(q.from), to: ymd(q.to), programId: intId(q.programId), affiliateId: intId(q.affiliateId), extra: {} }
  if (f.from && f.to && f.from > f.to) [f.from, f.to] = [f.to, f.from]
  if (q.valid === '1' || q.valid === '0') f.valid = Number(q.valid) as 0 | 1
  for (const [k, v] of Object.entries(q)) {
    if (!k.startsWith('x.')) continue
    const key = k.slice(2)
    if (KEY.test(key) && allowedExtra.includes(key) && typeof v === 'string' && v !== '' && v.length <= 200) f.extra[key] = v
  }
  return f
}

/** Condiciones sobre la tabla sales que no son de fecha (programa, afiliado, estado y campos extra). */
export function dimensionWhere(f: Filters): { sql: string; args: Array<string | number> } {
  const parts: string[] = []
  const args: Array<string | number> = []
  if (f.programId != null) { parts.push('program_id = ?'); args.push(f.programId) }
  if (f.affiliateId != null) { parts.push('affiliate_id = ?'); args.push(f.affiliateId) }
  if (f.valid != null) { parts.push('valid = ?'); args.push(f.valid) }
  for (const [k, v] of Object.entries(f.extra)) {
    if (!KEY.test(k)) continue
    parts.push(`CAST(json_extract(extra, '$.${k}') AS TEXT) = ?`)
    args.push(v)
  }
  return { sql: parts.join(' AND '), args }
}

/** Origen de datos filtrado para usar en FROM: «sales» o una subconsulta con los filtros de dimensión. */
export function salesSource(f: Filters): { sql: string; args: Array<string | number> } {
  const w = dimensionWhere(f)
  return w.sql ? { sql: `(SELECT * FROM sales WHERE ${w.sql})`, args: w.args } : { sql: 'sales', args: [] }
}

/** Día siguiente a una fecha YYYY-MM-DD, en ISO, para usar como límite exclusivo. */
export function dayAfter(ymdStr: string): string {
  return new Date(Date.parse(`${ymdStr}T00:00:00Z`) + 86_400_000).toISOString()
}

export function hasFilters(f: Filters): boolean {
  return Boolean(f.from || f.to || f.programId != null || f.affiliateId != null || f.valid != null || Object.keys(f.extra).length)
}
