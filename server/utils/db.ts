import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

let db: DatabaseSync | undefined

export function getDb(): DatabaseSync {
  if (db) return db
  // DB_PATH permite sincronizar contra una base nueva o una copia sin tocar la de siempre.
  const path = process.env.DB_PATH || 'data/ventas.sqlite'
  mkdirSync(dirname(path), { recursive: true })
  db = new DatabaseSync(path)
  initSchema(db)
  return db
}

export function initSchema(db: DatabaseSync): void {
  migrateTransactionIdsToText(db)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS affiliates (
      id INTEGER PRIMARY KEY,
      name TEXT,
      commission_type TEXT NOT NULL DEFAULT 'percent',
      commission_value REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sales (
      -- TEXT: los IDs de Tradedoubler (~6.3e18) no caben en un número de JavaScript sin redondear.
      transaction_id TEXT PRIMARY KEY,
      occurred_at TEXT NOT NULL,
      program_id INTEGER,
      program_name TEXT,
      affiliate_id INTEGER NOT NULL,
      order_number TEXT,
      order_value REAL,
      valid INTEGER NOT NULL DEFAULT 1,
      renewal_due_at TEXT NOT NULL,
      renewal_status TEXT NOT NULL DEFAULT 'pending',
      renewal_amount REAL,
      renewal_checked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sales_renewal ON sales (renewal_status, renewal_due_at);
    CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL UNIQUE REFERENCES sales (transaction_id),
      affiliate_id INTEGER NOT NULL,
      base_amount REAL NOT NULL,
      rule_type TEXT NOT NULL,
      rule_value REAL NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
    -- Histórico de cada pedido: cada respuesta del conector de renovaciones (si renovó y por cuánto).
    CREATE TABLE IF NOT EXISTS renewal_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL REFERENCES sales (transaction_id),
      checked_at TEXT NOT NULL,
      status TEXT NOT NULL,
      amount REAL,
      source TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_renewal_checks_tx ON renewal_checks (transaction_id, checked_at);
    -- Webs (fuentes) de los afiliados, del endpoint /network/sources: de aquí sale la URL de cada afiliado.
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY,
      name TEXT,
      url TEXT,
      publisher_org_id INTEGER,
      country_code TEXT,
      promotion_type TEXT,
      synced_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sources_org ON sources (publisher_org_id);
    -- Cambios del glosario hechos desde el panel (null = valor por defecto).
    CREATE TABLE IF NOT EXISTS glossary (
      key TEXT PRIMARY KEY,
      label TEXT,
      description TEXT,
      visible INTEGER NOT NULL DEFAULT 0,
      filterable INTEGER NOT NULL DEFAULT 1
    );
  `)
  // Solo añade columnas (nunca quita ni renombra):
  //  extra: JSON con los campos del glosario que se guardan (dispositivo, web, evento…).
  //  td_*: comisión, estado y pago tal como los da el histórico de Tradedoubler.
  const cols = new Set((db.prepare("SELECT name FROM pragma_table_info('sales')").all() as Array<{ name: string }>).map((c) => c.name))
  const add: Array<[string, string]> = [
    ['extra', 'TEXT'],
    ['td_status', 'TEXT'],
    ['td_paid', 'INTEGER'],
    ['td_commission', 'REAL'],
    ['td_total_commission', 'REAL'],
    ['td_checked_at', 'TEXT']
  ]
  for (const [name, type] of add) if (!cols.has(name)) db.exec(`ALTER TABLE sales ADD COLUMN ${name} ${type}`)
}

/** Bases creadas con transaction_id INTEGER: se reconstruyen sales y commissions con TEXT conservando los datos. */
function migrateTransactionIdsToText(db: DatabaseSync): void {
  const col = db.prepare("SELECT type FROM pragma_table_info('sales') WHERE name = 'transaction_id'").get() as
    | { type: string }
    | undefined
  if (!col || col.type.toUpperCase() !== 'INTEGER') return
  db.exec(`
    BEGIN;
    ALTER TABLE sales RENAME TO sales_old;
    CREATE TABLE sales (
      transaction_id TEXT PRIMARY KEY,
      occurred_at TEXT NOT NULL,
      program_id INTEGER,
      program_name TEXT,
      affiliate_id INTEGER NOT NULL,
      order_number TEXT,
      order_value REAL,
      valid INTEGER NOT NULL DEFAULT 1,
      renewal_due_at TEXT NOT NULL,
      renewal_status TEXT NOT NULL DEFAULT 'pending',
      renewal_amount REAL,
      renewal_checked_at TEXT
    );
    INSERT INTO sales SELECT CAST(transaction_id AS TEXT), occurred_at, program_id, program_name, affiliate_id, order_number,
      order_value, valid, renewal_due_at, renewal_status, renewal_amount, renewal_checked_at FROM sales_old;
    DROP INDEX IF EXISTS idx_sales_renewal;
    ALTER TABLE commissions RENAME TO commissions_old;
    CREATE TABLE commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL UNIQUE REFERENCES sales (transaction_id),
      affiliate_id INTEGER NOT NULL,
      base_amount REAL NOT NULL,
      rule_type TEXT NOT NULL,
      rule_value REAL NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
    INSERT INTO commissions SELECT id, CAST(transaction_id AS TEXT), affiliate_id, base_amount, rule_type, rule_value, amount,
      status, created_at FROM commissions_old;
    DROP TABLE commissions_old;
    DROP TABLE sales_old;
    COMMIT;
  `)
}

export function kvGet(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}

export function kvSet(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value)
}
