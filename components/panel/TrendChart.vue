<script setup lang="ts">
import { eur, eurCompact, monthLabel } from '~/utils/format'
import { forecast, type Scenario } from '~/utils/forecast'

/**
 * Evolución en línea: importe válido de los meses cerrados (área naranja) y proyección de los próximos
 * meses (línea discontinua) con su intervalo al 95 % (banda) según el escenario elegido.
 */
const props = defineProps<{ rows: Array<{ month: string; value: number }>; scenario: Scenario; horizon?: number }>()

const el = ref<HTMLElement | null>(null)
const W = ref(560)
const H = 300
const PAD = { top: 14, right: 12, bottom: 28, left: 52 }
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => { W.value = Math.max(280, Math.round(e.contentRect.width)) })
  if (el.value) ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())

const horizon = computed(() => props.horizon ?? 4)
const fc = computed(() => forecast(props.rows.map((r) => r.value), horizon.value, props.scenario))
const futureMonths = computed(() => {
  const last = props.rows.at(-1)?.month
  if (!last) return []
  const [y, m] = last.split('-').map(Number)
  return Array.from({ length: horizon.value }, (_, i) => new Date(Date.UTC(y, m + i, 1)).toISOString().slice(0, 7))
})

const all = computed(() => [
  ...props.rows.map((r) => ({ month: r.month, value: r.value, low: r.value, high: r.value, future: false })),
  ...(fc.value?.points ?? []).map((p, i) => ({ month: futureMonths.value[i], ...p, future: true }))
])
const scale = computed(() => {
  const vals = all.value.flatMap((p) => [p.low, p.high, p.value])
  const lo0 = Math.min(...vals)
  const hi0 = Math.max(1, ...vals)
  const step0 = (hi0 - lo0 || hi0) / 4
  const mag = 10 ** Math.floor(Math.log10(step0 || 1))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= step0) ?? 10 * mag
  const min = Math.max(0, Math.floor(lo0 / step) * step)
  const max = Math.ceil(hi0 / step) * step
  const ticks: number[] = []
  for (let t = min; t <= max + step / 2; t += step) ticks.push(t)
  return { min, max: Math.max(max, min + step), ticks }
})
const plotH = H - PAD.top - PAD.bottom
const x = (i: number) => PAD.left + (i * (W.value - PAD.left - PAD.right)) / Math.max(1, all.value.length - 1)
const y = (v: number) => PAD.top + plotH - ((v - scale.value.min) / (scale.value.max - scale.value.min)) * plotH

const nHist = computed(() => props.rows.length)
const histPath = computed(() => props.rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.value)}`).join(''))
const areaPath = computed(() =>
  nHist.value ? `${histPath.value}L${x(nHist.value - 1)},${PAD.top + plotH}L${x(0)},${PAD.top + plotH}Z` : ''
)
const futPath = computed(() => {
  if (!fc.value || !nHist.value) return ''
  const pts = [{ i: nHist.value - 1, v: props.rows[nHist.value - 1].value }, ...fc.value.points.map((p, k) => ({ i: nHist.value + k, v: p.value }))]
  return pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i)},${y(p.v)}`).join('')
})
const bandPath = computed(() => {
  if (!fc.value || !nHist.value) return ''
  const last = props.rows[nHist.value - 1].value
  const top = [{ i: nHist.value - 1, v: last }, ...fc.value.points.map((p, k) => ({ i: nHist.value + k, v: p.high }))]
  const bottom = [...fc.value.points.map((p, k) => ({ i: nHist.value + k, v: p.low }))].reverse()
  return [...top, ...bottom, { i: nHist.value - 1, v: last }].map((p, k) => `${k ? 'L' : 'M'}${x(p.i)},${y(p.v)}`).join('') + 'Z'
})

const hover = ref<number | null>(null)
const showLabel = (i: number) => (W.value - PAD.left) / all.value.length >= 34 || i % 2 === (all.value.length - 1) % 2
const aria = computed(
  () =>
    `Importe válido por mes${fc.value ? " y proyección" : ""}: ${all.value
      .map((p) => `${monthLabel(p.month)}${p.future ? ' (proyección)' : ''} ${eurCompact(p.value)}`)
      .join('; ')}`
)
defineExpose({ forecast: fc })
</script>

<template>
  <div ref="el" class="trend">
    <svg :viewBox="`0 0 ${W} ${H}`" :height="H" role="img" :aria-label="aria" class="pipe-svg">
      <defs>
        <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="area-top" />
          <stop offset="1" class="area-bottom" />
        </linearGradient>
      </defs>
      <g v-for="t in scale.ticks" :key="t">
        <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(t)" :y2="y(t)" class="grid dashed" />
        <text :x="PAD.left - 8" :y="y(t) + 4" class="ytick">{{ eurCompact(t) }}</text>
      </g>
      <path v-if="bandPath" :d="bandPath" class="trend-band" />
      <path v-if="areaPath" :d="areaPath" fill="url(#trend-area)" />
      <path :d="histPath" class="trend-line" />
      <path v-if="futPath" :d="futPath" class="trend-future" />
      <g v-for="(p, i) in all" :key="p.month" @mouseenter="hover = i" @mouseleave="hover = null">
        <rect :x="x(i) - 14" :y="PAD.top" width="28" :height="plotH" class="hit" />
        <line v-if="hover === i" :x1="x(i)" :x2="x(i)" :y1="PAD.top" :y2="PAD.top + plotH" class="grid" />
        <circle :cx="x(i)" :cy="y(p.value)" :r="hover === i ? 5 : 3.5" :class="p.future ? 'trend-dot-future' : 'trend-dot'" />
        <text v-if="showLabel(i)" :x="x(i)" :y="H - 8" class="xtick" :class="{ 'xtick-future': p.future }">{{ monthLabel(p.month) }}{{ p.future ? '*' : '' }}</text>
      </g>
    </svg>
    <p class="pipe-tip" aria-live="polite">
      <template v-if="hover !== null">
        <b>{{ monthLabel(all[hover].month) }}</b>
        <template v-if="all[hover].future"> · proyección {{ eur(all[hover].value) }} (entre {{ eurCompact(all[hover].low) }} y {{ eurCompact(all[hover].high) }})</template>
        <template v-else> · {{ eur(all[hover].value) }} vendido</template>
      </template>
      <template v-else-if="fc">Meses cerrados y proyección de los {{ horizon }} siguientes (*), con intervalo al 95 %.</template>
      <template v-else>Hacen falta al menos 3 meses cerrados con ventas para proyectar.</template>
    </p>
  </div>
</template>
