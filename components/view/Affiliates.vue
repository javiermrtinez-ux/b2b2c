<script setup lang="ts">
import { eur, int } from '~/utils/format'

const emit = defineEmits<{ message: [text: string]; changed: [] }>()
const { data: affiliates, refresh } = useApi<any[]>('/api/affiliates')
const q = ref('')
const rows = computed(() => {
  const term = q.value.trim().toLowerCase()
  const all = affiliates.value || []
  return term ? all.filter((a) => String(a.name || a.id).toLowerCase().includes(term)) : all
})

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
      <div><h2>Afiliados</h2><p class="sub">Regla de comisión por afiliado: % sobre la renovación o importe fijo</p></div>
      <input v-model="q" class="input" type="search" placeholder="Buscar afiliado" aria-label="Buscar afiliado" />
    </header>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Afiliado</th><th class="num">Ventas</th><th class="num">Comisiones</th><th>Regla</th><th /></tr></thead>
        <tbody>
          <tr v-for="a in rows" :key="a.id">
            <td><b>{{ a.name || a.id }}</b><small class="mono block">{{ a.id }}</small></td>
            <td class="num">{{ int(a.sales) }}</td>
            <td class="num">{{ eur(a.commissions) }}</td>
            <td>
              <div class="rule">
                <select v-model="a.commission_type" class="input" :aria-label="`Tipo de regla de ${a.name || a.id}`">
                  <option value="percent">% sobre renovación</option>
                  <option value="fixed">€ fijo</option>
                </select>
                <input v-model="a.commission_value" class="input num-input" type="number" min="0" step="0.01" :aria-label="`Valor de la regla de ${a.name || a.id}`" />
              </div>
            </td>
            <td class="num"><button class="btn" type="button" @click="saveRule(a)">Guardar</button></td>
          </tr>
          <tr v-if="affiliates && !rows.length"><td colspan="5" class="empty-line">No hay afiliados que coincidan.</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
