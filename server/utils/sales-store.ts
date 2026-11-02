import type { DatabaseSync } from 'node:sqlite'
import type { TdTransaction } from './tradedoubler-core'

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
    INSERT INTO sales (transaction_id, occurred_at, program_id, program_name, affiliate_id, order_number, order_value, valid, renewal_due_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(transaction_id) DO UPDATE SET valid = excluded.valid, order_value = excluded.order_value
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
        new Date(occurred.getTime() + renewalDays * DAY).toISOString()
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
