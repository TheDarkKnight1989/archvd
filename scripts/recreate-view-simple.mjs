/**
 * Recreate stockx_latest_prices view - simple approach
 */

import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const connectionString = `postgresql://postgres.cjoucwhhwhpippksytoi:${process.env.SUPABASE_DB_PASSWORD || 'RiteshGSumra83'}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`

const client = new pg.Client({ connectionString })

try {
  await client.connect()

  console.log('🔧 Recreating stockx_latest_prices view\n')

  // Drop existing view
  await client.query('DROP VIEW IF EXISTS public.stockx_latest_prices')
  console.log('✓ Dropped old view')

  // Create new view with security_invoker = false
  await client.query(`
    CREATE VIEW public.stockx_latest_prices AS
    SELECT DISTINCT ON (sku, size, currency)
      sku,
      size,
      currency,
      lowest_ask,
      highest_bid,
      last_sale,
      average_price,
      volatility,
      sales_last_72h,
      as_of
    FROM public.stockx_market_prices
    ORDER BY sku, size, currency, as_of DESC
  `)
  console.log('✓ Created new view')

  // Grant permissions
  await client.query('GRANT SELECT ON public.stockx_latest_prices TO authenticated, anon')
  console.log('✓ Granted permissions')

  // Test view
  const result = await client.query('SELECT * FROM public.stockx_latest_prices LIMIT 5')
  console.log(`\n✅ View returns ${result.rows.length} rows:`)
  result.rows.forEach(row => {
    console.log(`  ${row.sku} size ${row.size}: Ask $${row.lowest_ask}`)
  })

} catch (error) {
  console.error('❌ Error:', error.message)
} finally {
  await client.end()
}
