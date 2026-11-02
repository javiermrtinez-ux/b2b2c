export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: { '0 */6 * * *': ['sync'] }
  },
  runtimeConfig: {
    adminToken: process.env.ADMIN_TOKEN || '',
    td: {
      clientId: process.env.TD_CLIENT_ID || '',
      clientSecret: process.env.TD_CLIENT_SECRET || '',
      refreshToken: process.env.TD_REFRESH_TOKEN || '',
      sourceId: process.env.TD_SOURCE_ID || '',
      programId: process.env.TD_PROGRAM_ID || '',
      eventTypeIds: process.env.TD_EVENT_TYPE_IDS || '',
      syncFrom: process.env.TD_SYNC_FROM || '2025-01-01'
    },
    renewalDays: Number(process.env.RENEWAL_DAYS || 365),
    partner: {
      mode: process.env.PARTNER_MODE || 'mock',
      url: process.env.PARTNER_API_URL || '',
      key: process.env.PARTNER_API_KEY || ''
    }
  }
})
