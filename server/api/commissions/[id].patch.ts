import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { status } = await readBody<{ status?: string }>(event)
  if (!Number.isInteger(id) || !['pending', 'approved', 'paid'].includes(status ?? '')) {
    throw createError({ statusCode: 400, statusMessage: 'Datos no válidos' })
  }
  const res = getDb().prepare('UPDATE commissions SET status = ? WHERE id = ?').run(status!, id)
  if (!res.changes) throw createError({ statusCode: 404, statusMessage: 'Comisión no encontrada' })
  return { ok: true }
})
