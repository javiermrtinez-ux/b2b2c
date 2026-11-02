const DAY = 86_400_000

export function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10).replaceAll('-', '')
}

/** Trocea [from, to] en tramos de como máximo `maxDays` días (Tradedoubler admite 62). */
export function splitRange(from: Date, to: Date, maxDays = 60): Array<{ from: Date; to: Date }> {
  const out: Array<{ from: Date; to: Date }> = []
  let start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
  while (start <= end) {
    const chunkEnd = new Date(Math.min(start.getTime() + (maxDays - 1) * DAY, end.getTime()))
    out.push({ from: start, to: chunkEnd })
    start = new Date(chunkEnd.getTime() + DAY)
  }
  return out
}

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY).toISOString()
}

/**
 * Inicio del tramo a sincronizar: la primera vez, `defaultFrom`; después, `lookbackDays` antes de la
 * última sincronización (sin bajar de `defaultFrom`), para recoger cambios de estado tardíos.
 */
export function syncWindowStart(lastSyncAt: string | null | undefined, defaultFrom: Date, lookbackDays = 90): Date {
  if (!lastSyncAt) return defaultFrom
  const days = Number.isFinite(lookbackDays) && lookbackDays > 0 ? lookbackDays : 90
  const start = new Date(new Date(lastSyncAt).getTime() - days * DAY)
  return start < defaultFrom ? defaultFrom : start
}
