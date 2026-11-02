import type { DatabaseSync } from 'node:sqlite'

/**
 * Glosario: todos los campos que da la API de Tradedoubler para esta cuenta (comprobado con una llamada real
 * el 2 nov 2026, rol de red). Es la fuente única de qué se guarda, qué se puede mostrar y qué se puede filtrar.
 * La etiqueta, la descripción y si se muestra o se filtra se pueden cambiar desde el panel (tabla glossary).
 * Solo cambian cómo se presenta el informe: los datos vienen siempre de Tradedoubler y no se editan aquí.
 */
export type FieldSource = 'latest' | 'history' | 'sources' | 'programs'
export type FieldType = 'text' | 'number' | 'bool' | 'date' | 'list'

export interface FieldDef {
  key: string
  /** Ruta en el elemento de la API (a.b para objetos anidados). */
  path: string
  label: string
  description: string
  group: string
  source: FieldSource
  type: FieldType
  /** Columna propia de la tabla sales (campos de siempre). */
  column?: string
  /** Dato personal del comprador: nunca se guarda ni se muestra. */
  personal?: boolean
  /** Se puede ofrecer como filtro (pocos valores distintos). */
  canFilter?: boolean
}

export const GROUPS = ['Venta', 'Afiliado y web', 'Anuncio y evento', 'Dispositivo', 'Estado y comisión', 'Producto y cupón', 'Fechas', 'Programa', 'Datos personales']

export const FIELDS: FieldDef[] = [
  // Venta (/latest: lo que ya guardamos)
  { key: 'transactionId', path: 'transactionId', label: 'ID de transacción', description: 'Identificador único de la transacción en Tradedoubler.', group: 'Venta', source: 'latest', type: 'text', column: 'transaction_id' },
  { key: 'timestamp', path: 'timestamp', label: 'Fecha de la venta', description: 'Cuándo se registró la venta.', group: 'Venta', source: 'latest', type: 'date', column: 'occurred_at' },
  { key: 'rxNumber', path: 'rxNumber', label: 'Nº de pedido', description: 'Número de pedido de la tienda. Solo viene en ventas, no en clics o leads.', group: 'Venta', source: 'latest', type: 'text', column: 'order_number' },
  { key: 'orderValue', path: 'orderValue', label: 'Importe', description: 'Importe del pedido. Solo viene en ventas.', group: 'Venta', source: 'latest', type: 'number', column: 'order_value' },
  { key: 'valid', path: 'valid', label: 'Válida', description: 'Si Tradedoubler la da por válida o la ha anulado.', group: 'Venta', source: 'latest', type: 'bool', column: 'valid' },
  { key: 'guid', path: 'guid', label: 'GUID', description: 'Identificador interno del evento en Tradedoubler.', group: 'Venta', source: 'latest', type: 'text' },
  // Programa
  { key: 'programId', path: 'programId', label: 'ID de programa', description: 'Programa de afiliación de la venta.', group: 'Programa', source: 'latest', type: 'number', column: 'program_id' },
  { key: 'programName', path: 'programName', label: 'Programa', description: 'Nombre del programa (p. ej. Kaspersky ES).', group: 'Programa', source: 'latest', type: 'text', column: 'program_name' },
  { key: 'programCountry', path: 'countryCode', label: 'País del programa', description: 'País del programa (endpoint de programas).', group: 'Programa', source: 'programs', type: 'text' },
  { key: 'programActive', path: 'active', label: 'Programa activo', description: 'Si el programa está activo, pausado o cerrado, con sus fechas de inicio y fin.', group: 'Programa', source: 'programs', type: 'bool' },
  // Afiliado y web
  { key: 'publisherOrganizationId', path: 'publisherOrganizationId', label: 'ID de afiliado', description: 'Empresa del afiliado.', group: 'Afiliado y web', source: 'latest', type: 'number', column: 'affiliate_id' },
  { key: 'publisherOrganizationName', path: 'publisherOrganizationName', label: 'Afiliado', description: 'Nombre de la empresa del afiliado.', group: 'Afiliado y web', source: 'latest', type: 'text' },
  { key: 'sourceId', path: 'sourceId', label: 'ID de web', description: 'Web o fuente del afiliado que generó la venta. Un afiliado puede tener varias.', group: 'Afiliado y web', source: 'latest', type: 'number' },
  { key: 'sourceName', path: 'sourceName', label: 'Web del afiliado', description: 'Nombre de la web o fuente del afiliado.', group: 'Afiliado y web', source: 'latest', type: 'text', canFilter: true },
  { key: 'sourceUrl', path: 'url', label: 'URL de la web', description: 'Dirección de la web del afiliado (endpoint de fuentes).', group: 'Afiliado y web', source: 'sources', type: 'text' },
  { key: 'sourceCountry', path: 'countryCode', label: 'País de la web', description: 'País de la web del afiliado (endpoint de fuentes).', group: 'Afiliado y web', source: 'sources', type: 'text' },
  { key: 'promotionType', path: 'promotionTypeName', label: 'Tipo de promoción', description: 'Cómo promociona el afiliado: cupones, comparador, contenido… (endpoint de fuentes).', group: 'Afiliado y web', source: 'sources', type: 'text' },
  { key: 'segmentName', path: 'segmentName', label: 'Segmento del afiliado', description: 'Segmento asignado en Tradedoubler.', group: 'Afiliado y web', source: 'history', type: 'text', canFilter: true },
  // Anuncio y evento
  { key: 'adId', path: 'adId', label: 'ID de anuncio', description: 'Anuncio o creatividad que llevó a la venta.', group: 'Anuncio y evento', source: 'latest', type: 'number' },
  { key: 'adName', path: 'adName', label: 'Anuncio', description: 'Nombre del anuncio o creatividad.', group: 'Anuncio y evento', source: 'history', type: 'text', canFilter: true },
  { key: 'eventId', path: 'eventId', label: 'ID de evento', description: 'Evento configurado en el programa.', group: 'Anuncio y evento', source: 'latest', type: 'number' },
  { key: 'eventName', path: 'eventName', label: 'Evento', description: 'Nombre del evento (venta, lead…).', group: 'Anuncio y evento', source: 'latest', type: 'text', canFilter: true },
  { key: 'eventTypeId', path: 'eventTypeId', label: 'Tipo de evento (ID)', description: '4 = lead, 5 = venta.', group: 'Anuncio y evento', source: 'latest', type: 'number' },
  { key: 'eventTypeName', path: 'eventTypeName', label: 'Tipo de evento', description: 'Lead o venta.', group: 'Anuncio y evento', source: 'latest', type: 'text', canFilter: true },
  // Dispositivo
  { key: 'deviceClass', path: 'device.dvClass', label: 'Tipo de dispositivo', description: 'Escritorio, móvil o tableta.', group: 'Dispositivo', source: 'latest', type: 'text', canFilter: true },
  { key: 'deviceName', path: 'device.dvName', label: 'Dispositivo', description: 'Modelo del dispositivo.', group: 'Dispositivo', source: 'latest', type: 'text' },
  { key: 'deviceBrand', path: 'device.dvBrand', label: 'Marca del dispositivo', description: 'Fabricante del dispositivo.', group: 'Dispositivo', source: 'latest', type: 'text', canFilter: true },
  { key: 'osName', path: 'device.osName', label: 'Sistema operativo', description: 'Windows, macOS, Android, iOS…', group: 'Dispositivo', source: 'latest', type: 'text', canFilter: true },
  { key: 'osVersion', path: 'device.osVersion', label: 'Versión del sistema', description: 'Versión del sistema operativo.', group: 'Dispositivo', source: 'latest', type: 'text' },
  { key: 'browser', path: 'device.agName', label: 'Navegador', description: 'Navegador o aplicación.', group: 'Dispositivo', source: 'latest', type: 'text', canFilter: true },
  { key: 'browserVersion', path: 'device.agVersion', label: 'Versión del navegador', description: 'Versión del navegador.', group: 'Dispositivo', source: 'latest', type: 'text' },
  { key: 'crossDevice', path: 'crossDevice', label: 'Multidispositivo', description: 'Si el clic y la compra fueron en dispositivos distintos.', group: 'Dispositivo', source: 'history', type: 'text', canFilter: true },
  // Estado y comisión (endpoint histórico)
  { key: 'status', path: 'status', label: 'Estado en Tradedoubler', description: 'Pendiente, aceptada o denegada.', group: 'Estado y comisión', source: 'history', type: 'text', column: 'td_status' },
  { key: 'paid', path: 'paid', label: 'Pagada', description: 'Si Tradedoubler ya ha pagado la comisión al afiliado.', group: 'Estado y comisión', source: 'history', type: 'bool', column: 'td_paid' },
  { key: 'commission', path: 'commission', label: 'Comisión del afiliado', description: 'Comisión real que cobra el afiliado según Tradedoubler.', group: 'Estado y comisión', source: 'history', type: 'number', column: 'td_commission' },
  { key: 'totalCommission', path: 'totalCommission', label: 'Comisión total', description: 'Comisión del afiliado más la de Tradedoubler.', group: 'Estado y comisión', source: 'history', type: 'number', column: 'td_total_commission' },
  { key: 'virtualCommission', path: 'virtualCommission', label: 'Comisión virtual', description: 'Comisión prevista mientras la venta está pendiente.', group: 'Estado y comisión', source: 'history', type: 'number' },
  { key: 'originalOrderValue', path: 'originalOrderValue', label: 'Importe original', description: 'Importe antes de correcciones del anunciante.', group: 'Estado y comisión', source: 'history', type: 'number' },
  { key: 'reasonName', path: 'reasonName', label: 'Motivo de denegación', description: 'Por qué se denegó (pedido cancelado, fraude…).', group: 'Estado y comisión', source: 'history', type: 'text', canFilter: true },
  { key: 'validationMethodName', path: 'validationMethodName', label: 'Método de validación', description: 'Cómo se valida la venta (manual, automático, API).', group: 'Estado y comisión', source: 'history', type: 'text', canFilter: true },
  { key: 'pendingRule', path: 'pendingRule', label: 'Regla de pendiente', description: 'Regla por la que la venta quedó pendiente.', group: 'Estado y comisión', source: 'history', type: 'text' },
  // Producto y cupón
  { key: 'voucherCode', path: 'voucherCode', label: 'Cupón', description: 'Código de descuento usado en la compra.', group: 'Producto y cupón', source: 'history', type: 'text' },
  { key: 'productInfo', path: 'productInfo', label: 'Productos', description: 'Productos del pedido: ID, nombre, cantidad, importe y grupo.', group: 'Producto y cupón', source: 'history', type: 'list' },
  { key: 'epi', path: 'epi', label: 'Subid 1 (EPI)', description: 'Etiqueta propia del afiliado para su campaña.', group: 'Producto y cupón', source: 'history', type: 'text' },
  { key: 'epi2', path: 'epi2', label: 'Subid 2 (EPI2)', description: 'Segunda etiqueta propia del afiliado.', group: 'Producto y cupón', source: 'history', type: 'text' },
  // Fechas (histórico)
  { key: 'timeOfLastClick', path: 'timeOfLastClick', label: 'Último clic', description: 'Cuándo hizo clic el comprador antes de comprar (tiempo hasta la compra).', group: 'Fechas', source: 'history', type: 'date' },
  { key: 'timeOfLastModified', path: 'timeOfLastModified', label: 'Última modificación', description: 'Cuándo cambió por última vez el estado.', group: 'Fechas', source: 'history', type: 'date' },
  // Datos personales: no se guardan
  { key: 'ipAddress', path: 'ipAddress', label: 'IP del comprador', description: 'Dato personal. No se guarda.', group: 'Datos personales', source: 'latest', type: 'text', personal: true },
  { key: 'ipCity', path: 'ipCity', label: 'Ciudad (por IP)', description: 'Dato personal. No se guarda.', group: 'Datos personales', source: 'latest', type: 'text', personal: true },
  { key: 'ipIsp', path: 'ipIsp', label: 'Proveedor de internet', description: 'Dato personal. No se guarda.', group: 'Datos personales', source: 'latest', type: 'text', personal: true },
  { key: 'ipCountry', path: 'ipCountry', label: 'País (por IP)', description: 'Dato del comprador. No se guarda.', group: 'Datos personales', source: 'latest', type: 'text', personal: true },
  { key: 'userAgent', path: 'userAgent', label: 'User agent', description: 'Huella del navegador del comprador. No se guarda.', group: 'Datos personales', source: 'latest', type: 'text', personal: true },
  { key: 'referrerUrl', path: 'referrerUrl', label: 'Página de origen', description: 'URL desde la que llegó el comprador; puede contener datos personales. No se guarda.', group: 'Datos personales', source: 'latest', type: 'text', personal: true }
]

const byKey = new Map(FIELDS.map((f) => [f.key, f]))

/**
 * Campos extra que la sincronización guarda en sales.extra: los de las transacciones (/latest y el histórico)
 * que no tienen columna propia ni son personales.
 */
export const STORED_EXTRA = FIELDS.filter(
  (f) => (f.source === 'latest' || f.source === 'history') && !f.column && !f.personal && f.key !== 'publisherOrganizationName'
)

function at(obj: unknown, path: string): unknown {
  return path.split('.').reduce<any>((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}

/** Saca de un elemento de la API los campos extra permitidos de ese endpoint, como JSON (null si no hay ninguno). */
export function extractExtra(item: unknown, source: 'latest' | 'history' = 'latest'): string | null {
  const out: Record<string, unknown> = {}
  for (const f of STORED_EXTRA) {
    if (f.source !== source) continue
    const v = at(item, f.path)
    if (v !== undefined && v !== null && v !== '') out[f.key] = v
  }
  return Object.keys(out).length ? JSON.stringify(out) : null
}

export interface GlossaryRow extends FieldDef {
  stored: boolean
  visible: boolean
  filterable: boolean
  /** Etiqueta y descripción originales, para poder volver a ellas. */
  defaultLabel: string
  defaultDescription: string
}

/** Glosario completo con lo que se haya cambiado desde el panel. */
export function getGlossary(db: DatabaseSync): GlossaryRow[] {
  const overrides = new Map(
    (db.prepare('SELECT key, label, description, visible, filterable FROM glossary').all() as any[]).map((r) => [r.key, r])
  )
  return FIELDS.map((f) => {
    const o = overrides.get(f.key)
    // Las de fuentes se guardan aparte, en la tabla sources (URL y datos de la web del afiliado).
    const stored = Boolean(f.column) || STORED_EXTRA.includes(f) || f.key === 'publisherOrganizationName' || f.source === 'sources'
    const extra = STORED_EXTRA.includes(f)
    return {
      ...f,
      label: o?.label || f.label,
      description: o?.description || f.description,
      defaultLabel: f.label,
      defaultDescription: f.description,
      stored,
      visible: extra ? Boolean(o?.visible ?? 0) : stored && !f.personal,
      filterable: extra && Boolean(f.canFilter) ? Boolean(o?.filterable ?? 1) : false
    }
  })
}

export function updateGlossary(
  db: DatabaseSync,
  key: string,
  patch: { label?: string; description?: string; visible?: boolean; filterable?: boolean }
) {
  const f = byKey.get(key)
  if (!f) return null
  const cur = getGlossary(db).find((g) => g.key === key)!
  const label = typeof patch.label === 'string' ? patch.label.trim().slice(0, 80) : cur.label
  const description = typeof patch.description === 'string' ? patch.description.trim().slice(0, 400) : cur.description
  const isExtra = STORED_EXTRA.includes(f)
  const visible = isExtra && typeof patch.visible === 'boolean' ? patch.visible : cur.visible
  const filterable = isExtra && f.canFilter && typeof patch.filterable === 'boolean' ? patch.filterable : cur.filterable
  db.prepare(
    `INSERT INTO glossary (key, label, description, visible, filterable) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET label = excluded.label, description = excluded.description,
       visible = excluded.visible, filterable = excluded.filterable`
  ).run(key, label === f.label ? null : label, description === f.description ? null : description, visible ? 1 : 0, filterable ? 1 : 0)
  return getGlossary(db).find((g) => g.key === key)!
}

/** Claves extra que se pueden usar como filtro ahora mismo. */
export function filterableKeys(db: DatabaseSync): string[] {
  return getGlossary(db).filter((g) => g.filterable).map((g) => g.key)
}
