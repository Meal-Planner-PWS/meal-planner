import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
        return await getAllMeals()
      case 'POST':
        return await createMeal(JSON.parse(event.body))
      case 'PUT':
        return await updateMeal(JSON.parse(event.body))
      case 'DELETE':
        return await deleteMeal(event.queryStringParameters?.id)
      default:
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}

async function getAllMeals() {
  const result = await db.execute('SELECT * FROM meals ORDER BY updated_at DESC')
  const meals = result.rows.map(rowToMeal)
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(meals) }
}

async function createMeal(meal) {
  if (!meal.id || !meal.name) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'id and name are required' }) }
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO meals (id, name, category, ingredients, instructions, source_url, notes, photo, is_favorite, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      meal.id,
      meal.name,
      meal.category || 'dinner',
      JSON.stringify(meal.ingredients || []),
      meal.instructions || '',
      meal.sourceUrl || '',
      meal.notes || '',
      meal.photo || '',
      meal.isFavorite ? 1 : 0,
      meal.createdAt || new Date().toISOString(),
      meal.updatedAt || new Date().toISOString()
    ]
  })

  return { statusCode: 201, headers: CORS_HEADERS, body: JSON.stringify({ success: true, id: meal.id }) }
}

async function updateMeal(meal) {
  if (!meal.id) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'id is required' }) }
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO meals (id, name, category, ingredients, instructions, source_url, notes, photo, is_favorite, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      meal.id,
      meal.name || '',
      meal.category || 'dinner',
      JSON.stringify(meal.ingredients || []),
      meal.instructions || '',
      meal.sourceUrl || '',
      meal.notes || '',
      meal.photo || '',
      meal.isFavorite ? 1 : 0,
      meal.createdAt || new Date().toISOString(),
      meal.updatedAt || new Date().toISOString()
    ]
  })

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, id: meal.id }) }
}

async function deleteMeal(id) {
  if (!id) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'id query param is required' }) }
  }

  await db.execute({ sql: 'DELETE FROM meals WHERE id = ?', args: [id] })
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, id }) }
}

function rowToMeal(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    ingredients: JSON.parse(row.ingredients || '[]'),
    instructions: row.instructions,
    sourceUrl: row.source_url,
    notes: row.notes,
    photo: row.photo,
    isFavorite: !!row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
