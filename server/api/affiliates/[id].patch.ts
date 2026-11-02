import { getDb } from '../../utils/db'
import { backfillCommissions } from '../../utils/sync'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ commission_type?: string; commission_value?: number }>(event)
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'ID no válido' })
  if (body.commission_type !== 'percent' && body.commission_type !== 'fixed') {
    throw createError({ statusCode: 400, statusMessage: 'commission_type debe ser percent o fixed' })
  }
  const value = Number(body.commission_value)
  if (!Number.isFinite(value) || value < 0 || (body.commission_type === 'percent' && value > 100)) {
    throw createError({ statusCode: 400, statusMessage: 'commission_value no válido' })
  }
  const res = getDb()
    .prepare('UPDATE affiliates SET commission_type = ?, commission_value = ? WHERE id = ?')
    .run(body.commission_type, value, id)
  if (!res.changes) throw createError({ statusCode: 404, statusMessage: 'Afiliado no encontrado' })
  return { ok: true, backfilled: backfillCommissions(id) }
})
