#!/usr/bin/env node
/**
 * Apply the last_sale_price removal migration
 *
 * This script manually applies the migration statements one by one
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

console.log('🚀 Applying last_sale_price removal migration\n')

try {
  // Step 1: Drop the view
  console.log('1️⃣  Dropping stockx_market_latest view...')
  const { error: dropError } = await supabase.rpc('exec_sql', {
    sql: 'DROP VIEW IF EXISTS stockx_market_latest CASCADE;'
  })
  if (dropError) throw new Error(`Drop view failed: ${dropError.message}`)
  console.log('   ✅ View dropped\n')

  // Step 2: Remove last_sale_price column
  console.log('2️⃣  Removing last_sale_price column...')
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE stockx_market_snapshots DROP COLUMN IF EXISTS last_sale_price CASCADE;'
  })
  if (alterError) throw new Error(`Alter table failed: ${alterError.message}`)
  console.log('   ✅ Column removed\n')

  // Step 3: Recreate the view
  console.log('3️⃣  Recreating stockx_market_latest view...')
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE VIEW stockx_market_latest AS
      SELECT DISTINCT ON (stockx_product_id, stockx_variant_id, currency_code)
        id,
        stockx_product_id,
        stockx_variant_id,
        product_id,
        variant_id,
        currency_code,
        sales_last_72_hours,
        total_sales_volume,
        lowest_ask,
        highest_bid,
        average_deadstock_price,
        volatility,
        price_premium,
        snapshot_at,
        created_at
      FROM stockx_market_snapshots
      ORDER BY stockx_product_id, stockx_variant_id, currency_code, snapshot_at DESC;
    `
  })
  if (createError) throw new Error(`Create view failed: ${createError.message}`)
  console.log('   ✅ View recreated\n')

  // Step 4: Add comment
  console.log('4️⃣  Adding comment...')
  const { error: commentError } = await supabase.rpc('exec_sql', {
    sql: `COMMENT ON VIEW stockx_market_latest IS 'Latest market data snapshot for each product/variant/currency (excludes last_sale_price as StockX V2 API no longer provides it)';`
  })
  if (commentError) throw new Error(`Add comment failed: ${commentError.message}`)
  console.log('   ✅ Comment added\n')

  // Verify the column is gone
  console.log('5️⃣  Verifying migration...')
  const { data: columns, error: verifyError } = await supabase
    .from('stockx_market_snapshots')
    .select('*')
    .limit(1)

  if (verifyError) {
    console.error('   ❌ Verification error:', verifyError.message)
  } else if (columns && columns.length > 0) {
    const columnNames = Object.keys(columns[0])
    if (columnNames.includes('last_sale_price')) {
      console.log('   ❌ Column last_sale_price still exists!')
    } else {
      console.log('   ✅ Column last_sale_price successfully removed')
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ MIGRATION COMPLETE!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

} catch (error) {
  console.error('\n❌ Fatal Error:', error.message)
  if (error.stack) {
    console.error('\nStack trace:')
    console.error(error.stack)
  }
  process.exit(1)
}
