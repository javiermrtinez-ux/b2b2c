import { getDb } from '../../utils/db'
import { updateGlossary } from '../../utils/glossary'

/** Cambia cómo se presenta un campo (etiqueta, descripción, columna en Ventas, filtro). No toca ningún dato. */
export default defineEventHandler(async (event) => {
  const key = String(getRouterParam(event, 'key') || '')
  const body = (await readBody<Record<string, unknown>>(event)) || {}
  const patch: { label?: string; description?: string; visible?: boolean; filterable?: boolean } = {}
  if (typeof body.label === 'string') patch.label = body.label
  if (typeof body.description === 'string') patch.description = body.description
  if (typeof body.visible === 'boolean') patch.visible = body.visible
  if (typeof body.filterable === 'boolean') patch.filterable = body.filterable
  const row = updateGlossary(getDb(), key, patch)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Campo no encontrado' })
  return row
})
