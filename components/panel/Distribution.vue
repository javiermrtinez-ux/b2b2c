<script setup lang="ts">
import { eur, eurCompact, int } from '~/utils/format'

/** Reparto del importe por programa: barra segmentada en tonos de naranja y lista con la variación. */
const props = defineProps<{ rows: Array<{ label: string; value: number; count: number; delta: number | null }> }>()
const total = computed(() => props.rows.reduce((s, r) => s + r.value, 0))
const count = computed(() => props.rows.reduce((s, r) => s + r.count, 0))
</script>

<template>
  <div v-if="rows.length" class="dist">
    <p class="dist-total">Total: {{ eur(total) }} <span>en {{ int(count) }} ventas</span></p>
    <div class="dist-bar" role="img" :aria-label="rows.map((r) => `${r.label} ${eur(r.value)}`).join(', ')">
      <span v-for="(r, i) in rows" :key="r.label" :class="`tone-${i + 1}`" :style="{ flexGrow: Math.max(r.value, total * 0.04) }" />
    </div>
    <ul class="dist-list">
      <li v-for="(r, i) in rows" :key="r.label">
        <i class="dot" :class="`tone-${i + 1}`" />
        <span class="dist-name">{{ r.label }}</span>
        <span class="dist-val">{{ r.value >= 10000 ? eurCompact(r.value) : eur(r.value) }}</span>
        <span v-if="r.delta != null" class="dist-delta" :class="r.delta >= 0 ? 'up' : 'down'">
          <span aria-hidden="true">{{ r.delta >= 0 ? '▲' : '▼' }}</span> {{ Math.abs(r.delta).toLocaleString('es-ES') }} %
        </span>
        <span v-else-if="r.label !== 'Otros'" class="dist-delta muted">nuevo</span>
      </li>
    </ul>
  </div>
  <p v-else class="empty-line">Aún no hay ventas en este periodo.</p>
</template>
