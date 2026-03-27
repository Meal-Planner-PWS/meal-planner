import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@libsql/client'
import pLimit from 'p-limit'

const MERGED_FILE = path.resolve('scripts/recipes-merged.json')

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env')
  process.exit(1)
}

// Ensure name uniqueness index exists
try {
  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_meals_name ON meals (name)')
} catch (e) { /* may already exist */ }

const recipes = JSON.parse(fs.readFileSync(MERGED_FILE, 'utf-8'))
const total = recipes.length
const limit = pLimit(10)

let inserted = 0
let skipped = 0
let errors = 0

const tasks = recipes.map((recipe, i) =>
  limit(async () => {
    const label = `[${i + 1}/${total}]`
    const name = recipe.name || 'Unknown'
    try {
      const now = new Date().toISOString()
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO meals (id, name, category, ingredients, instructions, source_url, notes, photo, is_favorite, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          crypto.randomUUID(),
          name,
          recipe.category || 'dinner',
          JSON.stringify(recipe.ingredients || []),
          recipe.instructions || '',
          recipe.sourceUrl || '',
          recipe.notes || '',
          '',
          0,
          now,
          now
        ]
      })

      if (result.rowsAffected === 0) {
        console.log(`${label} inserting: ${name}... ~ skipped (already exists)`)
        skipped++
      } else {
        console.log(`${label} inserting: ${name}... ✓`)
        inserted++
      }
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        console.log(`${label} inserting: ${name}... ~ skipped (duplicate)`)
        skipped++
      } else {
        console.log(`${label} inserting: ${name}... ✗ ${err.message}`)
        errors++
      }
    }
  })
)

await Promise.all(tasks)

console.log(`\n${'='.repeat(50)}`)
console.log(`Summary: ${inserted} inserted, ${skipped} skipped, ${errors} errors`)
console.log(`${'='.repeat(50)}`)
