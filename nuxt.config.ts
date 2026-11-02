export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: { '0 */6 * * *': ['sync'] }
  },
  // Solo valores por defecto: los reales llegan en ejecución por NUXT_* (ver .env.example).
  // Leer process.env aquí los congelaría en el build y el servidor ignoraría el entorno.
  runtimeConfig: {
    adminToken: '',
    td: {
      clientId: '',
      clientSecret: '',
      refreshToken: '',
      username: '',
      password: '',
      sourceId: '',
      programId: '',
      eventTypeIds: '',
      syncFrom: '2025-01-01'
    },
    renewalDays: 365,
    partner: {
      mode: 'mock',
      url: '',
      key: ''
    }
  }
})
