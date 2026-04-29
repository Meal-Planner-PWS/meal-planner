/**
 * Photo upload endpoint.
 * POST { dataUrl: 'data:image/...;base64,...', mealId?: 'uuid' }
 * - Decodes base64
 * - Resizes to max 1200px wide, JPEG 85% quality
 * - Stores in Netlify Blobs under key (mealId or random)
 * - Returns { url: '/.netlify/functions/photo?key=...', key }
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
  // Random 16-byte hex key for new photos without an explicit mealId
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { dataUrl, mealId } = JSON.parse(event.body || '{}')
    if (!dataUrl || typeof dataUrl !== 'string') {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'dataUrl is required' }) }
    }

    // Strip "data:image/...;base64," prefix
    const match = dataUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/)
    if (!match) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid data URL' }) }
    }
    const buffer = Buffer.from(match[1], 'base64')

    // Resize + recompress as JPEG
    const processed = await sharp(buffer)
      .rotate() // honor EXIF orientation
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()

    // Store in Netlify Blobs
    const key = mealId || genKey()
    const store = getStore('meal-photos')
    await store.set(key, processed, { metadata: { contentType: 'image/jpeg' } })

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        url: `/.netlify/functions/photo?key=${encodeURIComponent(key)}`,
        key,
        size: processed.length
      })
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}
