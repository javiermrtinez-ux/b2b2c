<script setup lang="ts">
import { eurCompact, int, monthLabel } from '~/utils/format'

/** Evolución mensual en euros: importe válido (naranja) y, encima, el anulado (rayado). Eje Y con importes. */
const props = defineProps<{ rows: Array<{ month: string; valid: number; invalid: number; value: number; invalidValue: number }> }>()

const el = ref<HTMLElement | null>(null)
const W = ref(560)
const H = 300
const PAD = { top: 12, right: 4, bottom: 28, left: 48 }
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => { W.value = Math.max(280, Math.round(e.contentRect.width)) })
  if (el.value) ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())
const hover = ref<number | null>(null)

/** Máximo del eje redondeado a un número «bonito» y 5 marcas. */
const scale = computed(() => {
  const raw = Math.max(1, ...props.rows.map((r) => r.value + r.invalidValue))
  const step0 = raw / 5
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag
  return { max: step * 5, ticks: Array.from({ length: 6 }, (_, i) => i * step) }
})
const plotH = H - PAD.top - PAD.bottom
const y = (v: number) => PAD.top + plotH - (v / scale.value.max) * plotH
const slot = computed(() => (W.value - PAD.left - PAD.right) / Math.max(1, props.rows.length))
const barW = computed(() => Math.min(46, slot.value * 0.66))
const bars = computed(() =>
  props.rows.map((r, i) => {
    const x = PAD.left + i * slot.value + (slot.value - barW.value) / 2
    const yv = y(r.value)
    const yi = y(r.value + r.invalidValue)
    return { ...r, x, yv, hv: PAD.top + plotH - yv, yi, hi: yv - yi, label: monthLabel(r.month) }
  })
)
const aria = computed(() => `Importe por mes: ${props.rows.map((r) => `${monthLabel(r.month)} ${eurCompact(r.value)} válido y ${eurCompact(r.invalidValue)} anulado`).join('; ')}`)
</script>

<template>
  <div ref="el" class="pipe">
    <svg :viewBox="`0 0 ${W} ${H}`" :height="H" role="img" :aria-label="aria" class="pipe-svg">
      <defs>
        <linearGradient id="pipe-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="grad-top" />
          <stop offset="1" class="grad-bottom" />
        </linearGradient>
        <pattern id="pipe-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" class="hatch-bg" />
          <line x1="0" y1="0" x2="0" y2="6" class="hatch-line" />
        </pattern>
      </defs>
      <g v-for="t in scale.ticks" :key="t">
        <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(t)" :y2="y(t)" class="grid" />
        <text :x="PAD.left - 8" :y="y(t) + 4" class="ytick">{{ eurCompact(t) }}</text>
      </g>
      <g v-for="(b, i) in bars" :key="b.month" class="pipe-col" :class="{ dim: hover !== null && hover !== i }" @mouseenter="hover = i" @mouseleave="hover = null">
        <rect :x="b.x - 4" :y="PAD.top" :width="barW + 8" :height="plotH" class="hit" />
        <rect v-if="b.hi > 0.5" :x="b.x" :y="b.yi" :width="barW" :height="b.hi + 6" rx="6" fill="url(#pipe-hatch)" />
        <rect v-if="b.hv > 0.5" :x="b.x" :y="b.yv" :width="barW" :height="b.hv" rx="6" fill="url(#pipe-grad)" />
        <text v-if="slot >= 30 || i % 2 === (rows.length - 1) % 2" :x="b.x + barW / 2" :y="H - 8" class="xtick">{{ b.label }}</text>
      </g>
    </svg>
    <p class="pipe-tip" aria-live="polite">
      <template v-if="hover !== null">
        <b>{{ bars[hover].label }}</b> · {{ eurCompact(bars[hover].value) }} válido ({{ int(bars[hover].valid) }}) · {{ eurCompact(bars[hover].invalidValue) }} anulado ({{ int(bars[hover].invalid) }})
      </template>
      <template v-else>Pasa por una barra para ver el detalle del mes.</template>
    </p>
  </div>
</template>
