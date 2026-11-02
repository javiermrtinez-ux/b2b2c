<script setup lang="ts">
import { commissionLabel, dayLabel, eur } from '~/utils/format'

const emit = defineEmits<{ message: [text: string]; changed: [] }>()
const { data: commissions, refresh } = useApi<any[]>('/api/commissions')
const filter = ref('')
const rows = computed(() => (commissions.value || []).filter((c) => !filter.value || c.status === filter.value))

async function setStatus(c: any, status: string) {
  try {
    await apiCall(`/api/commissions/${c.id}`, 'PATCH', { status })
    await refresh()
    emit('changed')
  } catch (e: any) {
    emit('message', `No se pudo cambiar el estado: ${e?.data?.statusMessage || e?.message}.`)
  }
}
</script>

<template>
  <section class="card">
    <header class="card-head">
      <div><h2>Comisiones</h2><p class="sub">Se crean al confirmarse la renovación de una venta</p></div>
      <div class="seg" role="group" aria-label="Filtrar por estado">
        <button type="button" :class="{ on: !filter }" @click="filter = ''">Todas</button>
        <button v-for="(l, k) in commissionLabel" :key="k" type="button" :class="{ on: filter === k }" @click="filter = k">{{ l }}</button>
      </div>
    </header>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Fecha</th><th>Afiliado</th><th>Pedido</th><th class="num">Base</th><th class="num">Comisión</th><th>Estado</th></tr></thead>
        <tbody>
          <tr v-for="c in rows" :key="c.id">
            <td>{{ dayLabel(c.created_at) }}</td>
            <td><b>{{ c.affiliate_name || c.affiliate_id }}</b></td>
            <td class="mono">{{ c.order_number || '—' }}</td>
            <td class="num">{{ eur(c.base_amount) }}</td>
            <td class="num"><b>{{ eur(c.amount) }}</b></td>
            <td>
              <select class="input" :value="c.status" :aria-label="`Estado de la comisión ${c.id}`" @change="setStatus(c, ($event.target as HTMLSelectElement).value)">
                <option v-for="(l, k) in commissionLabel" :key="k" :value="k">{{ l }}</option>
              </select>
            </td>
          </tr>
          <tr v-if="commissions && !rows.length"><td colspan="6" class="empty-line">No hay comisiones con este estado.</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
