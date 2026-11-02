<script setup lang="ts">
import { eurCompact, int, monthLabel } from '~/utils/format'

/** Evolución mensual: barra apilada de ventas válidas y anuladas, y el importe válido encima. */
const props = defineProps<{ rows: Array<{ month: string; valid: number; invalid: number; value: number }> }>()

// El ancho sigue al de la tarjeta para que el texto no se deforme al estirar el SVG.
const el = ref<HTMLElement | null>(null)
const W = ref(640)
const H = 280
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => { W.value = Math.max(280, Math.round(e.contentRect.width)) })
  if (el.value) ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())
const PAD = { top: 28, right: 8, bottom: 26, left: 8 }
const hover = ref<number | null>(null)

const max = computed(() => Math.max(1, ...props.rows.map((r) => r.valid + r.invalid)))
const slot = computed(() => (W.value - PAD.left - PAD.right) / Math.max(1, props.rows.length))
const barW = computed(() => Math.min(40, slot.value * 0.6))
const plotH = H - PAD.top - PAD.bottom
const y = (n: number) => (n / max.value) * plotH

const bars = computed(() =>
  props.rows.map((r, i) => {
    const x = PAD.left + i * slot.value + (slot.value - barW.value) / 2
    const hv = y(r.valid)
    const hi = y(r.invalid)
    const base = H - PAD.bottom
    return {
      ...r,
      x,
      validY: base - hv,
      validH: hv,
      // 2 px de hueco entre los dos tramos apilados
      invalidY: base - hv - hi - (hi && hv ? 2 : 0),
      invalidH: hi,
      label: monthLabel(r.month)
    }
  })
)
const total = computed(() => props.rows.reduce((s, r) => s + r.valid, 0))
const aria = computed(
  () => `Ventas por mes: ${props.rows.map((r) => `${monthLabel(r.month)} ${r.valid} válidas y ${r.invalid} anuladas`).join('; ')}`
)
</script>

<template>
  <div ref="el" class="chart">
    <ul class="legend">
      <li><i class="sw sw-1" />Válidas</li>
      <li><i class="sw sw-2" />Anuladas</li>
      <li class="legend-total">{{ int(total) }} ventas válidas</li>
    </ul>
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="aria" class="chart-svg">
      <line :x1="PAD.left" :x2="W - PAD.right" :y1="H - PAD.bottom" :y2="H - PAD.bottom" class="axis" />
      <g v-for="(b, i) in bars" :key="b.month" @mouseenter="hover = i" @mouseleave="hover = null">
        <rect :x="b.x - 6" :y="PAD.top - 20" :width="barW + 12" :height="plotH + 20" class="hit" />
        <rect v-if="b.invalidH" :x="b.x" :y="b.invalidY" :width="barW" :height="b.invalidH" rx="4" class="bar-2" />
        <rect v-if="b.validH" :x="b.x" :y="b.validY" :width="barW" :height="b.validH" rx="4" class="bar-1" :class="{ dim: hover !== null && hover !== i }" />
        <text v-if="hover === i || rows.length <= 6" :x="b.x + barW / 2" :y="Math.min(b.invalidY, b.validY) - 6" class="val">
          {{ eurCompact(b.value) }}
        </text>
        <text :x="b.x + barW / 2" :y="H - 8" class="tick">{{ b.label }}</text>
      </g>
    </svg>
    <p v-if="hover !== null" class="chart-tip">
      {{ bars[hover].label }}: {{ int(bars[hover].valid) }} válidas, {{ int(bars[hover].invalid) }} anuladas · {{ eurCompact(bars[hover].value) }}
    </p>
  </div>
</template>
