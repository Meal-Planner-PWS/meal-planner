/**
 * Photo serve endpoint (Netlify Functions v2 runtime).
 * GET /.netlify/functions/photo?key=... → JPEG bytes
 */
import { getStore } from '@netlify/blobs'

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  if (!key) {
    return new Response('key is required', { status: 400 })
  }

  try {
    const store = getStore('meal-photos')
    const data = await store.get(key, { type: 'arrayBuffer' })
    if (!data) {
      return new Response('Not found', { status: 404 })
    }

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (err) {
    return new Response(err.message, { status: 500 })
  }
}
