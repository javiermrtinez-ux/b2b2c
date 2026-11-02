<script setup lang="ts">
const token = ref('')
const tab = ref<'sales' | 'affiliates' | 'commissions'>('sales')
const busy = ref(false)
const message = ref('')

onMounted(() => {
  try { token.value = sessionStorage.getItem('adminToken') || '' } catch {}
})
watch(token, (v) => { try { sessionStorage.setItem('adminToken', v) } catch {} })

const headers = computed<Record<string, string>>(() => (token.value ? { 'x-admin-token': token.value } : {}))
// La cabecera tiene que ser reactiva: un objeto fijo se quedaba sin token y todo daba 401.
// Solo en cliente: el token vive en sessionStorage y el servidor no lo conoce.
const opts = { headers, server: false }

const { data: summary, refresh: refreshSummary } = await useFetch<any>('/api/summary', opts)
const { data: sales, refresh: refreshSales } = await useFetch<any[]>('/api/sales', opts)
const { data: affiliates, refresh: refreshAffiliates } = await useFetch<any[]>('/api/affiliates', opts)
const { data: commissions, refresh: refreshCommissions } = await useFetch<any[]>('/api/commissions', opts)

const refreshAll = () => Promise.all([refreshSummary(), refreshSales(), refreshAffiliates(), refreshCommissions()])

async function api(url: string, method: 'POST' | 'PATCH', body?: object) {
  return $fetch<any>(url, { method, body, headers: headers.value })
}

async function sync() {
  busy.value = true
  message.value = ''
  try {
    const r = await api('/api/sync', 'POST')
    message.value = `Sincronizado (${r.sales.mode}): ${r.sales.imported} ventas, ${r.renewals.renewed} renovadas, ${r.renewals.commissions} comisiones nuevas.`
    await refreshAll()
  } catch (e: any) {
    message.value = `Error: ${e?.data?.statusMessage || e?.message}`
  } finally {
    busy.value = false
  }
}

async function saveRule(a: any) {
  const r = await api(`/api/affiliates/${a.id}`, 'PATCH', { commission_type: a.commission_type, commission_value: Number(a.commission_value) })
  message.value = r.backfilled ? `Regla guardada. ${r.backfilled} comisiones creadas.` : 'Regla guardada.'
  await refreshAll()
}

async function setStatus(c: any, status: string) {
  await api(`/api/commissions/${c.id}`, 'PATCH', { status })
  await refreshCommissions()
}

const eur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)
const day = (s: string) => (s ? s.slice(0, 10) : '')
const statusLabel: Record<string, string> = { pending: 'Pendiente', renewed: 'Renovada', not_renewed: 'No renovada', unknown: 'Sin respuesta' }
</script>

<template>
  <main>
    <header>
      <h1>Seguimiento de ventas</h1>
      <div class="actions">
        <input v-model="token" type="password" placeholder="Token de administración" autocomplete="off" />
        <button :disabled="busy" @click="sync">{{ busy ? 'Sincronizando…' : 'Sincronizar ahora' }}</button>
      </div>
    </header>
    <p v-if="message" class="msg">{{ message }}</p>

    <section v-if="summary" class="cards">
      <div><b>{{ summary.sales.total }}</b><span>ventas ({{ eur(summary.sales.value) }})</span></div>
      <div><b>{{ summary.renewals.pending ?? 0 }}</b><span>pendientes de renovar</span></div>
      <div><b>{{ summary.renewals.renewed ?? 0 }}</b><span>renovadas</span></div>
      <div><b>{{ eur(summary.commissions.amount) }}</b><span>comisiones ({{ summary.commissions.total }})</span></div>
    </section>
    <p v-if="summary" class="small">Última sincronización: {{ summary.lastSyncAt || 'nunca' }}</p>

    <nav>
      <button v-for="t in ['sales', 'affiliates', 'commissions'] as const" :key="t" :class="{ on: tab === t }" @click="tab = t">
        {{ { sales: 'Ventas', affiliates: 'Afiliados', commissions: 'Comisiones' }[t] }}
      </button>
    </nav>

    <table v-if="tab === 'sales'">
      <thead><tr><th>Fecha</th><th>Afiliado</th><th>Pedido</th><th>Importe</th><th>Renueva</th><th>Estado</th></tr></thead>
      <tbody>
        <tr v-for="s in sales" :key="s.transaction_id" :class="{ off: !s.valid }">
          <td>{{ day(s.occurred_at) }}</td><td>{{ s.affiliate_name || s.affiliate_id }}</td><td>{{ s.order_number }}</td>
          <td>{{ eur(s.order_value) }}</td><td>{{ day(s.renewal_due_at) }}</td>
          <td>{{ s.valid ? statusLabel[s.renewal_status] : 'Inválida' }}</td>
        </tr>
      </tbody>
    </table>

    <table v-if="tab === 'affiliates'">
      <thead><tr><th>Afiliado</th><th>Ventas</th><th>Comisiones</th><th>Regla</th><th></th></tr></thead>
      <tbody>
        <tr v-for="a in affiliates" :key="a.id">
          <td>{{ a.name || a.id }}</td><td>{{ a.sales }}</td><td>{{ eur(a.commissions) }}</td>
          <td>
            <select v-model="a.commission_type"><option value="percent">% sobre renovación</option><option value="fixed">€ fijo</option></select>
            <input v-model="a.commission_value" type="number" min="0" step="0.01" />
          </td>
          <td><button @click="saveRule(a)">Guardar</button></td>
        </tr>
      </tbody>
    </table>

    <table v-if="tab === 'commissions'">
      <thead><tr><th>Fecha</th><th>Afiliado</th><th>Pedido</th><th>Base</th><th>Comisión</th><th>Estado</th></tr></thead>
      <tbody>
        <tr v-for="c in commissions" :key="c.id">
          <td>{{ day(c.created_at) }}</td><td>{{ c.affiliate_name || c.affiliate_id }}</td><td>{{ c.order_number }}</td>
          <td>{{ eur(c.base_amount) }}</td><td>{{ eur(c.amount) }}</td>
          <td>
            <select :value="c.status" @change="setStatus(c, ($event.target as HTMLSelectElement).value)">
              <option value="pending">Pendiente</option><option value="approved">Aprobada</option><option value="paid">Pagada</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style>
:root { color-scheme: light dark; --bd: #8884; --ac: #2563eb; }
body { margin: 0; font: 15px/1.45 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
header { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; }
h1 { font-size: 22px; margin: 0; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
input, select, button { font: inherit; padding: 6px 10px; border: 1px solid var(--bd); border-radius: 6px; background: transparent; color: inherit; }
button { cursor: pointer; } button:disabled { opacity: .5; cursor: default; }
.actions button, nav .on { background: var(--ac); color: #fff; border-color: var(--ac); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 20px 0 4px; }
.cards div { border: 1px solid var(--bd); border-radius: 8px; padding: 12px 14px; }
.cards b { display: block; font-size: 22px; } .cards span { opacity: .7; font-size: 13px; }
.small { font-size: 12px; opacity: .6; margin: 4px 0 16px; } .msg { margin: 12px 0; }
nav { display: flex; gap: 6px; margin-bottom: 12px; }
table { width: 100%; border-collapse: collapse; display: block; overflow-x: auto; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--bd); white-space: nowrap; }
tr.off { opacity: .45; } td input[type=number] { width: 90px; }
</style>
