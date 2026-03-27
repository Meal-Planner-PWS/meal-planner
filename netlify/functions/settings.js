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
    switch (event.httpMethod) {
      case 'GET':
        return await getSettings()
      case 'POST':
        return await saveSettings(JSON.parse(event.body))
      default:
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}

async function getSettings() {
  const result = await db.execute('SELECT key, value FROM settings')
  const settings = {}
  for (const row of result.rows) {
    try {
      settings[row.key] = JSON.parse(row.value)
    } catch {
      settings[row.key] = row.value
    }
  }
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(settings) }
}

async function saveSettings(data) {
  const statements = []

  if (data.codes !== undefined) {
    statements.push({
      sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      args: ['codes', JSON.stringify(data.codes)]
    })
  }

  if (data.assignments !== undefined) {
    statements.push({
      sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      args: ['assignments', JSON.stringify(data.assignments)]
    })
  }

  if (statements.length > 0) {
    await db.batch(statements)
  }

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) }
}
