<script setup lang="ts">
defineProps<{ label: string; value: string; delta?: number | null; hint?: string; icon?: string }>()
</script>

<template>
  <article class="card kpi">
    <header class="kpi-head">
      <span class="kpi-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="icon" />
      </span>
      <span class="kpi-label">{{ label }}</span>
    </header>
    <div class="kpi-value">{{ value }}</div>
    <footer class="kpi-foot">
      <span v-if="delta != null" class="delta" :class="delta >= 0 ? 'up' : 'down'">
        <span aria-hidden="true">{{ delta >= 0 ? '▲' : '▼' }}</span>
        {{ Math.abs(delta).toLocaleString('es-ES') }} %
        <span class="sr-only">{{ delta >= 0 ? 'más' : 'menos' }} que el periodo anterior</span>
      </span>
      <span v-if="hint" class="kpi-hint">{{ hint }}</span>
    </footer>
  </article>
</template>
