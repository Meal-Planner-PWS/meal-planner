import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
        return await getWeek(event.queryStringParameters?.weekStart)
      case 'POST':
        return await upsertSlot(JSON.parse(event.body))
      case 'DELETE':
        return await clearSlot(event.queryStringParameters)
      default:
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}

async function getWeek(weekStart) {
  if (!weekStart) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'weekStart query param is required' }) }
  }

  const [slotsRes, notesRes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM week_plans WHERE week_start = ?', args: [weekStart] }),
    db.execute({ sql: 'SELECT * FROM day_notes WHERE week_start = ?', args: [weekStart] }).catch(() => ({ rows: [] }))
  ])

  const slots = slotsRes.rows.map((row) => {
    let entry = null
    try { entry = row.entry_data ? JSON.parse(row.entry_data) : null } catch { entry = null }
    return {
      weekStart: row.week_start,
      day: row.day,
      slotType: row.slot_type,
      entry,
      mealIds: JSON.parse(row.meal_ids || '[]'),
      updatedAt: row.updated_at
    }
  })

  const notes = notesRes.rows.map((row) => ({
    weekStart: row.week_start,
    day: row.day,
    notes: row.notes || '',
    updatedAt: row.updated_at
  }))

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ slots, notes }) }
}

async function upsertSlot(data) {
  if (!data.weekStart || !data.day || !data.slotType) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'weekStart, day, and slotType are required' }) }
  }

  const entry = data.entry || null
  const recipeIds = entry?.recipeIds || data.mealIds || []

  await db.execute({
    sql: `INSERT OR REPLACE INTO week_plans (week_start, day, slot_type, meal_ids, entry_data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      data.weekStart,
      data.day,
      data.slotType,
      JSON.stringify(recipeIds),
      entry ? JSON.stringify(entry) : '',
      data.updatedAt || new Date().toISOString()
    ]
  })

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) }
}

async function clearSlot(params) {
  if (!params?.weekStart || !params?.day || !params?.slotType) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'weekStart, day, and slotType query params are required' }) }
  }

  await db.execute({
    sql: 'DELETE FROM week_plans WHERE week_start = ? AND day = ? AND slot_type = ?',
    args: [params.weekStart, params.day, params.slotType]
  })

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) }
}
