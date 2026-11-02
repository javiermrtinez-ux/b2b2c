<script setup lang="ts">
import { monthLabel } from '~/utils/format'

/** Piruletas: tasa de renovación por mes de vencimiento; el último mes con datos va resaltado con su etiqueta. */
const props = defineProps<{ rows: Array<{ month: string; rate: number | null; decided: number }> }>()
const W = 300
const H = 110
const last = computed(() => {
  for (let i = props.rows.length - 1; i >= 0; i--) if (props.rows[i].rate != null) return i
  return -1
})
const step = computed(() => W / Math.max(1, props.rows.length))
const yOf = (rate: number) => 18 + (1 - rate / 100) * (H - 18)
const aria = computed(() => `Tasa de renovación por mes: ${props.rows.map((r) => `${monthLabel(r.month)} ${r.rate == null ? 'sin datos' : `${r.rate} %`}`).join('; ')}`)
</script>

<template>
  <div class="lolly">
    <svg :viewBox="`0 0 ${W} ${H + 18}`" role="img" :aria-label="aria" class="lolly-svg">
      <line x1="0" :x2="W" :y1="yOf(50)" :y2="yOf(50)" class="grid dashed" />
      <g v-for="(r, i) in rows" :key="r.month">
        <title>{{ monthLabel(r.month) }}: {{ r.rate == null ? 'sin datos' : `${r.rate} % de ${r.decided}` }}</title>
        <template v-if="r.rate != null">
          <line :x1="i * step + step / 2" :x2="i * step + step / 2" :y1="H" :y2="yOf(r.rate)" :class="i === last ? 'lolly-stick-on' : 'lolly-stick'" />
          <circle :cx="i * step + step / 2" :cy="yOf(r.rate)" :r="i === last ? 4 : 3" :class="i === last ? 'lolly-dot-on' : 'lolly-dot'" />
        </template>
        <circle v-else :cx="i * step + step / 2" :cy="H - 2" r="2" class="lolly-none" />
        <text v-if="i % 2 === rows.length % 2 || rows.length <= 6" :x="i * step + step / 2" :y="H + 15" class="xtick">{{ monthLabel(r.month) }}</text>
      </g>
    </svg>
    <span v-if="last >= 0" class="lolly-pill" :style="{ left: `${((last + 0.5) / rows.length) * 100}%` }">{{ rows[last].rate }} %</span>
  </div>
</template>
