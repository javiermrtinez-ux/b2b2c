<script setup lang="ts">
import { commissionLabel, commissionTone, dayLabel, eur, tdStatusLabel, tdStatusTone } from '~/utils/format'

// Solo lectura: el panel recoge datos e informa. Nada de aquí se cambia a mano.
const source = ref<'renewal' | 'td'>('renewal')
const filter = ref('')
const { data: list } = useApi<any[]>(() => `/api/commissions?source=${source.value}`, [source])
watch(source, () => { filter.value = '' })

const labels = computed(() => (source.value === 'td' ? tdStatusLabel : commissionLabel))
const statusOf = (c: any) => (source.value === 'td' ? c.td_status : c.status)
const rows = computed(() => (list.value || []).filter((c) => !filter.value || statusOf(c) === filter.value))
const total = computed(() => rows.value.reduce((s, c) => s + Number(source.value === 'td' ? c.td_commission : c.amount || 0), 0))
</script>

<template>
  <section class="card">
    <header class="card-head wrap">
      <div>
        <h2>Comisiones</h2>
        <p v-if="source === 'renewal'" class="sub">Calculadas con la regla de cada afiliado cuando se confirma la renovación del pedido</p>
        <p v-else class="sub">Comisión de la venta original según Tradedoubler (solo informativa)</p>
      </div>
      <div class="head-tools">
        <div class="seg seg-sm" role="group" aria-label="Origen de la comisión">
          <button type="button" :class="{ on: source === 'renewal' }" :aria-pressed="source === 'renewal'" @click="source = 'renewal'">Por renovación</button>
          <button type="button" :class="{ on: source === 'td' }" :aria-pressed="source === 'td'" @click="source = 'td'">Tradedoubler</button>
        </div>
        <div class="seg seg-sm" role="group" aria-label="Filtrar por estado">
          <button type="button" :class="{ on: !filter }" :aria-pressed="!filter" @click="filter = ''">Todas</button>
          <button v-for="(l, k) in labels" :key="k" type="button" :class="{ on: filter === k }" :aria-pressed="filter === k" @click="filter = String(k)">{{ l }}</button>
        </div>
      </div>
    </header>
    <p class="metric"><b>{{ eur(total) }}</b> en {{ rows.length }} {{ rows.length === 1 ? 'comisión' : 'comisiones' }}</p>
    <div class="table-wrap">
      <table v-if="source === 'renewal'" class="table">
        <thead><tr><th>Fecha</th><th>Afiliado</th><th>Pedido</th><th class="num">Renovación</th><th>Regla</th><th class="num">Comisión</th><th>Estado</th></tr></thead>
        <tbody>
          <tr v-for="c in rows" :key="c.id">
            <td>{{ dayLabel(c.created_at) }}</td>
            <td><b>{{ c.affiliate_name || c.affiliate_id }}</b></td>
            <td class="mono">{{ c.order_number || '—' }}</td>
            <td class="num">{{ eur(c.base_amount) }}</td>
            <td>{{ c.rule_type === 'fixed' ? `${eur(c.rule_value)} fijo` : `${Number(c.rule_value).toLocaleString('es-ES')} %` }}</td>
            <td class="num"><b>{{ eur(c.amount) }}</b></td>
            <td><PanelStatusChip :tone="commissionTone[c.status] || 'muted'" :label="commissionLabel[c.status] || c.status" /></td>
          </tr>
          <tr v-if="list && !rows.length"><td colspan="7" class="empty-line">No hay comisiones con este filtro.</td></tr>
        </tbody>
      </table>
      <table v-else class="table">
        <thead><tr><th>Fecha</th><th>Afiliado</th><th>Programa</th><th>Pedido</th><th class="num">Importe</th><th class="num">Comisión</th><th class="num">Total (con Tradedoubler)</th><th>Estado</th><th>Pagada</th></tr></thead>
        <tbody>
          <tr v-for="c in rows" :key="c.transaction_id">
            <td>{{ dayLabel(c.occurred_at) }}</td>
            <td><b>{{ c.affiliate_name || c.affiliate_id }}</b></td>
            <td>{{ c.program_name || '—' }}</td>
            <td class="mono">{{ c.order_number || '—' }}</td>
            <td class="num">{{ eur(c.order_value) }}</td>
            <td class="num"><b>{{ eur(c.td_commission) }}</b></td>
            <td class="num">{{ c.td_total_commission == null ? '—' : eur(c.td_total_commission) }}</td>
            <td><PanelStatusChip v-if="c.td_status" :tone="tdStatusTone[c.td_status]" :label="tdStatusLabel[c.td_status]" /><span v-else class="muted">—</span></td>
            <td>{{ c.td_paid == null ? '—' : c.td_paid ? 'Sí' : 'No' }}</td>
          </tr>
          <tr v-if="list && !rows.length"><td colspan="9" class="empty-line">Aún no hay comisiones de Tradedoubler. Llegan con la siguiente sincronización.</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
