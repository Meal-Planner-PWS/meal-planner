import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
        return await getRecentScans()
      case 'POST':
        return await upsertScan(JSON.parse(event.body))
      case 'DELETE':
        return await clearAllScans()
      default:
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
    }
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}

async function getRecentScans() {
  const result = await db.execute('SELECT * FROM scan_history ORDER BY scanned_at DESC LIMIT 20')

  const scans = result.rows.map((row) => ({
    barcode: row.barcode,
    productName: row.product_name,
    brand: row.brand,
    imageUrl: row.image_url,
    riskLevel: row.risk_level,
    flaggedAdditives: JSON.parse(row.flagged_additives || '[]'),
    categoriesTags: JSON.parse(row.categories_tags || '[]'),
    scannedAt: row.scanned_at,
    rawData: JSON.parse(row.raw_data || '{}')
  }))

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(scans) }
}

async function upsertScan(scan) {
  if (!scan.barcode) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'barcode is required' }) }
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO scan_history (barcode, product_name, brand, image_url, risk_level, flagged_additives, categories_tags, scanned_at, raw_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      scan.barcode,
      scan.productName || 'Unknown Product',
      scan.brand || '',
      scan.imageUrl || '',
      scan.riskLevel || 'safe',
      JSON.stringify(scan.flaggedAdditives || []),
      JSON.stringify(scan.categoriesTags || []),
      scan.scannedAt || new Date().toISOString(),
      JSON.stringify(scan.rawData || {})
    ]
  })

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) }
}

async function clearAllScans() {
  await db.execute('DELETE FROM scan_history')
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) }
}
