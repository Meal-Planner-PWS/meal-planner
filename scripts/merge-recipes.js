import fs from 'node:fs'
import path from 'node:path'

const IMPORT_DIR = path.resolve('recipe-imports')
const OUTPUT_FILE = path.resolve('scripts/recipes-merged.json')
const BATCH_COUNT = 8

const all = []
const seen = new Map() // lowercase name → index in all[]
let dupes = 0

for (let i = 1; i <= BATCH_COUNT; i++) {
  const file = path.join(IMPORT_DIR, `recipes-batch-${i}.json`)
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const recipes = Array.isArray(raw) ? raw : []
  console.log(`batch-${i}: ${recipes.length} recipes`)

  for (const recipe of recipes) {
    const key = (recipe.name || '').toLowerCase().trim()
    if (!key) continue
    if (seen.has(key)) {
      console.log(`  ⚠ duplicate skipped: "${recipe.name}" (first seen in earlier batch)`)
      dupes++
    } else {
      seen.set(key, all.length)
      all.push(recipe)
    }
  }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(all, null, 2))

console.log(`\n${'='.repeat(50)}`)
console.log(`Total after merge: ${all.length} recipes`)
console.log(`Duplicates removed: ${dupes}`)
console.log(`Written to: scripts/recipes-merged.json`)
console.log(`${'='.repeat(50)}`)
