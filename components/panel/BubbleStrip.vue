<script setup lang="ts">
import { eur, eurCompact } from '~/utils/format'

/** Afiliados como burbujas en tres franjas (grandes, medianos, pequeños). Eje X logarítmico por importe, tamaño por nº de ventas. */
const props = defineProps<{ rows: Array<{ id: number; label: string; value: number; count: number; segment: 'large' | 'mid' | 'small' }> }>()
const W = 300
const ROW = 30
const LANES = [
  { key: 'large', label: 'Grandes' },
  { key: 'mid', label: 'Medianos' },
  { key: 'small', label: 'Pequeños' }
] as const
const bounds = computed(() => {
  const vals = props.rows.map((r) => r.value).filter((v) => v > 0)
  const lo = Math.max(1, Math.min(...vals, Infinity))
  const hi = Math.max(lo * 10, ...vals)
  return { lo: Math.log10(lo), hi: Math.log10(hi) }
})
const x = (v: number) => 8 + ((Math.log10(Math.max(v, 1)) - bounds.value.lo) / Math.max(0.0001, bounds.value.hi - bounds.value.lo)) * (W - 16)
const maxCount = computed(() => Math.max(1, ...props.rows.map((r) => r.count)))
const r = (c: number) => 3 + Math.sqrt(c / maxCount.value) * 8
const ticks = computed(() => {
  const out: number[] = []
  for (let e = Math.floor(bounds.value.lo); e <= Math.ceil(bounds.value.hi); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e
      if (Math.log10(v) >= bounds.value.lo && Math.log10(v) <= bounds.value.hi) out.push(v)
    }
  }
  // Como mucho 5 marcas para que no se pisen
  return out.length > 5 ? out.filter((_, i) => i % Math.ceil(out.length / 5) === 0) : out
})
</script>

<template>
  <div class="bubbles">
    <svg :viewBox="`0 0 ${W} ${ROW * 3 + 20}`" role="img" :aria-label="`Afiliados por importe: ${rows.length} en el periodo`" class="bubbles-svg">
      <g v-for="(lane, li) in LANES" :key="lane.key">
        <line x1="0" :x2="W" :y1="ROW * li + ROW / 2" :y2="ROW * li + ROW / 2" class="grid dashed" />
        <circle
          v-for="a in rows.filter((r) => r.segment === lane.key)"
          :key="a.id"
          :cx="x(a.value)"
          :cy="ROW * li + ROW / 2"
          :r="r(a.count)"
          :class="`bub-${lane.key}`"
        >
          <title>{{ a.label }}: {{ eur(a.value) }} en {{ a.count }} ventas</title>
        </circle>
      </g>
      <text v-for="t in ticks" :key="t" :x="x(t)" :y="ROW * 3 + 16" class="xtick">{{ eurCompact(t) }}</text>
    </svg>
    <ul class="bubbles-lanes" aria-hidden="true">
      <li v-for="lane in LANES" :key="lane.key">{{ lane.label }}</li>
    </ul>
  </div>
</template>
