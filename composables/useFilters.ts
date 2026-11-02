/** Filtros del informe, compartidos por Tablero y Ventas (se mantienen al cambiar de pestaña). */
export interface PanelFilters {
  from: string
  to: string
  programId: string
  affiliateId: string
  extra: Record<string, string>
}

export function useFilters() {
  const filters = useState<PanelFilters>('filters', () => ({ from: '', to: '', programId: '', affiliateId: '', extra: {} }))
  /** Parte de la query (&from=…&x.deviceClass=…) para /api/report y /api/sales. */
  const query = computed(() => {
    const p = new URLSearchParams()
    const f = filters.value
    if (f.from) p.set('from', f.from)
    if (f.to) p.set('to', f.to)
    if (f.programId) p.set('programId', f.programId)
    if (f.affiliateId) p.set('affiliateId', f.affiliateId)
    for (const [k, v] of Object.entries(f.extra)) if (v) p.set(`x.${k}`, v)
    const s = p.toString()
    return s ? `&${s}` : ''
  })
  const active = computed(() => {
    const f = filters.value
    return [f.from || f.to, f.programId, f.affiliateId, ...Object.values(f.extra)].filter(Boolean).length
  })
  const customDates = computed(() => Boolean(filters.value.from || filters.value.to))
  function reset() {
    filters.value = { from: '', to: '', programId: '', affiliateId: '', extra: {} }
  }
  return { filters, query, active, customDates, reset }
}
