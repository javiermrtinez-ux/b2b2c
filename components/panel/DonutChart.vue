<script setup lang="ts">
import { eur } from '~/utils/format'

/** Anillo de partes de un todo con la leyenda al lado. */
const props = defineProps<{ parts: Array<{ key: string; label: string; value: number; count: number }>; centerLabel: string }>()

const R = 52
const C = 2 * Math.PI * R
const total = computed(() => props.parts.reduce((s, p) => s + p.value, 0))
const arcs = computed(() => {
  let acc = 0
  return props.parts.map((p) => {
    const len = total.value ? (p.value / total.value) * C : 0
    // 2 px de hueco entre tramos cuando hay más de uno
    const gap = len > 4 ? 2 : 0
    const arc = { ...p, dash: `${Math.max(0, len - gap)} ${C}`, offset: -acc }
    acc += len
    return arc
  })
})
const aria = computed(() => `${props.centerLabel}: ${props.parts.map((p) => `${p.label} ${eur(p.value)}`).join(', ')}`)
</script>

<template>
  <div class="donut">
    <svg viewBox="0 0 140 140" role="img" :aria-label="aria" class="donut-svg">
      <circle cx="70" cy="70" :r="R" class="donut-track" />
      <circle
        v-for="a in arcs"
        :key="a.key"
        cx="70"
        cy="70"
        :r="R"
        class="donut-arc"
        :class="`stroke-${a.key}`"
        :stroke-dasharray="a.dash"
        :stroke-dashoffset="a.offset"
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="66" class="donut-total">{{ eur(total) }}</text>
      <text x="70" y="84" class="donut-sub">{{ centerLabel }}</text>
    </svg>
    <ul class="donut-legend">
      <li v-for="p in parts" :key="p.key">
        <i class="sw" :class="`bg-${p.key}`" />
        <span>{{ p.label }}</span>
        <b>{{ eur(p.value) }}</b>
        <small>{{ p.count }}</small>
      </li>
    </ul>
  </div>
</template>
