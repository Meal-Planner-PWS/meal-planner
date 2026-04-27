import 'dotenv/config'
import { createClient } from '@libsql/client'
import { writeFileSync, mkdirSync } from 'fs'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

const API_KEY = process.env.VITE_SPOONACULAR_KEY
const SEARCH_URL = 'https://api.spoonacular.com/recipes/complexSearch'
const DELAY_MS = 300

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Normalize a meal name for Spoonacular search:
 * - Strip parenthetical suffixes "(Crock Pot)", "(Slow Cooker)"
 * - Strip possessives "Grandma Beck's", "Mom's" → remove
 * - Strip holiday/occasion prefixes "Christmas", "Thanksgiving"
 * - Strip descriptive prefixes "Easy", "Homemade", "Quick", "Copycat", "Best", "Simple", "Creamy", "Fresh", "Leftover", "Yummy"
 */
function normalizeName(name) {
  let s = name
  // Remove anything in parentheses
  s = s.replace(/\s*\([^)]*\)/g, '')
  // Remove possessives like "Grandma Beck's", "Mom's", "Aunt Jane's"
  s = s.replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*'s\s+/g, '')
  // Remove holiday/descriptor prefixes
  const stripPrefixes = /^(christmas|thanksgiving|easter|holiday|easy|homemade|quick|copycat|best|simple|creamy|fresh|leftover|yummy|healthy|classic|traditional|ultimate|perfect|grandma|grandmas|grandmother|moms|aunts|uncles|poor mans)\s+/gi
  let prev
  do {
    prev = s
    s = s.replace(stripPrefixes, '')
  } while (s !== prev)
  return s.trim()
}

/**
 * Confidence score — requires the core noun (last word) of the meal name
 * to ALSO be the core noun of the result title. Otherwise the result is a
 * different dish type. E.g. "Applesauce" must NOT match "Applesauce Carrot
 * Cake Muffins" since the result's primary dish is muffins, not applesauce.
 */
function confidenceScore(mealName, resultTitle) {
  const normalized = normalizeName(mealName)
  const mealWords = normalized.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)

  // Trim trailing modifier phrases from the result title — e.g.
  // "Sweet Potato Casserole with Pecans" → "Sweet Potato Casserole"
  // "Pancakes Topped with Berries" → "Pancakes"
  const cleanedResult = resultTitle.toLowerCase()
    .replace(/\s+(with|topped with|served with|and|in|on|over|for|by|using|stuffed with|filled with)\s+.*$/i, '')
    .replace(/[^a-z0-9\s]/g, '')
  const resultWordsArr = cleanedResult.split(/\s+/).filter(Boolean)
  const resultWords = new Set(resultWordsArr)

  if (mealWords.length === 0 || resultWordsArr.length === 0) return 0

  // The core noun is the last word — typically the dish type.
  // Both meal and result must share the same core dish type.
  const mealNoun = mealWords[mealWords.length - 1]
  const resultNoun = resultWordsArr[resultWordsArr.length - 1]

  // Allow plural/singular tolerance (cookies <-> cookie, muffins <-> muffin)
  const stem = (w) => w.replace(/(es|s)$/, '')
  if (stem(mealNoun) !== stem(resultNoun)) return 0

  const matches = mealWords.filter((w) => resultWords.has(w)).length
  return Math.round((matches / mealWords.length) * 100) / 100
}

/** Upgrade Spoonacular image URL to larger size */
function upgradeImageUrl(url) {
  if (!url) return url
  return url.replace(/\d+x\d+/, '556x370')
}

async function searchSpoonacular(query, debug = false) {
  const params = new URLSearchParams({
    query,
    number: '3',
    apiKey: API_KEY,
    addRecipeInformation: 'false'
  })

  const res = await fetch(`${SEARCH_URL}?${params}`)
  if (!res.ok) {
    if (res.status === 402) throw new Error('RATE_LIMIT')
    throw new Error(`Spoonacular ${res.status}: ${res.statusText}`)
  }

  const data = await res.json()
  if (debug) {
    console.log(`  [debug] query="${query}" → ${data.results?.length || 0} results:`, (data.results || []).map((r) => r.title))
  }
  return data.results || []
}

async function main() {
  // Fetch all meals
  const result = await db.execute('SELECT id, name, photo FROM meals ORDER BY name ASC')
  const allMeals = result.rows

  const needsImage = allMeals.filter((m) => !m.photo || m.photo === '')
  const hasPhoto = allMeals.filter((m) => m.photo && m.photo !== '')

  console.log(`Fetching images for ${allMeals.length} meals (${hasPhoto.length} already have photos, processing ${needsImage.length})...\n`)

  // Audit log of meals that already have photos
  for (const m of hasPhoto) {
    console.log(`[SKIPPED - already has photo] ${m.name}`)
  }
  if (hasPhoto.length > 0) console.log('')

  const results = []
  let matched = 0
  let lowConfidence = 0
  let noMatch = 0

  for (let i = 0; i < needsImage.length; i++) {
    const meal = needsImage[i]
    const prefix = `[${i + 1}/${needsImage.length}]`

    try {
      const searchQuery = normalizeName(meal.name) || meal.name
      const searchResults = await searchSpoonacular(searchQuery, i < 3)

      if (searchResults.length === 0) {
        console.log(`${prefix} ${meal.name}... \u2717 no match`)
        results.push({
          id: meal.id,
          name: meal.name,
          status: 'no_match',
          confidence: 0,
          spoonacularTitle: null,
          imageUrl: null
        })
        noMatch++
      } else {
        const best = searchResults[0]
        const score = confidenceScore(meal.name, best.title)
        const imageUrl = upgradeImageUrl(best.image)

        if (score >= 0.6) {
          // Confident match — save to Turso
          await db.execute({
            sql: 'UPDATE meals SET photo = ?, updated_at = ? WHERE id = ?',
            args: [imageUrl, new Date().toISOString(), meal.id]
          })
          console.log(`${prefix} ${meal.name}... \u2713 matched (${score}) \u2192 ${best.title}`)
          results.push({
            id: meal.id,
            name: meal.name,
            status: 'matched',
            confidence: score,
            spoonacularTitle: best.title,
            imageUrl
          })
          matched++
        } else {
          console.log(`${prefix} ${meal.name}... \u26A0 low confidence (${score}) \u2192 ${best.title}`)
          results.push({
            id: meal.id,
            name: meal.name,
            status: 'low_confidence',
            confidence: score,
            spoonacularTitle: best.title,
            imageUrl
          })
          lowConfidence++
        }
      }
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
        console.error(`\n${prefix} Rate limit hit! Stopping. Progress saved.`)
        break
      }
      console.log(`${prefix} ${meal.name}... \u2717 error: ${err.message}`)
      results.push({
        id: meal.id,
        name: meal.name,
        status: 'error',
        confidence: 0,
        spoonacularTitle: null,
        imageUrl: null
      })
      noMatch++
    }

    // Rate limit delay
    if (i < needsImage.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  // Write results JSON
  writeFileSync('scripts/image-results.json', JSON.stringify(results, null, 2))

  // Write human-readable review file
  const lowConf = results.filter((r) => r.status === 'low_confidence')
  const noMatches = results.filter((r) => r.status === 'no_match' || r.status === 'error')

  let review = ''
  if (lowConf.length > 0) {
    review += 'NEEDS REVIEW (low confidence match):\n\n'
    for (const r of lowConf) {
      review += `  ${r.name} \u2192 matched "${r.spoonacularTitle}" (score: ${r.confidence})\n`
    }
    review += '\n'
  }
  if (noMatches.length > 0) {
    review += 'NO MATCH FOUND:\n\n'
    for (const r of noMatches) {
      review += `  ${r.name}\n`
    }
    review += '\n'
  }
  review += `Total: ${matched} matched, ${lowConfidence} low confidence, ${noMatch} no match\n`

  writeFileSync('scripts/image-review.txt', review)

  console.log(`\nSummary:`)
  console.log(`  \u2713 Matched and saved: ${matched}`)
  console.log(`  \u26A0 Low confidence (not saved): ${lowConfidence}`)
  console.log(`  \u2717 No match found: ${noMatch}`)
  console.log(`  \u2192 See scripts/image-review.txt for manual review list`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
