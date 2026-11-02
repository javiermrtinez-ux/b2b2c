<script setup lang="ts">
/**
 * Glosario: todos los campos que puede dar Tradedoubler, agrupados. Se puede cambiar cómo se llaman y se
 * explican, si salen como columna en Ventas y si se ofrecen como filtro. Los datos en sí no se editan.
 */
const emit = defineEmits<{ message: [text: string] }>()
const { data, refresh } = useApi<{ groups: string[]; fields: any[] }>('/api/glossary')
const q = ref('')
const only = ref<'all' | 'stored' | 'more'>('all')

const SOURCE: Record<string, { label: string; tone: string; title: string }> = {
  latest: { label: 'Se sincroniza', tone: 'ok', title: 'Llega en cada sincronización (transacciones recientes).' },
  history: { label: 'Histórico', tone: 'ok', title: 'Llega en cada sincronización desde el histórico de transacciones.' },
  sources: { label: 'Fuentes', tone: 'ok', title: 'Llega en cada sincronización desde el endpoint de fuentes; se ve en Afiliados.' },
  programs: { label: 'Programas', tone: 'info', title: 'Lo da el endpoint de programas; aún no se guarda en cada venta.' }
}
const TYPE: Record<string, string> = { text: 'Texto', number: 'Número', bool: 'Sí / No', date: 'Fecha', list: 'Lista' }

const groups = computed(() => {
  const term = q.value.trim().toLowerCase()
  const rows = (data.value?.fields || []).filter((f) => {
    if (only.value === 'stored' && !f.stored) return false
    if (only.value === 'more' && (f.stored || f.personal)) return false
    return !term || `${f.label} ${f.description} ${f.path}`.toLowerCase().includes(term)
  })
  return (data.value?.groups || []).map((g) => ({ name: g, rows: rows.filter((f) => f.group === g) })).filter((g) => g.rows.length)
})
const counts = computed(() => {
  const f = data.value?.fields || []
  return { total: f.length, stored: f.filter((x) => x.stored).length, personal: f.filter((x) => x.personal).length }
})

async function save(f: any, patch: Record<string, unknown>) {
  try {
    await apiCall(`/api/glossary/${f.key}`, 'PATCH', patch)
    await refresh()
  } catch (e: any) {
    emit('message', `No se pudo guardar «${f.label}»: ${e?.data?.statusMessage || e?.message}.`)
  }
}
function saveText(f: any, field: 'label' | 'description', ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  if (v && v !== f[field]) save(f, { [field]: v })
}
const extraField = (f: any) => f.stored && !f.column && !f.personal && f.key !== 'publisherOrganizationName'
</script>

<template>
  <section class="card">
    <header class="card-head wrap">
      <div>
        <h2>Glosario</h2>
        <p class="sub">
          {{ counts.total }} campos de la API de Tradedoubler: {{ counts.stored }} se guardan en cada venta y {{ counts.personal }} son datos personales que no se guardan.
          Aquí cambias cómo se llaman y se presentan en el informe; los datos no se modifican.
        </p>
      </div>
      <div class="head-tools">
        <div class="seg seg-sm" role="group" aria-label="Qué campos ver">
          <button type="button" :class="{ on: only === 'all' }" :aria-pressed="only === 'all'" @click="only = 'all'">Todos</button>
          <button type="button" :class="{ on: only === 'stored' }" :aria-pressed="only === 'stored'" @click="only = 'stored'">Se guardan</button>
          <button type="button" :class="{ on: only === 'more' }" :aria-pressed="only === 'more'" @click="only = 'more'">Disponibles aparte</button>
        </div>
        <input v-model="q" class="input" type="search" placeholder="Buscar campo" aria-label="Buscar campo" />
      </div>
    </header>

    <div v-for="g in groups" :key="g.name" class="gl-group">
      <h3>{{ g.name }}</h3>
      <div class="table-wrap">
        <table class="table gl-table">
          <thead>
            <tr><th>Nombre en el panel</th><th>Descripción</th><th>Campo de la API</th><th>Tipo</th><th>Origen</th><th>Columna en Ventas</th><th>Filtro</th></tr>
          </thead>
          <tbody>
            <tr v-for="f in g.rows" :key="f.key" :class="{ off: f.personal }">
              <td>
                <input v-if="!f.personal" class="input gl-input" :value="f.label" maxlength="80" :aria-label="`Nombre de ${f.defaultLabel}`" @change="saveText(f, 'label', $event)" />
                <b v-else>{{ f.label }}</b>
                <button v-if="f.label !== f.defaultLabel" class="link gl-undo" type="button" @click="save(f, { label: f.defaultLabel })">Restaurar</button>
              </td>
              <td class="gl-desc">
                <textarea v-if="!f.personal" class="input gl-input" rows="2" :value="f.description" maxlength="400" :aria-label="`Descripción de ${f.label}`" @change="saveText(f, 'description', $event)" />
                <span v-else>{{ f.description }}</span>
              </td>
              <td class="mono">{{ f.path }}</td>
              <td>{{ TYPE[f.type] }}</td>
              <td>
                <PanelStatusChip v-if="f.personal" tone="err" label="Dato personal: no se guarda" />
                <span v-else :title="SOURCE[f.source].title"><PanelStatusChip :tone="SOURCE[f.source].tone" :label="SOURCE[f.source].label" /></span>
              </td>
              <td>
                <label v-if="extraField(f)" class="switch">
                  <input type="checkbox" :checked="f.visible" @change="save(f, { visible: ($event.target as HTMLInputElement).checked })" />
                  <span>{{ f.visible ? 'Visible' : 'Oculta' }}</span>
                </label>
                <span v-else class="muted">{{ f.stored && !f.personal ? 'Siempre' : '—' }}</span>
              </td>
              <td>
                <label v-if="extraField(f) && f.canFilter" class="switch">
                  <input type="checkbox" :checked="f.filterable" @change="save(f, { filterable: ($event.target as HTMLInputElement).checked })" />
                  <span>{{ f.filterable ? 'Activo' : 'No' }}</span>
                </label>
                <span v-else class="muted">{{ ['programId', 'publisherOrganizationId', 'timestamp'].includes(f.key) ? 'Siempre' : '—' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <p v-if="data && !groups.length" class="empty-line">Ningún campo coincide con la búsqueda.</p>
  </section>
</template>
