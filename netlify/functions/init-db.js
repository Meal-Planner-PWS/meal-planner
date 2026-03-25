// Run once via: netlify functions:invoke init-db
// Creates all three tables in Turso if they don't exist.

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

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }

  try {
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
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS week_plans (
        week_start TEXT NOT NULL,
        day TEXT NOT NULL,
        slot_type TEXT NOT NULL,
        meal_ids TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (week_start, day, slot_type)
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
      )`
    ])

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: 'All tables created successfully' })
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    }
  }
}
