<script setup lang="ts">
import { dayLabel, eur, int, monthLabel, renewalLabel, renewalTone, tdStatusLabel, tdStatusTone } from '~/utils/format'

/** Ficha de un afiliado (solo lectura): datos de Tradedoubler, ventas, comisiones y renovaciones. */
const props = defineProps<{ id: number }>()
const emit = defineEmits<{ close: [] }>()
const { headers } = useAdminToken()
const d = ref<any>(null)
const failed = ref(false)
watch(
  () => props.id,
  async (id) => {
    d.value = null
    failed.value = false
    try {
      d.value = await $fetch(`/api/affiliates/${id}`, { headers: headers.value })
    } catch {
      failed.value = true
    }
  },
  { immediate: true }
)
// Esc cierra la ficha.
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null)
const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
const tdTotal = computed(() => (d.value?.td || []).reduce((s: number, r: any) => s + r.amount, 0))
const tdPaid = computed(() => (d.value?.td || []).reduce((s: number, r: any) => s + r.paid, 0))
const renTotal = computed(() => (d.value?.renewalCommissions || []).reduce((s: number, r: any) => s + r.amount, 0))
const rate = computed(() => {
  const t = d.value?.totals
  const decided = (t?.renewed ?? 0) + (t?.not_renewed ?? 0)
  return decided ? Math.round((t.renewed / decided) * 100) : null
})
const maxMonth = computed(() => Math.max(1, ...(d.value?.monthly || []).map((m: any) => m.value)))
</script>

<template>
  <aside class="card aff-card drawer" aria-label="Ficha del afiliado">
    <header class="card-head">
      <div>
        <h2>{{ d?.affiliate?.name || 'Afiliado' }}</h2>
        <p class="sub">Affiliate ID <span class="mono">{{ id }}</span></p>
      </div>
      <button class="icon-btn" type="button" aria-label="Cerrar ficha" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      </button>
    </header>

    <p v-if="failed" class="empty-line">No se pudo cargar la ficha de este afiliado.</p>
    <p v-else-if="!d" class="empty-line">Cargando…</p>
    <template v-else>
      <dl class="aff-stats">
        <div><dt>Ventas válidas</dt><dd>{{ int(d.totals.valid ?? 0) }}</dd></div>
        <div><dt>Importe válido</dt><dd>{{ eur(d.totals.revenue) }}</dd></div>
        <div><dt>Anuladas</dt><dd>{{ int(d.totals.invalid ?? 0) }}</dd></div>
        <div><dt>Tasa de renovación</dt><dd>{{ rate == null ? '—' : `${rate} %` }}</dd></div>
      </dl>
      <p class="sub">
        Primera venta {{ d.totals.first_sale ? dayLabel(d.totals.first_sale) : '—' }} · última {{ d.totals.last_sale ? dayLabel(d.totals.last_sale) : '—' }} ·
        {{ int(d.totals.orders ?? 0) }} pedidos en {{ int(d.totals.transactions ?? 0) }} transacciones
      </p>

      <h3 class="order-sub">Ventas de los últimos 12 meses</h3>
      <div class="aff-bars" role="img" :aria-label="d.monthly.map((m: any) => `${monthLabel(m.month)} ${eur(m.value)}`).join('; ')">
        <div v-for="m in d.monthly" :key="m.month" class="aff-bar" :title="`${monthLabel(m.month)}: ${eur(m.value)} (${m.count})`">
          <i :style="{ height: `${Math.max(2, (m.value / maxMonth) * 100)}%` }" :class="{ zero: !m.value }" />
          <small>{{ monthLabel(m.month).slice(0, 1) }}</small>
        </div>
      </div>

      <h3 class="order-sub">Webs</h3>
      <ul class="aff-list">
        <li v-for="w in d.sources" :key="w.id">
          <a v-if="safeUrl(w.url)" :href="safeUrl(w.url)!" target="_blank" rel="noopener noreferrer">{{ host(w.url) }}</a>
          <b v-else>{{ w.name || `Web ${w.id}` }}</b>
          <small class="muted">ID {{ w.id }}<template v-if="w.country"> · {{ w.country }}</template><template v-if="w.promotion_type"> · {{ w.promotion_type }}</template> · {{ int(w.sales) }} ventas</small>
        </li>
        <li v-if="!d.sources.length" class="muted">Sin webs todavía: llegan con la sincronización.</li>
      </ul>

      <h3 class="order-sub">Programas</h3>
      <ul class="aff-list">
        <li v-for="p in d.programs" :key="p.id">
          <span><span class="mono">{{ p.id }}</span> {{ p.name }}<template v-if="p.country"> · {{ p.country }}</template></span>
          <small class="muted">{{ int(p.sales) }} transacciones · {{ eur(p.revenue) }}<template v-if="p.active === 0"> · inactivo</template></small>
        </li>
      </ul>

      <h3 class="order-sub">Comisiones</h3>
      <dl class="kv">
        <dt>Tradedoubler</dt><dd><b>{{ eur(tdTotal) }}</b> · pagado {{ eur(tdPaid) }}</dd>
        <template v-for="r in d.td" :key="r.status">
          <dt class="indent">{{ tdStatusLabel[r.status] || 'Sin estado' }}</dt><dd>{{ eur(r.amount) }} ({{ r.count }})</dd>
        </template>
        <dt>Por renovación</dt>
        <dd>
          <b>{{ eur(renTotal) }}</b> ·
          regla {{ d.affiliate.commission_type === 'fixed' ? `${eur(d.affiliate.commission_value)} fijo` : `${d.affiliate.commission_value} %` }}
        </dd>
        <dt>Renovaciones pendientes</dt><dd>{{ int(d.totals.pending_renewals ?? 0) }}</dd>
      </dl>

      <template v-if="d.countries.length || d.devices.length">
        <h3 class="order-sub">Compradores</h3>
        <dl class="kv">
          <template v-if="d.countries.length"><dt>País</dt><dd>{{ d.countries.map((c: any) => `${c.label} (${c.count})`).join(', ') }}</dd></template>
          <template v-if="d.devices.length"><dt>Dispositivo</dt><dd>{{ d.devices.map((c: any) => `${c.label} (${c.count})`).join(', ') }}</dd></template>
        </dl>
      </template>

      <h3 class="order-sub">Últimas ventas</h3>
      <ul class="aff-list">
        <li v-for="s in d.latest" :key="s.transaction_id">
          <span><span class="mono">{{ s.order_number || s.transaction_id }}</span> · {{ eur(s.order_value) }}</span>
          <small class="muted">
            {{ dayLabel(s.occurred_at) }} ·
            <template v-if="!s.valid">Anulada</template>
            <template v-else>{{ renewalLabel[s.renewal_status] }}</template>
            <template v-if="s.td_status"> · TD {{ tdStatusLabel[s.td_status].toLowerCase() }}</template>
          </small>
        </li>
      </ul>
    </template>
  </aside>
</template>
