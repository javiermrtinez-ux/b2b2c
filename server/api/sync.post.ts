import { processRenewals, syncSales } from '../utils/sync'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const sales = await syncSales(config)
  const renewals = await processRenewals(config)
  return { sales, renewals }
})
