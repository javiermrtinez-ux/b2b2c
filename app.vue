<script setup lang="ts">
import type { Report } from '~/server/utils/report'
import { dayLabel } from '~/utils/format'

type Tab = 'dashboard' | 'sales' | 'affiliates' | 'commissions'

const NAV: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'dashboard', label: 'Tablero', icon: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>' },
  { key: 'sales', label: 'Ventas', icon: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>' },
  { key: 'affiliates', label: 'Afiliados', icon: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>' },
  { key: 'commissions', label: 'Comisiones', icon: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>' }
]
const TITLES: Record<Tab, string> = { dashboard: 'Tablero', sales: 'Ventas', affiliates: 'Afiliados', commissions: 'Comisiones' }
const PERIODS = [
  { key: '3m', label: '3 meses' },
  { key: '6m', label: '6 meses' },
  { key: '12m', label: '12 meses' }
]

const tab = ref<Tab>('dashboard')
const period = ref('12m')
const busy = ref(false)
const message = ref('')
const navOpen = ref(false)
const { token } = useAdminToken()

const { data: summary, refresh: refreshSummary } = useApi<any>('/api/summary')
const { data: report, refresh: refreshReport, error: reportError } = useApi<Report>(() => `/api/report?period=${period.value}`, [period])
const refreshAll = () => Promise.all([refreshSummary(), refreshReport()])
// Las vistas de tabla se vuelven a montar al cambiar de pestaña, así que leen datos frescos.
const viewKey = ref(0)

function go(t: string) {
  tab.value = t as Tab
  navOpen.value = false
}

async function sync() {
  busy.value = true
  message.value = ''
  try {
    const r = await apiCall('/api/sync', 'POST')
    message.value = `Sincronizado (${r.sales.mode}): ${r.sales.imported} ventas, ${r.renewals.renewed} renovadas, ${r.renewals.commissions} comisiones nuevas.`
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
</script>

<template>
  <div class="shell" :class="{ 'nav-open': navOpen }">
    <aside class="side">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">sv</span>
        <span class="brand-name">Seguimiento<br /><small>de ventas</small></span>
      </div>
      <nav aria-label="Secciones">
        <p class="nav-group">Menú</p>
        <button
          v-for="n in NAV"
          :key="n.key"
          type="button"
          class="nav-item"
          :class="{ on: tab === n.key }"
          :aria-current="tab === n.key ? 'page' : undefined"
          @click="go(n.key)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="n.icon" />
          {{ n.label }}
        </button>
      </nav>
      <div class="side-foot">
        <div class="sync-card">
          <p class="sync-title">Tradedoubler</p>
          <p class="sync-sub">Última sincronización<br /><b>{{ summary?.lastSyncAt ? dayLabel(summary.lastSyncAt) : 'nunca' }}</b></p>
          <button class="btn btn-primary btn-block" type="button" :disabled="busy" @click="sync">{{ busy ? 'Sincronizando…' : 'Sincronizar ahora' }}</button>
        </div>
        <label class="token">
          <span>Token de administración</span>
          <input v-model="token" class="input" type="password" autocomplete="off" placeholder="x-admin-token" />
        </label>
      </div>
    </aside>
    <button class="scrim" type="button" aria-label="Cerrar menú" @click="navOpen = false" />

    <div class="main">
      <header class="top">
        <button class="btn btn-icon menu-btn" type="button" aria-label="Abrir menú" @click="navOpen = true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div class="top-title">
          <h1>{{ TITLES[tab] }}</h1>
          <p v-if="tab === 'dashboard'" class="sub">Ventas de afiliados, renovaciones y comisiones</p>
        </div>
        <div class="top-actions">
          <div v-if="tab === 'dashboard'" class="seg" role="group" aria-label="Periodo">
            <button v-for="p in PERIODS" :key="p.key" type="button" :class="{ on: period === p.key }" @click="period = p.key">{{ p.label }}</button>
          </div>
          <button class="btn btn-icon" type="button" :aria-label="themeLabel" :title="themeLabel" @click="cycleTheme">
            <svg v-if="theme === 'dark'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            <svg v-else-if="theme === 'light'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
          </button>
        </div>
      </header>

      <p v-if="message" class="notice" role="status">{{ message }}</p>
      <p v-if="unauthorized" class="notice notice-err" role="alert">El token no es válido o falta. Escríbelo en el menú lateral, en «Token de administración».</p>

      <ViewDashboard v-if="tab === 'dashboard'" :report="report" @go="go" />
      <ViewSales v-else-if="tab === 'sales'" :key="`s${viewKey}`" />
      <ViewAffiliates v-else-if="tab === 'affiliates'" :key="`a${viewKey}`" @message="message = $event" @changed="refreshAll" />
      <ViewCommissions v-else :key="`c${viewKey}`" @message="message = $event" @changed="refreshAll" />
    </div>
  </div>
</template>
