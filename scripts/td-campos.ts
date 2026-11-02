/**
 * Prueba de la API de Tradedoubler: lista QUÉ CAMPOS devuelve cada endpoint, sin mostrar ningún valor.
 *
 *   node --experimental-strip-types scripts/td-campos.ts
 *
 * Usa las credenciales de .env (NUXT_TD_*) y el refresh token guardado en la base de datos, y guarda en ella
 * el nuevo (son de un solo uso), igual que la sincronización. Solo hace peticiones GET de lectura.
 */
import { existsSync } from 'node:fs'
import { kvGet, kvSet } from '../server/utils/db.ts'
import { TdHttpError, normalizePage, obtainToken, parseIdList, parseTdJson, type TdToken } from '../server/utils/tradedoubler-core.ts'
import { toYmd } from '../server/utils/dates.ts'

const BASE = 'https://connect.tradedoubler.com'

if (existsSync('.env')) process.loadEnvFile('.env')
const env = (k: string) => process.env[k] ?? ''
const cfg = {
  clientId: env('NUXT_TD_CLIENT_ID'),
  clientSecret: env('NUXT_TD_CLIENT_SECRET'),
  refreshToken: env('NUXT_TD_REFRESH_TOKEN'),
  username: env('NUXT_TD_USERNAME'),
  password: env('NUXT_TD_PASSWORD'),
  sourceId: env('NUXT_TD_SOURCE_ID'),
  programId: env('NUXT_TD_PROGRAM_ID'),
  eventTypeIds: env('NUXT_TD_EVENT_TYPE_IDS')
}
if (!cfg.clientId) {
  console.error('Falta NUXT_TD_CLIENT_ID en .env: ejecuta el script desde la carpeta del proyecto.')
  process.exit(1)
}

// Cliente mínimo con las mismas reglas que la sincronización: refresh token de un solo uso guardado en la base,
// y como mucho una petición por segundo.
let accessToken = ''
let last = 0
async function token(): Promise<string> {
  if (accessToken) return accessToken
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const t = await obtainToken(
    cfg,
    kvGet('td_refresh_token'),
    async (body) => {
      const res = await fetch(`${BASE}/uaa/oauth/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body
      })
      if (!res.ok) throw new TdHttpError(`Tradedoubler auth falló (${res.status})`, res.status)
      return (await res.json()) as TdToken
    },
    (rt) => kvSet('td_refresh_token', rt)
  )
  accessToken = t.access_token
  return accessToken
}
async function get(path: string, params: Record<string, string | number>): Promise<unknown> {
  const wait = last + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  const url = new URL(path, BASE)
  for (const [k, v] of Object.entries(params)) if (v !== '') url.searchParams.set(k, String(v))
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' } })
  if (!res.ok) throw new TdHttpError(`${path} (${res.status})`, res.status)
  return parseTdJson(await res.text())
}
async function sourceIds(): Promise<string[]> {
  const configured = parseIdList(cfg.sourceId)
  if (configured.length) return configured
  const page = normalizePage(await get('/network/sources', { limit: 100 }))
  return page.items.map((s: any) => String(s.id))
}

/** Recorre la respuesta y anota cada ruta de campo con su tipo (y en cuántos elementos viene con valor). */
function shape(value: unknown, path = '', out = new Map<string, { types: Set<string>; filled: number }>()) {
  const note = (t: string, filled: boolean) => {
    const e = out.get(path) ?? { types: new Set<string>(), filled: 0 }
    e.types.add(t)
    if (filled) e.filled++
    out.set(path, e)
  }
  if (Array.isArray(value)) {
    if (path) note('lista', value.length > 0)
    for (const v of value.slice(0, 50)) shape(v, path ? `${path}[]` : '[]', out)
  } else if (value && typeof value === 'object') {
    if (path) note('objeto', true)
    for (const [k, v] of Object.entries(value)) shape(v, path ? `${path}.${k}` : k, out)
  } else {
    note(value === null ? 'null' : typeof value, value !== null && value !== '')
  }
  return out
}

function print(title: string, data: unknown) {
  const items = (data as any)?.items ?? (Array.isArray(data) ? (data as any)[0]?.items ?? data : undefined)
  const n = Array.isArray(items) ? items.length : undefined
  console.log(`\n=== ${title}${n !== undefined ? ` (${n} elementos de muestra)` : ''}`)
  for (const [k, v] of shape(data)) console.log(`  ${k.padEnd(48)} ${[...v.types].join('|').padEnd(16)} con valor: ${v.filled}`)
}

const to = new Date()
const from = new Date(to.getTime() - 30 * 86_400_000)
const range = { fromDate: toYmd(from), toDate: toYmd(to) }

let sourceId = ''
try {
  const ids = await sourceIds()
  sourceId = ids[0] ?? ''
  console.log(`Fuentes disponibles: ${ids.length}`)
} catch (e) {
  console.log(`No se pudieron leer las fuentes: ${(e as Error).message}`)
}

// Endpoints a probar. Los de /network son los que usa la sincronización; el resto, por si la cuenta tiene acceso.
const probes: Array<[string, string, Record<string, string | number>]> = [
  ['Transacciones (las que usamos)', '/network/transactions/latest', { sourceId, ...range, includeInvalidTransactions: 'true', limit: 20 }],
  ['Transacciones (histórico)', '/network/transactions', { sourceId, ...range, limit: 20 }],
  ['Fuentes', '/network/sources', { limit: 20 }],
  ['Programas', '/network/programs', { limit: 20 }],
  ['Estadísticas por fecha', '/network/statistics', { ...range, sourceId, limit: 20 }],
  ['Estadísticas por fecha (report)', '/network/report/statistics', { ...range, intervalType: 'day', reportType: 'date', reportCurrencyCode: 'EUR', limit: 20 }],
  ['Clics', '/network/clicks', { sourceId, ...range, limit: 20 }],
  ['Anunciante: transacciones', '/advertiser/report/transactions', { ...range, reportCurrencyCode: 'EUR', limit: 20 }],
  ['Anunciante: estadísticas', '/advertiser/report/statistics', { ...range, intervalType: 'day', reportType: 'program', reportCurrencyCode: 'EUR', limit: 20 }],
  ['Anunciante: pendientes', '/advertiser/pendingSales', { limit: 20 }],
  ['Anunciante: programas', '/advertiser/programs', { limit: 20 }],
  ['Editor: transacciones', '/publisher/report/transactions', { ...range, reportCurrencyCode: 'EUR', limit: 20 }],
  ['Editor: estadísticas', '/publisher/report/statistics', { ...range, intervalType: 'day', reportType: 'program', reportCurrencyCode: 'EUR', limit: 20 }]
]

const summary: string[] = []
for (const [title, path, params] of probes) {
  try {
    const data = await get(path, params)
    print(`${title} · GET ${path}`, data)
    summary.push(`OK   ${path}`)
  } catch (e) {
    const status = e instanceof TdHttpError ? e.status : '—'
    summary.push(`${String(status).padEnd(4)} ${path}  ${(e as Error).message}`)
    // Sin token no tiene sentido seguir probando (y cada intento gastaría credenciales).
    if (!accessToken) break
  }
}
console.log('\n=== Resumen de endpoints (código HTTP)')
for (const s of summary) console.log(`  ${s}`)
