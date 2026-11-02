import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

let db: DatabaseSync | undefined

export function getDb(): DatabaseSync {
  if (db) return db
  mkdirSync('data', { recursive: true })
  db = new DatabaseSync('data/ventas.sqlite')
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
      transaction_id INTEGER PRIMARY KEY,
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
      transaction_id INTEGER NOT NULL UNIQUE REFERENCES sales (transaction_id),
      affiliate_id INTEGER NOT NULL,
      base_amount REAL NOT NULL,
      rule_type TEXT NOT NULL,
      rule_value REAL NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
  `)
  return db
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
