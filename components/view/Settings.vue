<script setup lang="ts">
import { dayLabel } from '~/utils/format'

defineProps<{ lastSyncAt: string | null | undefined; busy: boolean }>()
const emit = defineEmits<{ sync: [] }>()
const { token } = useAdminToken()
</script>

<template>
  <div class="settings">
    <section class="card">
      <header class="card-head"><div><h2>Acceso</h2><p class="sub">Token de administración (cabecera x-admin-token). Se guarda solo en esta pestaña del navegador.</p></div></header>
      <label class="field">
        <span>Token</span>
        <input v-model="token" class="input" type="password" autocomplete="off" placeholder="Pega aquí el token" />
      </label>
    </section>
    <section class="card">
      <header class="card-head"><div><h2>Tradedoubler</h2><p class="sub">Se sincroniza solo cada 6 horas. Puedes forzarlo aquí.</p></div></header>
      <p class="metric">Última sincronización: <b>{{ lastSyncAt ? dayLabel(lastSyncAt) : 'nunca' }}</b></p>
      <button class="btn btn-primary" type="button" :disabled="busy" @click="emit('sync')">{{ busy ? 'Sincronizando…' : 'Sincronizar ahora' }}</button>
    </section>
  </div>
</template>
