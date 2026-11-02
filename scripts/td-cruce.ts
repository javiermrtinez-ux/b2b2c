/**
 * Diagnóstico: compara las transacciones del histórico de Tradedoubler (/network/transactions) con las ventas
 * guardadas (de /network/transactions/latest), para ver por qué campo casan. Solo GET de lectura; muestra IDs,
 * nº de pedido, fecha, importe y estado, nunca datos personales.
 *
 *   node --experimental-strip-types scripts/td-cruce.ts
 */
import { existsSync } from 'node:fs'
import { getDb, kvGet, kvSet } from '../server/utils/db.ts'
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


const db = getDb()
const sales = db
  .prepare('SELECT transaction_id, order_number, occurred_at, order_value, valid, program_id FROM sales ORDER BY occurred_at')
  .all() as Array<{ transaction_id: string; order_number: string | null; occurred_at: string; order_value: number; valid: number; program_id: number }>
if (!sales.length) {
  console.log('No hay ventas guardadas.')
  process.exit(0)
}
const from = new Date(new Date(sales[0].occurred_at).getTime() - 2 * 86_400_000)
const to = new Date(new Date(sales.at(-1)!.occurred_at).getTime() + 2 * 86_400_000)
console.log(`Ventas guardadas: ${sales.length}, del ${toYmd(from)} al ${toYmd(to)}`)

const variants: Array<[string, Record<string, string | number>]> = [
  ['tal cual (como la sincronización)', { programId: cfg.programId }],
  ['sin programId', {}],
  ['con includeInvalidTransactions', { programId: cfg.programId, includeInvalidTransactions: 'true' }]
]
const ids = await sourceIds()
for (const [title, extra] of variants) {
  const items: any[] = []
  for (const sourceId of ids) {
    const page = normalizePage(await get('/network/transactions', { sourceId, fromDate: toYmd(from), toDate: toYmd(to), limit: 100, ...extra }))
    items.push(...page.items)
  }
  console.log(`\n=== Histórico ${title}: ${items.length} transacciones`)
  for (const it of items) {
    const byId = sales.find((s) => s.transaction_id === String(it.transactionId))
    const byOrder = sales.filter((s) => s.order_number && s.order_number === String(it.orderNumber ?? ''))
    console.log(
      `  id=${it.transactionId} (${typeof it.transactionId}) pedido=${it.orderNumber} fecha=${it.timeOfTransaction ?? it.timeOfCreate} ` +
        `importe=${it.orderValue} estado=${it.status} comisión=${it.commission} · casa por id: ${byId ? 'sí' : 'no'} · ` +
        `por pedido: ${byOrder.map((s) => s.transaction_id).join(',') || 'no'}`
    )
  }
}
console.log('\n=== Ventas guardadas')
for (const s of sales) console.log(`  id=${s.transaction_id} pedido=${s.order_number} fecha=${s.occurred_at} importe=${s.order_value} válida=${s.valid}`)
