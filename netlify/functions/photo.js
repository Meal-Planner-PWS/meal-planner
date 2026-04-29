/**
 * Photo serve endpoint.
 * GET /.netlify/functions/photo?key=... → JPEG bytes
 * Long cache because keys are stable per meal (replaced on re-upload).
 */
import { getStore } from '@netlify/blobs'

function photosStore() {
  return getStore({
    name: 'meal-photos',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN
  })
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: ''
    }
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const key = event.queryStringParameters?.key
  if (!key) {
    return { statusCode: 400, body: 'key is required' }
  }

  try {
    const store = photosStore()
    const data = await store.get(key, { type: 'arrayBuffer' })
    if (!data) {
      return { statusCode: 404, body: 'Not found' }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        // Photo blobs are content-addressable per meal; aggressive cache is fine.
        // Photos replaced on re-upload use the same key but the browser cache will
        // reflect the new content within ~24h, or hard refresh.
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*'
      },
      body: Buffer.from(data).toString('base64'),
      isBase64Encoded: true
    }
  } catch (err) {
    return { statusCode: 500, body: err.message }
  }
}
