<script setup lang="ts">
import { eur, int } from '~/utils/format'

const emit = defineEmits<{ message: [text: string]; changed: [] }>()
const { data: affiliates, refresh } = useApi<any[]>('/api/affiliates')
const q = ref('')
const rows = computed(() => {
  const term = q.value.trim().toLowerCase()
  const all = affiliates.value || []
  if (!term) return all
  return all.filter((a) =>
    [a.name, a.id, ...a.programs.flatMap((p: any) => [p.id, p.name]), ...a.sources.flatMap((s: any) => [s.url, s.name, s.country])]
      .some((v) => String(v ?? '').toLowerCase().includes(term))
  )
})

// Solo enlaces http(s): la URL viene de Tradedoubler y no debe poder ejecutar nada.
const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null)

// País del afiliado: el de sus webs según Tradedoubler (sin repetir).
const countries = (a: any): string[] => [...new Set<string>(a.sources.map((w: any) => w.country).filter(Boolean))]

async function saveRule(a: any) {
  try {
    const r = await apiCall('/api/affiliates/' + a.id, 'PATCH', { commission_type: a.commission_type, commission_value: Number(a.commission_value) })
    emit('message', r.backfilled ? `Regla guardada. ${r.backfilled} comisiones creadas.` : 'Regla guardada.')
    await refresh()
    emit('changed')
  } catch (e: any) {
    emit('message', `No se pudo guardar la regla: ${e?.data?.statusMessage || e?.message}. Revisa el valor e inténtalo de nuevo.`)
  }
}
</script>

<template>
  <section class="card">
    <header class="card-head">
      <div><h2>Afiliados</h2><p class="sub">Regla para calcular la comisión cuando se confirma la renovación: % sobre la renovación o importe fijo</p></div>
      <input v-model="q" class="input" type="search" placeholder="Buscar por nombre, ID o web" aria-label="Buscar afiliado por nombre, ID o web" />
    </header>
    <div class="table-wrap">
      <table class="table aff-table">
        <thead><tr><th>Affiliate ID</th><th>Nombre</th><th>Program ID</th><th>URL</th><th>País</th><th class="num">Ventas</th><th class="num">Comisión TD</th><th class="num">Comisión renovación</th><th>Regla de comisión</th></tr></thead>
        <tbody>
          <tr v-for="a in rows" :key="a.id">
            <td class="mono">{{ a.id }}</td>
            <td><b>{{ a.name || '—' }}</b></td>
            <td class="cell-list">
              <span v-for="p in a.programs" :key="p.id" :title="p.name"><span class="mono">{{ p.id }}</span><small class="muted block">{{ p.name }}{{ p.country ? ` · ${p.country}` : '' }}</small></span>
              <span v-if="!a.programs.length" class="muted">—</span>
            </td>
            <td class="cell-list">
              <span v-for="w in a.sources" :key="w.id">
                <a v-if="safeUrl(w.url)" :href="safeUrl(w.url)!" :title="w.url" target="_blank" rel="noopener noreferrer">{{ w.url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '') }}</a>
                <span v-else class="muted">{{ w.name || `Web ${w.id}` }} (sin URL)</span>
              </span>
              <span v-if="!a.sources.length" class="muted">—</span>
            </td>
            <td class="cell-list country-cell">
              <span v-for="c in countries(a)" :key="c" class="mono">{{ c }}</span>
              <span v-if="!countries(a).length" class="muted">—</span>
            </td>
            <td class="num">{{ int(a.sales) }}</td>
            <td class="num">{{ eur(a.td_commissions) }}</td>
            <td class="num">{{ eur(a.commissions) }}</td>
            <td class="rule-cell">
              <div class="rule">
                <select v-model="a.commission_type" class="input" :aria-label="`Tipo de regla de ${a.name || a.id}`">
                  <option value="percent">% renovación</option>
                  <option value="fixed">€ fijo</option>
                </select>
                <input v-model="a.commission_value" class="input num-input" type="number" min="0" step="0.01" :aria-label="`Valor de la regla de ${a.name || a.id}`" />
                <button class="btn" type="button" @click="saveRule(a)">Guardar</button>
              </div>
            </td>
          </tr>
          <tr v-if="affiliates && !rows.length"><td colspan="9" class="empty-line">No hay afiliados que coincidan.</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
