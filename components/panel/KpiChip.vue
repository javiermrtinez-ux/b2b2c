<script setup lang="ts">
/** Indicador compacto de la cabecera: valor, variación y unas barras pequeñas con la tendencia. */
const props = defineProps<{ label: string; value: string; delta?: number | null; trend?: number[] }>()
const bars = computed(() => {
  const t = props.trend || []
  const max = Math.max(1, ...t)
  return t.map((v) => Math.max(2, Math.round((v / max) * 22)))
})
</script>

<template>
  <article class="chip-kpi">
    <div>
      <div class="chip-kpi-top">
        <b>{{ value }}</b>
        <span v-if="delta != null" class="badge" :class="delta >= 0 ? 'badge-up' : 'badge-down'" :title="`${delta >= 0 ? '+' : ''}${delta} % frente al periodo anterior`">
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path :d="delta >= 0 ? 'M3 9 9 3M4 3h5v5' : 'M3 3l6 6M9 4v5H4'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          <span class="sr-only">{{ delta >= 0 ? 'sube' : 'baja' }} {{ Math.abs(delta) }} %</span>
        </span>
      </div>
      <span class="chip-kpi-label">{{ label }}</span>
    </div>
    <svg v-if="bars.length" class="chip-kpi-spark" :viewBox="`0 0 ${bars.length * 5} 24`" aria-hidden="true">
      <rect v-for="(h, i) in bars" :key="i" :x="i * 5" :y="24 - h" width="3" :height="h" rx="1" />
    </svg>
  </article>
</template>
