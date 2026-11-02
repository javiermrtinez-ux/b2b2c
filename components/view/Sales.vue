<script setup lang="ts">
import { dayLabel, eur, renewalLabel, renewalTone } from '~/utils/format'

const status = ref('')
const page = ref(0)
const PAGE = 50
const { data: sales } = useApi<any[]>(() => `/api/sales?limit=${PAGE}&offset=${page.value * PAGE}${status.value ? `&status=${status.value}` : ''}`, [status, page])
watch(status, () => { page.value = 0 })
</script>

<template>
  <section class="card">
    <header class="card-head">
      <div><h2>Ventas</h2><p class="sub">Todas las ventas sincronizadas desde Tradedoubler</p></div>
      <label class="field-inline">
        <span>Renovación</span>
        <select v-model="status" class="input">
          <option value="">Todas</option>
          <option v-for="(l, k) in renewalLabel" :key="k" :value="k">{{ l }}</option>
        </select>
      </label>
    </header>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Fecha</th><th>Afiliado</th><th>Programa</th><th>Pedido</th><th class="num">Importe</th><th>Renueva</th><th>Estado</th></tr></thead>
        <tbody>
          <tr v-for="s in sales" :key="s.transaction_id" :class="{ off: !s.valid }">
            <td>{{ dayLabel(s.occurred_at) }}</td>
            <td><b>{{ s.affiliate_name || s.affiliate_id }}</b></td>
            <td>{{ s.program_name || '—' }}</td>
            <td class="mono">{{ s.order_number || '—' }}</td>
            <td class="num">{{ eur(s.order_value) }}</td>
            <td>{{ dayLabel(s.renewal_due_at) }}</td>
            <td>
              <PanelStatusChip v-if="!s.valid" tone="err" label="Anulada" />
              <PanelStatusChip v-else :tone="renewalTone[s.renewal_status]" :label="renewalLabel[s.renewal_status]" />
            </td>
          </tr>
          <tr v-if="sales && !sales.length"><td colspan="7" class="empty-line">No hay ventas con este filtro.</td></tr>
        </tbody>
      </table>
    </div>
    <footer class="pager">
      <button class="btn" type="button" :disabled="page === 0" @click="page--">Anterior</button>
      <span>Página {{ page + 1 }}</span>
      <button class="btn" type="button" :disabled="!sales || sales.length < PAGE" @click="page++">Siguiente</button>
    </footer>
  </section>
</template>
