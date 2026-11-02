<script setup lang="ts">
import type { Report } from '~/server/utils/report'
import { dayLabel, eur, int, renewalLabel, renewalTone } from '~/utils/format'

const props = defineProps<{ report: Report | null | undefined }>()
const emit = defineEmits<{ go: [tab: string] }>()

const ICONS = {
  sales: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>',
  revenue: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  renew: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  rate: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  comm: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'
}

const r = computed(() => props.report)
const commissionParts = computed(() =>
  r.value
    ? (['pending', 'approved', 'paid'] as const).map((k) => ({
        key: k,
        label: { pending: 'Pendientes', approved: 'Aprobadas', paid: 'Pagadas' }[k],
        value: r.value!.commissions[k].amount,
        count: r.value!.commissions[k].count
      }))
    : []
)
const horizon = computed(() =>
  r.value
    ? [
        { label: '30 días', n: r.value.upcoming.in30 },
        { label: '60 días', n: r.value.upcoming.in60 },
        { label: '90 días', n: r.value.upcoming.in90 }
      ]
    : []
)
const horizonMax = computed(() => Math.max(1, ...horizon.value.map((h) => h.n)))
</script>

<template>
  <div v-if="r" class="dash">
    <section class="kpi-grid" aria-label="Indicadores">
      <PanelKpiCard label="Ventas válidas" :value="int(r.kpis.sales.value)" :delta="r.kpis.sales.delta" hint="frente al periodo anterior" :icon="ICONS.sales" />
      <PanelKpiCard label="Importe vendido" :value="eur(r.kpis.revenue.value)" :delta="r.kpis.revenue.delta" hint="frente al periodo anterior" :icon="ICONS.revenue" />
      <PanelKpiCard label="Renovaciones pendientes" :value="int(r.kpis.pendingRenewals.value)" :hint="`${int(r.upcoming.in30)} en los próximos 30 días`" :icon="ICONS.renew" />
      <PanelKpiCard
        label="Tasa de renovación"
        :value="r.kpis.renewalRate.value == null ? '—' : `${r.kpis.renewalRate.value.toLocaleString('es-ES')} %`"
        :hint="r.kpis.renewalRate.decided ? `de ${int(r.kpis.renewalRate.decided)} con respuesta` : 'aún sin respuestas'"
        :icon="ICONS.rate"
      />
      <PanelKpiCard label="Comisiones pendientes" :value="eur(r.kpis.pendingCommissions.value)" :hint="`${int(r.kpis.pendingCommissions.count)} por aprobar`" :icon="ICONS.comm" />
    </section>

    <section class="card span-8">
      <header class="card-head">
        <div><h2>Evolución de ventas</h2><p class="sub">Ventas válidas y anuladas por mes, con el importe válido</p></div>
      </header>
      <PanelPipelineChart :rows="r.monthly" />
    </section>

    <section class="card span-4">
      <header class="card-head"><div><h2>Ventas por programa</h2><p class="sub">Importe válido del periodo</p></div></header>
      <PanelBarList :rows="r.byProgram" colored empty="Aún no hay ventas en este periodo." />
    </section>

    <section class="card span-4">
      <header class="card-head">
        <div><h2>Próximas renovaciones</h2><p class="sub">Ventas válidas que vencen pronto</p></div>
      </header>
      <ul class="horizon">
        <li v-for="h in horizon" :key="h.label">
          <span>{{ h.label }}</span>
          <span class="horizon-track" aria-hidden="true"><span :style="{ width: `${(h.n / horizonMax) * 100}%` }" /></span>
          <b>{{ int(h.n) }}</b>
        </li>
      </ul>
      <ul v-if="r.upcoming.next.length" class="mini-list">
        <li v-for="s in (r.upcoming.next as any[])" :key="s.transaction_id">
          <div><b>{{ s.affiliate_name }}</b><small>{{ s.order_number || s.transaction_id }}</small></div>
          <div class="right"><span>{{ dayLabel(s.renewal_due_at) }}</span><small>{{ eur(s.order_value) }}</small></div>
        </li>
      </ul>
      <p v-else class="empty-line">No hay renovaciones pendientes.</p>
    </section>

    <section class="card span-4">
      <header class="card-head">
        <div><h2>Afiliados por volumen</h2><p class="sub">Los 8 con más importe en el periodo</p></div>
        <button class="btn btn-ghost" type="button" @click="emit('go', 'affiliates')">Ver todos</button>
      </header>
      <PanelBarList :rows="r.topAffiliates" empty="Aún no hay afiliados con ventas en este periodo." />
    </section>

    <section class="card span-4">
      <header class="card-head">
        <div><h2>Comisiones</h2><p class="sub">Importe por estado, todas las fechas</p></div>
        <button class="btn btn-ghost" type="button" @click="emit('go', 'commissions')">Gestionar</button>
      </header>
      <PanelDonutChart :parts="commissionParts" center-label="en comisiones" />
    </section>

    <section class="card span-12">
      <header class="card-head">
        <div><h2>Últimas ventas</h2><p class="sub">Las 8 más recientes</p></div>
        <button class="btn btn-ghost" type="button" @click="emit('go', 'sales')">Ver todas</button>
      </header>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Fecha</th><th>Afiliado</th><th>Programa</th><th>Pedido</th><th class="num">Importe</th><th>Estado</th></tr></thead>
          <tbody>
            <tr v-for="s in (r.latest as any[])" :key="s.transaction_id">
              <td>{{ dayLabel(s.occurred_at) }}</td>
              <td><b>{{ s.affiliate_name }}</b></td>
              <td>{{ s.program_name || '—' }}</td>
              <td class="mono">{{ s.order_number || '—' }}</td>
              <td class="num">{{ eur(s.order_value) }}</td>
              <td>
                <PanelStatusChip v-if="!s.valid" tone="err" label="Anulada" />
                <PanelStatusChip v-else :tone="renewalTone[s.renewal_status]" :label="renewalLabel[s.renewal_status]" />
              </td>
            </tr>
            <tr v-if="!r.latest.length"><td colspan="6" class="empty-line">Aún no hay ventas. Pulsa «Sincronizar ahora» para traerlas de Tradedoubler.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
