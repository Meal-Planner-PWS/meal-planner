/**
 * One-time migration: decode base64 photos in Turso → upload to Netlify Blobs → replace with URL.
 *
 * Run via: netlify functions:invoke migrate-photos
 *
 * Idempotent: re-running overwrites the same blob keys (= meal IDs) and skips meals
 * that already have a URL photo.
 *
 * Failure-isolated: each meal is independent. If sharp fails to decode a photo, that
 * meal's row stays untouched and the script logs the error.
 */
import { createClient } from '@libsql/client'
import { getStore } from '@netlify/blobs'
import sharp from 'sharp'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
}

export async function handler() {
  const log = []
  const result = { migrated: 0, skipped: 0, failed: 0, total: 0, errors: [] }

  try {
    const all = await db.execute(
      "SELECT id, name, photo FROM meals WHERE photo LIKE 'data:%'"
    )
    result.total = all.rows.length
    log.push(`Found ${result.total} meals with base64 photos`)

    const store = getStore('meal-photos')

    for (const row of all.rows) {
      const id = row.id
      const name = row.name
      const dataUrl = row.photo

      try {
        // Strip "data:image/...;base64," prefix
        const match = dataUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/)
        if (!match) {
          throw new Error('Photo is not a recognizable data URL')
        }
        const buffer = Buffer.from(match[1], 'base64')

        // Validate + resize
        const processed = await sharp(buffer)
          .rotate()
          .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer()

        // Upload to blob store keyed by meal ID
        await store.set(id, processed, { metadata: { contentType: 'image/jpeg' } })

        // ONLY after successful upload, update the Turso row
        const newUrl = `/.netlify/functions/photo?key=${encodeURIComponent(id)}`
        await db.execute({
          sql: 'UPDATE meals SET photo = ?, updated_at = ? WHERE id = ?',
          args: [newUrl, new Date().toISOString(), id]
        })

        log.push(`✓ ${name} (${id}) — ${Math.round(processed.length / 1024)}KB`)
        result.migrated++
      } catch (err) {
        log.push(`✗ ${name} (${id}) — ${err.message}`)
        result.errors.push({ id, name, error: err.message })
        result.failed++
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ...result, log }, null, 2)
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message, partial: result, log })
    }
  }
}
