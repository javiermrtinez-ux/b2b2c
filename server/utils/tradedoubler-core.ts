// Lógica pura de la API de Tradedoubler (sin dependencias), para poder probarla con node --test.

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

export interface TdPage {
  total: number
  items: TdTransaction[]
}

export interface TdToken {
  access_token: string
  refresh_token?: string
  expires_in: number
}

export interface TdAuthCreds {
  refreshToken: string
  username: string
  password: string
}

export class TdHttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Pide un token siguiendo la documentación: refresh token si lo hay (son de un solo uso y caducan);
 * si no hay o ya no vale, la primera vez se entra con usuario y contraseña (grant_type=password).
 * `save` recibe el refresh token nuevo antes de devolver nada: el anterior ya está gastado.
 */
export async function obtainToken(
  creds: TdAuthCreds,
  stored: string | undefined,
  request: (body: URLSearchParams) => Promise<TdToken>,
  save: (refreshToken: string) => void
): Promise<TdToken> {
  const refreshToken = stored || creds.refreshToken
  const canUsePassword = Boolean(creds.username && creds.password)
  let t: TdToken | undefined
  if (refreshToken) {
    try {
      t = await request(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }))
    } catch (e) {
      // Refresh token caducado o ya usado: volver a entrar con credenciales si las tenemos.
      if (!(e instanceof TdHttpError) || e.status >= 500 || !canUsePassword) throw e
    }
  }
  if (!t) {
    if (!canUsePassword) throw new Error('Tradedoubler: falta NUXT_TD_REFRESH_TOKEN o NUXT_TD_USERNAME/NUXT_TD_PASSWORD')
    t = await request(new URLSearchParams({ grant_type: 'password', username: creds.username, password: creds.password }))
  }
  if (t.refresh_token) save(t.refresh_token)
  return t
}

/** La documentación describe la respuesta como "array of" {total, items}: aceptamos ambos formatos. */
export function normalizePage(raw: unknown): TdPage {
  const page = (Array.isArray(raw) ? raw[0] : raw) as Partial<TdPage> | undefined
  const items = Array.isArray(page?.items) ? page.items : []
  return { total: Number(page?.total ?? items.length), items }
}
