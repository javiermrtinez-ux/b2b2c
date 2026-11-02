<script setup lang="ts">
import { eur, int } from '~/utils/format'

/** Lista de barras horizontales: etiqueta, barra proporcional, importe y nº de ventas. */
const props = defineProps<{ rows: Array<{ label: string; value: number; count: number }>; empty?: string; colored?: boolean }>()
const max = computed(() => Math.max(1, ...props.rows.map((r) => r.value)))
</script>

<template>
  <ul v-if="rows.length" class="barlist">
    <li v-for="(r, i) in rows" :key="r.label">
      <div class="barlist-top">
        <span class="barlist-label"><i v-if="colored" class="sw" :class="`sw-c${(i % 6) + 1}`" />{{ r.label }}</span>
        <span class="barlist-value">{{ eur(r.value) }}</span>
      </div>
      <div class="barlist-track" aria-hidden="true">
        <span :class="colored ? `fill-c${(i % 6) + 1}` : 'fill-accent'" :style="{ width: `${(r.value / max) * 100}%` }" />
      </div>
      <span class="barlist-count">{{ int(r.count) }} {{ r.count === 1 ? 'venta' : 'ventas' }}</span>
    </li>
  </ul>
  <p v-else class="empty-line">{{ empty || 'Sin datos en este periodo.' }}</p>
</template>
