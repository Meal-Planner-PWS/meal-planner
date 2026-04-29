/**
 * Photo upload endpoint (Netlify Functions v2 runtime).
 * POST { dataUrl: 'data:image/...;base64,...', mealId?: 'uuid' }
 * - Decodes base64
 * - Resizes to max 1200px wide, JPEG 85% quality
 * - Stores in Netlify Blobs under key (mealId or random)
 * - Returns { url, key, size }
 *
 * Uses v2 runtime (export default async) so Netlify auto-injects blob context.
 */
import { getStore } from '@netlify/blobs'
import sharp from 'sharp'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
}

function genKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const { dataUrl, mealId } = await req.json()
    if (!dataUrl || typeof dataUrl !== 'string') {
      return json({ error: 'dataUrl is required' }, 400)
    }

    const match = dataUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/)
    if (!match) {
      return json({ error: 'Invalid data URL' }, 400)
    }
    const buffer = Buffer.from(match[1], 'base64')

    const processed = await sharp(buffer)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()

    const key = mealId || genKey()
    const store = getStore('meal-photos')
    await store.set(key, processed, { metadata: { contentType: 'image/jpeg' } })

    return json({
      url: `/.netlify/functions/photo?key=${encodeURIComponent(key)}`,
      key,
      size: processed.length
    })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
}
