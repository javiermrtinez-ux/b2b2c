<script setup lang="ts">
import type { Report } from '~/server/utils/report'
import { dayLabel, eur, int, renewalLabel, renewalTone } from '~/utils/format'
import { forecast, type Scenario } from '~/utils/forecast'

const props = defineProps<{ report: Report | null | undefined; period: string }>()
const emit = defineEmits<{ go: [tab: string]; 'update:period': [p: string] }>()

const PERIODS = [
  { key: '3m', label: 'Últimos 3 meses' },
  { key: '6m', label: 'Últimos 6 meses' },
  { key: '12m', label: 'Últimos 12 meses' }
]
const r = computed(() => props.report)
const { customDates } = useFilters()
const rangeLabel = computed(() => {
  if (!r.value) return ''
  const f = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${f.format(new Date(r.value.from))} – ${f.format(new Date(new Date(r.value.to).getTime() - 1))}`
})

// «Evolución de ventas» en barras (periodo elegido) o en línea con proyección (12 meses cerrados + 4).
const chartView = ref<'bars' | 'line'>('bars')
const scenario = ref<Scenario>('base')
const SCENARIOS: Array<{ key: Scenario; label: string }> = [
  { key: 'conservative', label: 'Conservador' },
  { key: 'base', label: 'Base' },
  { key: 'optimistic', label: 'Optimista' }
]
onMounted(() => {
  try {
    const v = localStorage.getItem('chartView')
    if (v === 'line' || v === 'bars') chartView.value = v
  } catch {}
})
watch(chartView, (v) => { try { localStorage.setItem('chartView', v) } catch {} })
const fc = computed(() => (r.value ? forecast(r.value.trend.map((t) => t.value), 4, scenario.value) : null))
const trendTotal = computed(() => (r.value ? r.value.trend.reduce((s, t) => s + t.value, 0) : 0))
const invalidCount = computed(() => (r.value ? r.value.monthly.reduce((s, m) => s + m.invalid, 0) : 0))
const dailyTotal = computed(() => (r.value ? r.value.daily.reduce((s, d) => s + d.count, 0) : 0))
const weeklyTotal = computed(() => (r.value ? r.value.weekly.reduce((s, d) => s + d.count, 0) : 0))
const shortDay = (iso: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso)).replace('.', '')
const initials = (name: string) =>
  String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
// Color de avatar estable por afiliado (6 tonos)
const tone = (name: string) => (Array.from(String(name)).reduce((h, c) => h + c.charCodeAt(0), 0) % 6) + 1
</script>

<template>
  <PanelFilterBar />
  <div v-if="r" class="dash">
    <section class="card pipeline-card">
      <header class="card-head">
        <h2>Evolución de ventas</h2>
        <div class="head-tools">
          <div class="seg seg-sm" role="group" aria-label="Tipo de gráfico">
            <button type="button" :class="{ on: chartView === 'bars' }" :aria-pressed="chartView === 'bars'" @click="chartView = 'bars'">Barras</button>
            <button type="button" :class="{ on: chartView === 'line' }" :aria-pressed="chartView === 'line'" @click="chartView = 'line'">Línea</button>
          </div>
          <span v-if="chartView === 'bars' && customDates" class="pill-select range-pill">{{ rangeLabel }}</span>
          <select v-else-if="chartView === 'bars'" class="pill-select" :value="period" aria-label="Periodo" @change="emit('update:period', ($event.target as HTMLSelectElement).value)">
            <option v-for="p in PERIODS" :key="p.key" :value="p.key">{{ p.label }}</option>
          </select>
        </div>
      </header>

      <template v-if="chartView === 'bars'">
        <div class="pipe-head">
          <div>
            <p class="big">{{ eur(r.kpis.revenue.value) }}</p>
            <p class="risk">
              <span class="risk-icon" aria-hidden="true">!</span>
              <b>{{ int(invalidCount) }} {{ invalidCount === 1 ? 'venta anulada' : 'ventas anuladas' }}</b> en el periodo
            </p>
          </div>
          <ul class="legend">
            <li><i class="dot dot-orange" />Válidas</li>
            <li><i class="dot dot-hatch" />Anuladas</li>
          </ul>
        </div>
        <PanelPipelineChart :rows="r.monthly" />
      </template>

      <template v-else>
        <div class="pipe-head">
          <div>
            <p class="big">{{ eur(trendTotal) }}</p>
            <p v-if="fc" class="sub">
              Últimos 12 meses cerrados y proyección de los 4 siguientes
              <span class="ci-badge">Intervalo 95 %</span>
            </p>
            <p v-else class="sub">Últimos 12 meses cerrados</p>
          </div>
          <div v-if="fc" class="seg seg-sm" role="group" aria-label="Escenario">
            <button v-for="sc in SCENARIOS" :key="sc.key" type="button" :class="{ on: scenario === sc.key }" :aria-pressed="scenario === sc.key" @click="scenario = sc.key">{{ sc.label }}</button>
          </div>
        </div>
        <ul class="legend">
          <li><i class="dot dot-orange" />Histórico</li>
          <template v-if="fc">
            <li><i class="dash-line" />Proyección</li>
            <li><i class="dot dot-band" />Intervalo</li>
          </template>
        </ul>
        <PanelTrendChart :rows="r.trend" :scenario="scenario" />
        <footer v-if="fc" class="trend-stats">
          <div>
            <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m3 17 6-6 4 4 8-8M15 7h6v6" /></svg></span>
            <div><small>Proyección próximos 3 meses</small><b>{{ eur(fc.next3) }}</b></div>
          </div>
          <div>
            <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></svg></span>
            <div><small>Probabilidad de superar los 3 meses anteriores</small><b class="accent">{{ fc.beatPrev3Pct.toLocaleString('es-ES') }} %</b></div>
          </div>
          <div>
            <span class="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg></span>
            <div><small>Tendencia</small><b :class="fc.monthlyTrendPct >= 0 ? 'up' : 'down'">{{ fc.monthlyTrendPct >= 0 ? '+' : '' }}{{ fc.monthlyTrendPct.toLocaleString('es-ES') }} % al mes</b></div>
          </div>
        </footer>
      </template>
    </section>

    <section class="card">
      <header class="card-head">
        <h2>Ventas diarias</h2>
        <button class="icon-btn" type="button" aria-label="Ver ventas" @click="emit('go', 'sales')"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg></button>
      </header>
      <p class="metric"><b>{{ int(dailyTotal) }}</b> ventas</p>
      <ul class="legend legend-sm"><li><i class="dot dot-orange" />Día con más ventas</li><li><i class="dot dot-grey" />Últimos 30 días</li></ul>
      <PanelSparkBars
        :values="r.daily.map((d) => d.count)"
        :labels="r.daily.map((d) => dayLabel(d.day))"
        :ticks="[0, 7, 14, 21, 29].map((i) => shortDay(r!.daily[i].day))"
        :peak-label="(v) => `${v}`"
        aria="Ventas válidas por día en los últimos 30 días"
      />
    </section>

    <section class="card">
      <header class="card-head">
        <h2>Renovaciones por semana</h2>
        <button class="icon-btn" type="button" aria-label="Ver ventas pendientes de renovar" @click="emit('go', 'sales')"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg></button>
      </header>
      <p class="metric"><b>{{ int(weeklyTotal) }}</b> vencen en 12 semanas</p>
      <ul class="legend legend-sm"><li><i class="dot dot-orange" />Semana con más</li><li><i class="dot dot-grey" />Pendientes</li></ul>
      <PanelSparkBars
        :values="r.weekly.map((w) => w.count)"
        :labels="r.weekly.map((w) => `Semana del ${dayLabel(w.week)}`)"
        :ticks="[0, 4, 8, 11].map((i) => shortDay(r!.weekly[i].week))"
        aria="Renovaciones pendientes que vencen en cada una de las próximas 12 semanas"
      />
    </section>

    <section class="card">
      <header class="card-head">
        <div>
          <h2>Salud de renovaciones</h2>
          <p class="sub">{{ r.kpis.renewalRate.value == null ? 'Aún no hay respuestas del partner' : `Renuevan el ${r.kpis.renewalRate.value.toLocaleString('es-ES')} % en total` }}</p>
        </div>
      </header>
      <PanelLollipop :rows="r.renewalHealth" />
    </section>

    <section class="card">
      <header class="card-head">
        <h2>Segmentos de afiliados</h2>
        <button class="icon-btn" type="button" aria-label="Ver afiliados" @click="emit('go', 'affiliates')"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg></button>
      </header>
      <PanelBubbleStrip v-if="r.segments.length" :rows="r.segments" />
      <p v-else class="empty-line">Aún no hay afiliados con ventas en este periodo.</p>
    </section>

    <section class="card latest-card">
      <header class="card-head">
        <h2>Últimas ventas</h2>
        <button class="pill-btn" type="button" @click="emit('go', 'sales')">Ver todas</button>
      </header>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>#</th><th>Afiliado</th><th class="num">Importe</th><th>Programa</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in (r.latest as any[]).slice(0, 5)" :key="s.transaction_id">
              <td class="muted">{{ String(i + 1).padStart(2, '0') }}</td>
              <td><span class="who"><span class="avatar" :class="`tone-${tone(s.affiliate_name)}`" aria-hidden="true">{{ initials(s.affiliate_name) }}</span>{{ s.affiliate_name }}</span></td>
              <td class="num">{{ eur(s.order_value) }}</td>
              <td>{{ s.program_name || '—' }}</td>
              <td>
                <PanelStatusChip v-if="!s.valid" tone="err" label="Anulada" />
                <PanelStatusChip v-else :tone="renewalTone[s.renewal_status]" :label="renewalLabel[s.renewal_status]" />
              </td>
              <td>{{ dayLabel(s.occurred_at) }}</td>
            </tr>
            <tr v-if="!r.latest.length"><td colspan="6" class="empty-line">Aún no hay ventas. Sincroniza con Tradedoubler para traerlas.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card dist-card">
      <header class="card-head">
        <h2>Distribución por programa</h2>
        <span class="info" :title="`Importe válido del periodo y variación frente a los ${period === '3m' ? '3' : period === '6m' ? '6' : '12'} meses anteriores`" aria-hidden="true">i</span>
      </header>
      <PanelDistribution :rows="r.byProgram" />
    </section>

    <section class="card td-card">
      <header class="card-head">
        <div>
          <h2>Comisiones de Tradedoubler</h2>
          <p class="sub">De la venta original, en el periodo</p>
        </div>
        <button class="icon-btn" type="button" aria-label="Ver comisiones" @click="emit('go', 'commissions')"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg></button>
      </header>
      <ul class="td-comm">
        <li><span><i class="dot dot-green" />Aceptadas</span><b>{{ eur(r.tdCommissions.accepted.amount) }}</b><small>{{ int(r.tdCommissions.accepted.count) }}</small></li>
        <li><span><i class="dot dot-amber" />Pendientes</span><b>{{ eur(r.tdCommissions.pending.amount) }}</b><small>{{ int(r.tdCommissions.pending.count) }}</small></li>
        <li><span><i class="dot dot-red" />Denegadas</span><b>{{ eur(r.tdCommissions.denied.amount) }}</b><small>{{ int(r.tdCommissions.denied.count) }}</small></li>
        <li class="td-paid"><span>Ya pagado por Tradedoubler</span><b>{{ eur(r.tdCommissions.paid) }}</b></li>
      </ul>
    </section>
  </div>
</template>
