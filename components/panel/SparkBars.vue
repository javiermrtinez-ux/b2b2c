<script setup lang="ts">
/** Barras finas (una por día o semana) con la mayor resaltada y su etiqueta encima. */
const props = defineProps<{ values: number[]; labels: string[]; ticks: string[]; peakLabel?: (v: number) => string; aria: string }>()
const W = 300
const H = 96
const max = computed(() => Math.max(1, ...props.values))
const peak = computed(() => props.values.reduce((best, v, i, a) => (v > a[best] ? i : best), 0))
const step = computed(() => W / Math.max(1, props.values.length))
</script>

<template>
  <div class="spark">
    <svg :viewBox="`0 0 ${W} ${H + 16}`" role="img" :aria-label="aria" class="spark-svg" preserveAspectRatio="none">
      <g v-for="(v, i) in values" :key="i">
        <title>{{ labels[i] }}: {{ v }}</title>
        <rect :x="i * step + step / 2 - 1" y="16" width="2" :height="H" rx="1" class="spark-bg" />
        <rect :x="i * step + step / 2 - 1" :y="16 + H - (v / max) * H" width="2" :height="(v / max) * H" rx="1" :class="i === peak && v > 0 ? 'spark-peak' : 'spark-bar'" />
      </g>
    </svg>
    <span v-if="values[peak] > 0" class="spark-label" :style="{ left: `${((peak + 0.5) / values.length) * 100}%` }">{{ peakLabel ? peakLabel(values[peak]) : values[peak] }}</span>
    <div class="spark-ticks"><span v-for="t in ticks" :key="t">{{ t }}</span></div>
  </div>
</template>
