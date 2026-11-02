import { processRenewals, syncSales } from '../utils/sync'

export default defineTask({
  meta: { name: 'sync', description: 'Sincroniza ventas de Tradedoubler y procesa renovaciones' },
  async run() {
    const config = useRuntimeConfig()
    const sales = await syncSales(config)
    const renewals = await processRenewals(config)
    return { result: { sales, renewals } }
  }
})
