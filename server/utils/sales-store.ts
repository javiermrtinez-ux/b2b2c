import type { DatabaseSync } from 'node:sqlite'
import type { TdTransaction } from './tradedoubler-core'
import { extractExtra } from './glossary.ts'

const DAY = 86_400_000

/**
 * Guarda las transacciones como ventas. Es idempotente: transaction_id es la clave primaria y
 * repetir la sincronización solo actualiza estado e importe, nunca duplica.
 */
export function saveTransactions(db: DatabaseSync, txs: TdTransaction[], renewalDays: number): number {
  const upsertAffiliate = db.prepare(
    'INSERT INTO affiliates (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = COALESCE(excluded.name, name)'
  )
  const upsertSale = db.prepare(`
    INSERT INTO sales (transaction_id, occurred_at, program_id, program_name, affiliate_id, order_number, order_value, valid, renewal_due_at, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(transaction_id) DO UPDATE SET valid = excluded.valid, order_value = excluded.order_value,
      extra = CASE WHEN excluded.extra IS NULL THEN extra ELSE json_patch(COALESCE(extra, '{}'), excluded.extra) END
  `)

  let imported = 0
  db.exec('BEGIN')
  try {
    for (const t of txs) {
      // Solo cuentan como venta los eventos con importe de pedido.
      if (t.orderValue == null) continue
      const occurred = new Date(t.timestamp)
      if (Number.isNaN(occurred.getTime())) throw new Error(`Fecha no válida en la transacción ${t.transactionId}`)
      upsertAffiliate.run(t.publisherOrganizationId, t.publisherOrganizationName)
      upsertSale.run(
        t.transactionId,
        occurred.toISOString(),
        t.programId,
        t.programName,
        t.publisherOrganizationId,
        t.rxNumber,
        t.orderValue,
        t.valid ? 1 : 0,
        new Date(occurred.getTime() + renewalDays * DAY).toISOString(),
        // Campos extra del glosario (dispositivo, web, evento…). Nunca los datos personales del comprador.
        extractExtra(t)
      )
      imported++
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return imported
}

/** Estado de Tradedoubler normalizado: viene como texto («A», «P», «D» o la palabra completa). */
export function normalizeTdStatus(v: unknown): 'pending' | 'accepted' | 'denied' | null {
  const t = String(v ?? '').trim().toLowerCase()
  if (!t) return null
  if (t.startsWith('a')) return 'accepted'
  if (t.startsWith('p')) return 'pending'
  if (t.startsWith('d') || t.startsWith('r')) return 'denied'
  return null
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Completa las ventas ya guardadas con el histórico de Tradedoubler: comisión, estado, pago y los campos
 * extra que solo da ese endpoint. No crea ventas nuevas (eso es de /latest) ni guarda datos personales.
 */
export function applyHistory(db: DatabaseSync, items: unknown[], now = new Date()): number {
  const update = db.prepare(`
    UPDATE sales SET td_status = ?, td_paid = ?, td_commission = ?, td_total_commission = ?, td_checked_at = ?,
      extra = CASE WHEN ? IS NULL THEN extra ELSE json_patch(COALESCE(extra, '{}'), ?) END
    WHERE transaction_id = ?
  `)
  let n = 0
  db.exec('BEGIN')
  try {
    for (const raw of items) {
      const it = raw as Record<string, unknown>
      if (!it || it.transactionId == null) continue
      const extra = extractExtra(it, 'history')
      const res = update.run(
        normalizeTdStatus(it.status),
        typeof it.paid === 'boolean' ? (it.paid ? 1 : 0) : null,
        num(it.commission),
        num(it.totalCommission),
        now.toISOString(),
        extra,
        extra,
        String(it.transactionId)
      )
      n += Number(res.changes)
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return n
}

/**
 * Guarda las webs de los afiliados (/network/sources): id, nombre, URL, empresa, país y tipo de promoción.
 * No guarda el nombre ni el correo del responsable que también devuelve ese endpoint (datos personales).
 */
export function saveSources(db: DatabaseSync, items: unknown[], now = new Date()): number {
  const up = db.prepare(`
    INSERT INTO sources (id, name, url, publisher_org_id, country_code, promotion_type, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, url = excluded.url, publisher_org_id = excluded.publisher_org_id,
      country_code = excluded.country_code, promotion_type = excluded.promotion_type, synced_at = excluded.synced_at
  `)
  const str = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 500) : null)
  let n = 0
  db.exec('BEGIN')
  try {
    for (const raw of items) {
      const it = raw as Record<string, unknown>
      const id = Number(it?.id)
      if (!Number.isInteger(id)) continue
      const org = Number(it.publisherOrgId)
      up.run(id, str(it.name), str(it.url), Number.isInteger(org) ? org : null, str(it.countryCode), str(it.promotionTypeName), now.toISOString())
      n++
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return n
}

/** Guarda los programas de la red (/network/programs): nombre, país y si está activo. */
export function savePrograms(db: DatabaseSync, items: unknown[], now = new Date()): number {
  const up = db.prepare(`
    INSERT INTO programs (id, name, country_code, active, synced_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, country_code = excluded.country_code, active = excluded.active,
      synced_at = excluded.synced_at
  `)
  let n = 0
  db.exec('BEGIN')
  try {
    for (const raw of items) {
      const it = raw as Record<string, unknown>
      const id = Number(it?.id)
      if (!Number.isInteger(id)) continue
      up.run(
        id,
        typeof it.name === 'string' ? it.name.slice(0, 200) : null,
        typeof it.countryCode === 'string' ? it.countryCode.slice(0, 8) : null,
        typeof it.active === 'boolean' ? (it.active ? 1 : 0) : null,
        now.toISOString()
      )
      n++
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return n
}
