import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { meals = [], plannerSlots = [], dayNotes = [], scans = [], settings = [] } = JSON.parse(event.body)
    const statements = []

    // Process meal upserts and deletes
    for (const item of meals) {
      if (item.action === 'delete') {
        statements.push({
          sql: 'DELETE FROM meals WHERE id = ?',
          args: [item.id]
        })
      } else {
        const m = item.data
        // Server-side guard: photos are URLs only. Drop base64 to keep Turso lean
        // and prevent the lightweight list endpoint from ever exceeding payload limits.
        const photo = (m.photo && !String(m.photo).startsWith('data:')) ? m.photo : ''
        statements.push({
          sql: `INSERT OR REPLACE INTO meals (id, name, category, ingredients, instructions, source_url, notes, photo, prep_time, is_favorite, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            m.id, m.name || '', m.category || 'dinner',
            JSON.stringify(m.ingredients || []),
            m.instructions || '', m.sourceUrl || '', m.notes || '', photo,
            m.prepTime || null,
            m.isFavorite ? 1 : 0,
            m.createdAt || new Date().toISOString(),
            m.updatedAt || new Date().toISOString()
          ]
        })
      }
    }

    // Process planner slot upserts and deletes
    for (const item of plannerSlots) {
      if (item.action === 'delete') {
        statements.push({
          sql: 'DELETE FROM week_plans WHERE week_start = ? AND day = ? AND slot_type = ?',
          args: [item.weekStart, item.day, item.slotType]
        })
      } else {
        const s = item.data
        // entry is the new MealEntry shape: { text, recipeIds, helperIds, prepTasks } | null
        // mealIds kept as a denormalized list of recipeIds for backwards compat & queries
        const entry = s.entry || null
        const recipeIds = entry?.recipeIds || s.mealIds || []
        statements.push({
          sql: `INSERT OR REPLACE INTO week_plans (week_start, day, slot_type, meal_ids, entry_data, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            s.weekStart, s.day, s.slotType,
            JSON.stringify(recipeIds),
            entry ? JSON.stringify(entry) : '',
            s.updatedAt || new Date().toISOString()
          ]
        })
      }
    }

    // Process day upserts (notes + prep tasks). Coalesces multiple updates per day.
    const dayMap = new Map()
    for (const item of dayNotes) {
      if (item.action !== 'upsert' || !item.data) continue
      const d = item.data
      const key = `${d.weekStart}|${d.day}`
      const existing = dayMap.get(key) || { weekStart: d.weekStart, day: d.day, notes: '', prepTasks: [], updatedAt: '' }
      // Latest wins for each field present
      if ('notes' in d) existing.notes = d.notes || ''
      if ('prepTasks' in d) existing.prepTasks = d.prepTasks || []
      existing.updatedAt = d.updatedAt || new Date().toISOString()
      dayMap.set(key, existing)
    }
    for (const d of dayMap.values()) {
      statements.push({
        sql: `INSERT OR REPLACE INTO day_notes (week_start, day, notes, prep_tasks, updated_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          d.weekStart, d.day, d.notes,
          JSON.stringify(d.prepTasks || []),
          d.updatedAt
        ]
      })
    }

    // Process scan upserts and delete-all
    for (const item of scans) {
      if (item.action === 'delete_all') {
        statements.push('DELETE FROM scan_history')
      } else {
        const sc = item.data
        statements.push({
          sql: `INSERT OR REPLACE INTO scan_history (barcode, product_name, brand, image_url, risk_level, flagged_additives, categories_tags, scanned_at, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            sc.barcode, sc.productName || 'Unknown Product', sc.brand || '',
            sc.imageUrl || '', sc.riskLevel || 'safe',
            JSON.stringify(sc.flaggedAdditives || []),
            JSON.stringify(sc.categoriesTags || []),
            sc.scannedAt || new Date().toISOString(),
            JSON.stringify(sc.rawData || {})
          ]
        })
      }
    }

    // Process settings upserts
    for (const item of settings) {
      if (item.action === 'upsert' && item.data) {
        if (item.data.codes !== undefined) {
          statements.push({
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            args: ['codes', JSON.stringify(item.data.codes)]
          })
        }
        if (item.data.assignments !== undefined) {
          statements.push({
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            args: ['assignments', JSON.stringify(item.data.assignments)]
          })
        }
        if (item.data.flaggedIngredients !== undefined) {
          statements.push({
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            args: ['flagged_ingredients', JSON.stringify(item.data.flaggedIngredients)]
          })
        }
        if (item.data.cleanifyRules !== undefined) {
          statements.push({
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            args: ['cleanify_rules', JSON.stringify(item.data.cleanifyRules)]
          })
        }
        if (item.data.categories !== undefined) {
          statements.push({
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            args: ['categories', JSON.stringify(item.data.categories)]
          })
        }
        if (item.data.helpers !== undefined) {
          statements.push({
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            args: ['helpers', JSON.stringify(item.data.helpers)]
          })
        }
        if (item.data.mealShortcuts !== undefined) {
          statements.push({
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            args: ['meal_shortcuts', JSON.stringify(item.data.mealShortcuts)]
          })
        }
      }
    }

    if (statements.length > 0) {
      await db.batch(statements)
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        synced: {
          meals: meals.length,
          plannerSlots: plannerSlots.length,
          scans: scans.length,
          settings: settings.length
        }
      })
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}
