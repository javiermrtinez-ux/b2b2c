import { kvGet, kvSet } from './db'
import { splitRange, toYmd } from './dates'

const BASE = 'https://connect.tradedoubler.com'

export interface TdConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  sourceId: string
  programId: string
  eventTypeIds: string
}

export interface TdTransaction {
  transactionId: number
  timestamp: string
  programId: number
  programName: string
  publisherOrganizationId: number
  publisherOrganizationName: string | null
  rxNumber: string | null
  orderValue: number | null
  eventTypeId: number
  valid: boolean
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
    if (!res.ok) throw new Error(`Tradedoubler auth falló (${res.status})`)
    return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
  }

  private async refresh(): Promise<void> {
    const stored = kvGet('td_refresh_token') || this.cfg.refreshToken
    const body = stored
      ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: stored })
      : new URLSearchParams({ grant_type: 'client_credentials' })
    const t = await this.tokenRequest(body)
    // Guardar el refresh token nuevo ANTES de usar el access token: el anterior ya está gastado.
    if (t.refresh_token) kvSet('td_refresh_token', t.refresh_token)
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
    if (!res.ok) throw new Error(`Tradedoubler ${path} falló (${res.status})`)
    return (await res.json()) as T
  }

  /** Todas las transacciones del rango, en tramos de 60 días y paginadas de 100 en 100. */
  async fetchTransactions(from: Date, to: Date): Promise<TdTransaction[]> {
    if (!this.cfg.sourceId) throw new Error('Falta TD_SOURCE_ID')
    const out: TdTransaction[] = []
    for (const chunk of splitRange(from, to)) {
      let offset = 0
      for (;;) {
        const page = await this.get<{ total: number; items: TdTransaction[] }>('/network/transactions/latest', {
          sourceId: this.cfg.sourceId,
          fromDate: toYmd(chunk.from),
          toDate: toYmd(chunk.to),
          programId: this.cfg.programId,
          eventTypeIds: this.cfg.eventTypeIds,
          limit: 100,
          offset,
          sortBy: 'transactionId',
          sortOrder: 'asc'
        })
        out.push(...page.items)
        offset += page.items.length
        if (!page.items.length || offset >= page.total) break
      }
    }
    return out
  }
}
