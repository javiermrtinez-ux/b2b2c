import { kvGet, kvSet } from './db'
import { splitRange, toYmd } from './dates'
import {
  TdHttpError,
  normalizePage,
  obtainToken,
  parseIdList,
  parseTdJson,
  type TdToken,
  type TdTransaction
} from './tradedoubler-core'

export type { TdTransaction } from './tradedoubler-core'

const BASE = 'https://connect.tradedoubler.com'

export interface TdConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  username: string
  password: string
  sourceId: string
  programId: string
  eventTypeIds: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class TradedoublerClient {
  private accessToken = ''
  private expiresAt = 0
  // Los refresh tokens son de un solo uso: todas las renovaciones pasan por este único candado.
  private refreshing: Promise<void> | null = null
  private lastRequest = 0

  constructor(private cfg: TdConfig) {}

  private async tokenRequest(body: URLSearchParams) {
    const basic = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString('base64')
    const res = await fetch(`${BASE}/uaa/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body
    })
    if (!res.ok) throw new TdHttpError(`Tradedoubler auth falló (${res.status})`, res.status)
    return (await res.json()) as TdToken
  }

  private async refresh(): Promise<void> {
    const t = await obtainToken(
      this.cfg,
      kvGet('td_refresh_token'),
      (body) => this.tokenRequest(body),
      (rt) => kvSet('td_refresh_token', rt)
    )
    this.accessToken = t.access_token
    this.expiresAt = Date.now() + (t.expires_in - 60) * 1000
  }

  private async ensureToken(): Promise<string> {
    if (!this.accessToken || Date.now() >= this.expiresAt) {
      this.refreshing ??= this.refresh().finally(() => (this.refreshing = null))
      await this.refreshing
    }
    return this.accessToken
  }

  private async get<T>(path: string, params: Record<string, string | number>, retried = false): Promise<T> {
    // Límite de 60 peticiones por minuto: como mucho 1 por segundo.
    const wait = this.lastRequest + 1000 - Date.now()
    if (wait > 0) await sleep(wait)
    this.lastRequest = Date.now()

    const url = new URL(path, BASE)
    for (const [k, v] of Object.entries(params)) if (v !== '') url.searchParams.set(k, String(v))
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await this.ensureToken()}`, Accept: 'application/json' }
    })
    if (res.status === 429 && !retried) {
      await sleep(61_000)
      return this.get<T>(path, params, true)
    }
    if (res.status === 401 && !retried) {
      this.accessToken = ''
      return this.get<T>(path, params, true)
    }
    if (!res.ok) throw new TdHttpError(`Tradedoubler ${path} falló (${res.status})`, res.status)
    return parseTdJson(await res.text()) as T
  }

  /** Fuentes a consultar: las de NUXT_TD_SOURCE_ID o, si está vacío, todas las de la red. */
  private async sourceIds(): Promise<string[]> {
    const configured = parseIdList(this.cfg.sourceId)
    if (configured.length) return configured
    const ids: string[] = []
    for (let offset = 0; ; ) {
      const page = await this.get<{ total: number; items: Array<{ id: number }> }>('/network/sources', { limit: 100, offset })
      ids.push(...page.items.map((s) => String(s.id)))
      offset += page.items.length
      if (!page.items.length || offset >= page.total) break
    }
    return ids
  }

  /** Todas las transacciones del rango, por fuente, en tramos de 60 días y paginadas de 100 en 100. */
  async fetchTransactions(from: Date, to: Date): Promise<TdTransaction[]> {
    const out: TdTransaction[] = []
    for (const sourceId of await this.sourceIds()) {
      for (const chunk of splitRange(from, to)) out.push(...(await this.fetchChunk(sourceId, chunk.from, chunk.to)))
    }
    return out
  }

  private async fetchChunk(sourceId: string, from: Date, to: Date): Promise<TdTransaction[]> {
    const out: TdTransaction[] = []
    let offset = 0
    for (;;) {
      const page = normalizePage(
        await this.get<unknown>('/network/transactions/latest', {
          sourceId,
          fromDate: toYmd(from),
          toDate: toYmd(to),
          programId: this.cfg.programId,
          eventTypeIds: this.cfg.eventTypeIds,
          // Sin esto la API omite las invalidadas y nunca veríamos una venta pasar a inválida.
          includeInvalidTransactions: 'true',
          limit: 100,
          offset,
          sortBy: 'transactionId',
          sortOrder: 'asc'
        })
      )
      out.push(...page.items)
      offset += page.items.length
      if (!page.items.length || offset >= page.total) break
    }
    return out
  }
}
