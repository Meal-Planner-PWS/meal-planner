// Run via: curl -X POST https://<site>/.netlify/functions/init-db
// Idempotent: creates missing tables AND adds any missing columns to existing tables.
// Safe to re-run after every deploy.

import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
}

/** Add a column if it doesn't already exist. Returns true if added. */
async function ensureColumn(table, column, definition) {
  const info = await db.execute(`PRAGMA table_info(${table})`)
  const exists = info.rows.some((r) => r.name === column)
  if (exists) return false
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  return true
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }

  const log = []
  try {
    // 1. Create tables if missing
    await db.batch([
      `CREATE TABLE IF NOT EXISTS meals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'dinner',
        ingredients TEXT NOT NULL DEFAULT '[]',
        instructions TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        photo TEXT NOT NULL DEFAULT '',
        prep_time INTEGER,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS week_plans (
        week_start TEXT NOT NULL,
        day TEXT NOT NULL,
        slot_type TEXT NOT NULL,
        meal_ids TEXT NOT NULL DEFAULT '[]',
        entry_data TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (week_start, day, slot_type)
      )`,
      `CREATE TABLE IF NOT EXISTS day_notes (
        week_start TEXT NOT NULL,
        day TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (week_start, day)
      )`,
      `CREATE TABLE IF NOT EXISTS scan_history (
        barcode TEXT PRIMARY KEY,
        product_name TEXT NOT NULL DEFAULT 'Unknown Product',
        brand TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        risk_level TEXT NOT NULL DEFAULT 'safe',
        flagged_additives TEXT NOT NULL DEFAULT '[]',
        categories_tags TEXT NOT NULL DEFAULT '[]',
        scanned_at TEXT NOT NULL,
        raw_data TEXT NOT NULL DEFAULT '{}'
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`
    ])
    log.push('tables ensured')

    // 2. Backfill columns added in later phases. Each call is idempotent.
    const columnMigrations = [
      { table: 'meals',      column: 'prep_time',  def: 'INTEGER' },
      { table: 'week_plans', column: 'entry_data', def: "TEXT NOT NULL DEFAULT ''" }
    ]
    for (const m of columnMigrations) {
      const added = await ensureColumn(m.table, m.column, m.def)
      log.push(`${m.table}.${m.column}: ${added ? 'ADDED' : 'already present'}`)
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, log })
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message, log })
    }
  }
}
