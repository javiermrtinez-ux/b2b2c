const eurFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const eurShort = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })
const intFmt = new Intl.NumberFormat('es-ES')
const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' })
const dayFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export const eur = (n: number | null | undefined) => eurFmt.format(n || 0)
export const eurCompact = (n: number | null | undefined) => eurShort.format(n || 0)
export const int = (n: number | null | undefined) => intFmt.format(n || 0)
/** «2026-03» → «mar» */
export const monthLabel = (ym: string) => monthFmt.format(new Date(`${ym}-01T00:00:00Z`)).replace('.', '')
export const dayLabel = (iso: string | null | undefined) => (iso ? dayFmt.format(new Date(iso)) : '')

export const renewalLabel: Record<string, string> = {
  pending: 'Pendiente',
  renewed: 'Renovada',
  not_renewed: 'No renovada',
  unknown: 'Sin respuesta'
}
export const renewalTone: Record<string, string> = { pending: 'info', renewed: 'ok', not_renewed: 'err', unknown: 'muted' }
export const commissionLabel: Record<string, string> = { pending: 'Pendiente', approved: 'Aprobada', paid: 'Pagada' }

/** Estado de la venta en Tradedoubler (endpoint histórico). */
export const tdStatusLabel: Record<string, string> = { pending: 'Pendiente', accepted: 'Aceptada', denied: 'Denegada' }
export const tdStatusTone: Record<string, string> = { pending: 'warn', accepted: 'ok', denied: 'err' }
export const commissionTone: Record<string, string> = { pending: 'warn', approved: 'info', paid: 'ok' }
