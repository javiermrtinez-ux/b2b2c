<script setup lang="ts">
import { dayLabel, eur, int, renewalLabel, renewalTone, tdStatusLabel, tdStatusTone } from '~/utils/format'

const { query } = useFilters()
const status = ref('')
const page = ref(0)
const PAGE = 50
const { data } = useApi<{ total: number; items: any[] }>(
  () => `/api/sales?limit=${PAGE}&offset=${page.value * PAGE}${status.value ? `&status=${status.value}` : ''}${query.value}`,
  [status, page, query]
)
watch([status, query], () => { page.value = 0 })

// Columnas extra: las que el Glosario marca como visibles.
const { data: glossary } = useApi<{ fields: any[] }>('/api/glossary')
const extraCols = computed(() => (glossary.value?.fields || []).filter((f) => f.visible && !f.column && f.key !== 'publisherOrganizationName'))
const show = (v: unknown) => (v === true ? 'Sí' : v === false ? 'No' : v == null || v === '' ? '—' : String(v))

// Histórico del pedido seleccionado.
const selected = ref<string | null>(null)
const detail = ref<any>(null)
const { headers } = useAdminToken()
watch(selected, async (id) => {
  detail.value = null
  if (!id) return
  try {
    detail.value = await $fetch(`/api/sales/${id}`, { headers: headers.value })
  } catch {
    detail.value = { error: true }
  }
})
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE)))
</script>

<template>
  <PanelFilterBar />
  <div class="sales-layout" :class="{ split: selected }">
    <section class="card">
      <header class="card-head wrap">
        <div><h2>Ventas</h2><p class="sub">{{ int(data?.total ?? 0) }} ventas de Tradedoubler con estos filtros. Pulsa una para ver su histórico.</p></div>
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
          <thead>
            <tr>
              <th>Fecha</th><th>Afiliado</th><th>Programa</th><th>Pedido</th><th class="num">Importe</th><th class="num">Comisión TD</th><th>Estado TD</th><th>Renueva</th><th>Renovación</th>
              <th v-for="c in extraCols" :key="c.key">{{ c.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in data?.items || []"
              :key="s.transaction_id"
              class="clickable"
              :class="{ off: !s.valid, sel: selected === s.transaction_id }"
              tabindex="0"
              :aria-label="`Ver histórico del pedido ${s.order_number || s.transaction_id}`"
              @click="selected = s.transaction_id"
              @keydown.enter="selected = s.transaction_id"
            >
              <td>{{ dayLabel(s.occurred_at) }}</td>
              <td><b>{{ s.affiliate_name || s.affiliate_id }}</b></td>
              <td>{{ s.program_name || '—' }}</td>
              <td class="mono">{{ s.order_number || '—' }}</td>
              <td class="num">{{ eur(s.order_value) }}</td>
              <td class="num">{{ s.td_commission == null ? '—' : eur(s.td_commission) }}</td>
              <td><PanelStatusChip v-if="s.td_status" :tone="tdStatusTone[s.td_status]" :label="tdStatusLabel[s.td_status]" /><span v-else class="muted">—</span></td>
              <td>{{ dayLabel(s.renewal_due_at) }}</td>
              <td>
                <PanelStatusChip v-if="!s.valid" tone="err" label="Anulada" />
                <PanelStatusChip v-else :tone="renewalTone[s.renewal_status]" :label="renewalLabel[s.renewal_status]" />
              </td>
              <td v-for="c in extraCols" :key="c.key">{{ show(s.extra[c.key]) }}</td>
            </tr>
            <tr v-if="data && !data.items.length"><td :colspan="9 + extraCols.length" class="empty-line">No hay ventas con estos filtros.</td></tr>
          </tbody>
        </table>
      </div>
      <footer class="pager">
        <button class="btn" type="button" :disabled="page === 0" @click="page--">Anterior</button>
        <span>Página {{ page + 1 }} de {{ pages }}</span>
        <button class="btn" type="button" :disabled="page + 1 >= pages" @click="page++">Siguiente</button>
      </footer>
    </section>

    <aside v-if="selected" class="card order-card" aria-label="Histórico del pedido">
      <header class="card-head">
        <div>
          <h2>Histórico del pedido</h2>
          <p class="sub mono">{{ detail?.sale?.order_number || selected }}</p>
        </div>
        <button class="icon-btn" type="button" aria-label="Cerrar histórico" @click="selected = null">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      </header>
      <template v-if="detail?.sale && detail.sale.transaction_id === selected">
        <ol class="timeline">
          <li>
            <b>Venta original · Tradedoubler</b>
            <span class="muted">{{ dayLabel(detail.sale.occurred_at) }} · {{ detail.sale.affiliate_name || detail.sale.affiliate_id }} · {{ detail.sale.program_name || '—' }}</span>
            <span>{{ eur(detail.sale.order_value) }}<template v-if="detail.sale.td_commission != null"> · comisión {{ eur(detail.sale.td_commission) }}</template></span>
            <span>
              <PanelStatusChip v-if="!detail.sale.valid" tone="err" label="Anulada" />
              <PanelStatusChip v-if="detail.sale.td_status" :tone="tdStatusTone[detail.sale.td_status]" :label="tdStatusLabel[detail.sale.td_status]" />
              <span v-if="detail.sale.td_paid != null" class="muted"> {{ detail.sale.td_paid ? 'Pagada por Tradedoubler' : 'Sin pagar en Tradedoubler' }}</span>
            </span>
          </li>
          <li v-for="(c, i) in detail.checks" :key="i">
            <b>Comprobación de renovación</b>
            <span class="muted">{{ dayLabel(c.checked_at) }} · {{ c.source === 'mock' ? 'conector simulado' : c.source }}</span>
            <span><PanelStatusChip :tone="renewalTone[c.status]" :label="renewalLabel[c.status]" /><template v-if="c.amount != null"> {{ eur(c.amount) }}</template></span>
          </li>
          <li v-if="!detail.checks.length">
            <b>Renovación</b>
            <span class="muted">Vence el {{ dayLabel(detail.sale.renewal_due_at) }}. Aún no se ha comprobado.</span>
          </li>
          <li v-if="detail.commission">
            <b>Comisión por renovación</b>
            <span class="muted">{{ dayLabel(detail.commission.created_at) }} · {{ detail.commission.rule_type === 'fixed' ? `${eur(detail.commission.rule_value)} fijo` : `${detail.commission.rule_value} % de ${eur(detail.commission.base_amount)}` }}</span>
            <span><b>{{ eur(detail.commission.amount) }}</b></span>
          </li>
        </ol>
        <h3 v-if="detail.fields.length" class="order-sub">Más datos de Tradedoubler</h3>
        <dl class="kv">
          <template v-for="f in detail.fields" :key="f.key">
            <dt>{{ f.label }}</dt><dd>{{ Array.isArray(f.value) ? `${f.value.length} elementos` : show(f.value) }}</dd>
          </template>
        </dl>
      </template>
      <p v-else-if="detail?.error" class="empty-line">No se pudo cargar el histórico de este pedido.</p>
      <p v-else class="empty-line">Cargando…</p>
    </aside>
  </div>
</template>
