<script setup lang="ts">
import type { Report } from '~/server/utils/report'
import { eur, int } from '~/utils/format'

type Tab = 'dashboard' | 'sales' | 'affiliates' | 'commissions' | 'glossary' | 'settings'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'dashboard', label: 'Tablero' },
  { key: 'sales', label: 'Ventas' },
  { key: 'affiliates', label: 'Afiliados' },
  { key: 'commissions', label: 'Comisiones' },
  { key: 'glossary', label: 'Glosario' },
  { key: 'settings', label: 'Ajustes' }
]
const TITLES: Record<Tab, string> = { dashboard: 'Tablero', sales: 'Ventas', affiliates: 'Afiliados', commissions: 'Comisiones', glossary: 'Glosario', settings: 'Ajustes' }

const tab = ref<Tab>('dashboard')
const period = ref('12m')
const busy = ref(false)
const message = ref('')

const { data: summary, refresh: refreshSummary } = useApi<any>('/api/summary')
const { query: filterQuery } = useFilters()
const { data: report, refresh: refreshReport, error: reportError } = useApi<Report>(() => `/api/report?period=${period.value}${filterQuery.value}`, [period, filterQuery])
const refreshAll = () => Promise.all([refreshSummary(), refreshReport()])
// Las vistas de tabla se vuelven a montar tras sincronizar para leer datos frescos.
const viewKey = ref(0)

function go(t: string) {
  tab.value = t as Tab
}

async function sync() {
  busy.value = true
  message.value = ''
  try {
    const r = await apiCall('/api/sync', 'POST')
    message.value = `Sincronizado (${r.sales.mode}): ${r.sales.imported} ventas, ${r.renewals.renewed} renovadas, ${r.renewals.commissions} comisiones nuevas.`
      + ('error' in r.sales.history ? ` No se pudo leer el histórico de Tradedoubler (${r.sales.history.error}); se reintenta en la próxima sincronización.` : '')
    await refreshAll()
    viewKey.value++
  } catch (e: any) {
    message.value = `No se pudo sincronizar: ${e?.data?.statusMessage || e?.message}. Revisa el token y las credenciales de Tradedoubler.`
  } finally {
    busy.value = false
  }
}

// Tema: claro, oscuro o el del sistema. Se recuerda en este navegador.
const theme = ref<'system' | 'light' | 'dark'>('system')
const systemDark = ref(false)
onMounted(() => {
  try { theme.value = (localStorage.getItem('theme') as any) || 'system' } catch {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = mq.matches
  mq.addEventListener('change', (e) => { systemDark.value = e.matches })
})
watch(theme, (v) => { try { localStorage.setItem('theme', v) } catch {} })
const resolvedTheme = computed(() => (theme.value === 'system' ? (systemDark.value ? 'dark' : 'light') : theme.value))
function cycleTheme() {
  theme.value = theme.value === 'system' ? 'light' : theme.value === 'light' ? 'dark' : 'system'
}
const themeLabel = computed(() => ({ system: 'Tema: sistema', light: 'Tema: claro', dark: 'Tema: oscuro' })[theme.value])

useHead({
  title: computed(() => `${TITLES[tab.value]} · Seguimiento de ventas`),
  htmlAttrs: { lang: 'es', 'data-theme': resolvedTheme, 'data-theme-preference': theme },
  link: [{ rel: 'preload', href: '/fonts/inter-latin.woff2', as: 'font', type: 'font/woff2', crossorigin: '' }]
})

const unauthorized = computed(() => (reportError.value as any)?.statusCode === 401)
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
})
const attention = computed(() => {
  const r = report.value
  if (!r) return ''
  const parts = [`${int(r.upcoming.in30)} ${r.upcoming.in30 === 1 ? 'renovación vence' : 'renovaciones vencen'} en los próximos 30 días`]
  if (r.kpis.pendingCommissions.count) parts.push(`${eur(r.kpis.pendingCommissions.value)} en comisiones pendientes`)
  return parts.join(' y ') + '.'
})
const trendCounts = computed(() => report.value?.monthly.map((m) => m.valid) ?? [])
const trendWeekly = computed(() => report.value?.weekly.map((w) => w.count) ?? [])
const trendHealth = computed(() => report.value?.renewalHealth.map((m) => m.rate ?? 0) ?? [])
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="logo">
        <span class="logo-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 19V9l7-4 7 4v10h-5v-6h-4v6z" fill="currentColor" /></svg></span>
        <span>Seguimiento</span>
      </div>
      <nav class="tabs" aria-label="Secciones">
        <button v-for="t in TABS" :key="t.key" type="button" :class="{ on: tab === t.key }" :aria-current="tab === t.key ? 'page' : undefined" @click="go(t.key)">{{ t.label }}</button>
      </nav>
      <div class="top-icons">
        <button class="round-btn" type="button" :disabled="busy" :aria-label="busy ? 'Sincronizando' : 'Sincronizar con Tradedoubler'" :title="busy ? 'Sincronizando…' : 'Sincronizar con Tradedoubler'" @click="sync">
          <svg :class="{ spin: busy }" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
        </button>
        <button class="round-btn" type="button" :aria-label="themeLabel" :title="themeLabel" @click="cycleTheme">
          <svg v-if="theme === 'dark'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          <svg v-else-if="theme === 'light'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
        </button>
        <button class="round-btn" type="button" aria-label="Ajustes y token" title="Ajustes y token" @click="go('settings')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
        </button>
      </div>
    </header>

    <main class="main">
      <div v-if="tab === 'dashboard'" class="hello">
        <div class="hello-text">
          <h1>{{ greeting }}</h1>
          <p v-if="attention">{{ attention }}</p>
        </div>
        <div v-if="report" class="chips">
          <PanelKpiChip :value="int(report.kpis.sales.value)" label="Ventas válidas" :delta="report.kpis.sales.delta" :trend="trendCounts" />
          <PanelKpiChip :value="int(report.kpis.pendingRenewals.value)" label="Renovaciones pendientes" :trend="trendWeekly" />
          <PanelKpiChip
            :value="report.kpis.renewalRate.value == null ? '—' : `${Math.round(report.kpis.renewalRate.value)} %`"
            label="Tasa de renovación"
            :trend="trendHealth"
          />
        </div>
      </div>
      <h1 v-else class="page-title">{{ TITLES[tab] }}</h1>

      <p v-if="message" class="notice" role="status">{{ message }}</p>
      <p v-if="unauthorized" class="notice notice-err" role="alert">
        El token no es válido o falta. Escríbelo en <button class="link" type="button" @click="go('settings')">Ajustes</button>.
      </p>

      <ViewDashboard v-if="tab === 'dashboard'" v-model:period="period" :report="report" @go="go" />
      <ViewSales v-else-if="tab === 'sales'" :key="`s${viewKey}`" />
      <ViewAffiliates v-else-if="tab === 'affiliates'" :key="`a${viewKey}`" @message="message = $event" @changed="refreshAll" />
      <ViewCommissions v-else-if="tab === 'commissions'" :key="`c${viewKey}`" />
      <ViewGlossary v-else-if="tab === 'glossary'" @message="message = $event" />
      <ViewSettings v-else :last-sync-at="summary?.lastSyncAt" :busy="busy" @sync="sync" />
    </main>
  </div>
</template>
