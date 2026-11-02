<script setup lang="ts">
/** Barra de filtros del informe: fechas, programa, afiliado y los campos que el Glosario marque como filtrables. */
const { filters, active, reset } = useFilters()
const { data: opts } = useApi<any>('/api/filters')
const open = ref(false)

const toYmd = (d: Date) => d.toISOString().slice(0, 10)
const PRESETS = [
  { key: '7', label: '7 días' },
  { key: '30', label: '30 días' },
  { key: 'month', label: 'Este mes' },
  { key: 'prev', label: 'Mes pasado' },
  { key: 'year', label: 'Este año' }
]
function preset(k: string) {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const set = (a: Date, b: Date) => { filters.value = { ...filters.value, from: toYmd(a), to: toYmd(b) } }
  if (k === '7' || k === '30') set(new Date(now.getTime() - (Number(k) - 1) * 86_400_000), now)
  else if (k === 'month') set(new Date(Date.UTC(y, m, 1)), now)
  else if (k === 'prev') set(new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(y, m, 0)))
  else set(new Date(Date.UTC(y, 0, 1)), now)
}
function setExtra(key: string, value: string) {
  const extra = { ...filters.value.extra }
  if (value) extra[key] = value
  else delete extra[key]
  filters.value = { ...filters.value, extra }
}
const valueLabel = (v: string) => (v === 'true' ? 'Sí' : v === 'false' ? 'No' : v)
</script>

<template>
  <section class="filterbar card" aria-label="Filtros del informe">
    <div class="fb-row">
      <button class="pill-btn fb-toggle" type="button" :aria-expanded="open" aria-controls="fb-more" @click="open = !open">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        Filtros<span v-if="active" class="fb-count">{{ active }}</span>
      </button>
      <label class="fb-field"><span>Desde</span><input v-model="filters.from" class="input" type="date" :max="filters.to || undefined" /></label>
      <label class="fb-field"><span>Hasta</span><input v-model="filters.to" class="input" type="date" :min="filters.from || undefined" /></label>
      <label class="fb-field">
        <span>Programa</span>
        <select v-model="filters.programId" class="input">
          <option value="">Todos</option>
          <option v-for="p in opts?.programs || []" :key="p.id" :value="String(p.id)">{{ p.label }}</option>
        </select>
      </label>
      <label class="fb-field">
        <span>Afiliado</span>
        <select v-model="filters.affiliateId" class="input">
          <option value="">Todos</option>
          <option v-for="a in opts?.affiliates || []" :key="a.id" :value="String(a.id)">{{ a.label }}</option>
        </select>
      </label>
      <button v-if="active" class="link fb-reset" type="button" @click="reset">Quitar filtros</button>
    </div>
    <div v-show="open" id="fb-more" class="fb-more">
      <div class="fb-presets" role="group" aria-label="Rangos rápidos">
        <button v-for="p in PRESETS" :key="p.key" class="pill-btn" type="button" @click="preset(p.key)">{{ p.label }}</button>
      </div>
      <div class="fb-row">
        <label v-for="x in opts?.extras || []" :key="x.key" class="fb-field">
          <span>{{ x.label }}</span>
          <select class="input" :value="filters.extra[x.key] || ''" @change="setExtra(x.key, ($event.target as HTMLSelectElement).value)">
            <option value="">Todos</option>
            <option v-for="v in x.values" :key="v.value" :value="v.value">{{ valueLabel(v.value) }} ({{ v.count }})</option>
          </select>
        </label>
        <p v-if="opts && !opts.extras.length" class="sub">No hay más campos filtrables con datos. Actívalos en Glosario.</p>
      </div>
    </div>
  </section>
</template>
