import { timingSafeEqual } from 'node:crypto'

/** Protege /api con ADMIN_TOKEN (cabecera x-admin-token). En desarrollo sin token queda abierto. */
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/')) return
  const expected = useRuntimeConfig(event).adminToken
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      throw createError({ statusCode: 503, statusMessage: 'ADMIN_TOKEN no configurado' })
    }
    return
  }
  const got = getHeader(event, 'x-admin-token') || ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 401, statusMessage: 'No autorizado' })
  }
})
