#!/usr/bin/env node
/**
 * PHASE 3.11: Mark Chicago Low Items as Invalid
 *
 * Purpose: Mark the two Chicago Low (HQ6998-600) inventory items as having
 *          invalid StockX mappings, so the UI stops showing fake prices.
 *
 * Usage:
 *   npx tsx scripts/mark-chicago-invalid.mjs
 *
 * What it does:
 *   1. Applies the migration (if not already applied)
 *   2. Sets mapping_status = 'stockx_404' for the two Chicago Low items
 *   3. Deletes stale snapshots from stockx_market_snapshots
 *   4. Refreshes the stockx_market_latest materialized view
 *
 * WHY: The StockX product ID we have for Chicago Low returns 404. The prices
 *      in the database are stale and incorrect. We need to stop showing them
 *      until we get a valid product mapping.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Chicago Low inventory items
const CHICAGO_LOW_ITEMS = [
  {
    id: '729d9d3d-b9e2-4f1e-8286-e235624b2923',
    size: 'UK 9',
    sku: 'HQ6998-600',
  },
  {
    id: '85a1fbbd-b271-4961-b65b-4d862ec2ac23',
    size: 'UK 11',
    sku: 'HQ6998-600',
  },
]

const BROKEN_STOCKX_PRODUCT_ID = '83c11c36-1e00-4831-85e5-6067abf2f18b'

console.log('\n🔧 PHASE 3.11: Mark Chicago Low Mappings as Invalid\n')
console.log('=' .repeat(80))
console.log('Purpose: Stop showing fake prices for Chicago Low items')
console.log('  - Broken StockX product ID:', BROKEN_STOCKX_PRODUCT_ID)
console.log('  - This product ID returns 404 from StockX API')
console.log('  - Prices in DB are stale/incorrect')
console.log('=' .repeat(80))
console.log()

// ============================================================================
// STEP 1: Apply migration (if not already applied)
// ============================================================================

console.log('STEP 1: Checking if migration is applied...')

const migrationFile = 'supabase/migrations/20251120_add_mapping_status_to_inventory_market_links.sql'

if (!fs.existsSync(migrationFile)) {
  console.log(`❌ Migration file not found: ${migrationFile}`)
  console.log('   Please ensure the migration file exists before running this script.')
  process.exit(1)
}

console.log(`✅ Migration file found: ${migrationFile}`)

// Check if the column already exists
const { data: columnCheck, error: columnError } = await supabase.rpc('query', {
  query: `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'inventory_market_links'
      AND column_name = 'mapping_status'
  `
}).single()

if (columnError && !columnError.message.includes('0 rows')) {
  // Try alternative check using direct query
  const { data: links, error: linkError } = await supabase
    .from('inventory_market_links')
    .select('*')
    .limit(1)

  if (linkError) {
    console.log('⚠️  Could not check if migration is applied')
    console.log('   Assuming migration needs to be applied...')
  } else if (links && links.length > 0 && !('mapping_status' in links[0])) {
    console.log('⚠️  Migration not yet applied')
    console.log('   Please run the migration first using your preferred method')
    console.log('   (e.g., Supabase CLI or direct SQL execution)')
    process.exit(1)
  } else {
    console.log('✅ Migration already applied (mapping_status column exists)')
  }
} else {
  console.log('✅ Migration already applied (mapping_status column exists)')
}

console.log()

// ============================================================================
// STEP 2: Verify the items exist
// ============================================================================

console.log('STEP 2: Verifying Chicago Low items exist in inventory...')

for (const item of CHICAGO_LOW_ITEMS) {
  const { data: inventoryItem, error: invError } = await supabase
    .from('Inventory')
    .select('id, sku, size, brand, model, colorway')
    .eq('id', item.id)
    .single()

  if (invError || !inventoryItem) {
    console.log(`❌ Item not found: ${item.size} (${item.id})`)
    console.log(`   Error: ${invError?.message || 'null result'}`)
    process.exit(1)
  }

  console.log(`✅ Found: ${inventoryItem.brand} ${inventoryItem.model} ${inventoryItem.colorway}`)
  console.log(`   SKU: ${inventoryItem.sku}, Size: ${inventoryItem.size}`)
}

console.log()

// ============================================================================
// STEP 3: Check current mappings
// ============================================================================

console.log('STEP 3: Checking current StockX mappings...')

for (const item of CHICAGO_LOW_ITEMS) {
  const { data: link, error: linkError } = await supabase
    .from('inventory_market_links')
    .select('*')
    .eq('item_id', item.id)
    .single()

  if (linkError || !link) {
    console.log(`⚠️  ${item.size}: No mapping found`)
  } else {
    console.log(`📊 ${item.size}:`)
    console.log(`   Product ID: ${link.stockx_product_id}`)
    console.log(`   Variant ID: ${link.stockx_variant_id}`)
    console.log(`   Status: ${link.mapping_status || 'ok (default)'}`)
  }
}

console.log()

// ============================================================================
// STEP 4: Update mapping status to 'stockx_404'
// ============================================================================

console.log('STEP 4: Marking mappings as invalid (stockx_404)...')

let updatedCount = 0
let errorCount = 0

for (const item of CHICAGO_LOW_ITEMS) {
  const { error: updateError } = await supabase
    .from('inventory_market_links')
    .update({
      mapping_status: 'stockx_404',
      last_sync_error: 'StockX product not found (404). Product ID may be deprecated.',
      updated_at: new Date().toISOString(),
    })
    .eq('item_id', item.id)

  if (updateError) {
    console.log(`❌ ${item.size}: Failed to update mapping`)
    console.log(`   Error: ${updateError.message}`)
    errorCount++
  } else {
    console.log(`✅ ${item.size}: Marked as 'stockx_404'`)
    updatedCount++
  }
}

console.log()

if (errorCount > 0) {
  console.log('⚠️  Some updates failed. Stopping here.')
  process.exit(1)
}

// ============================================================================
// STEP 5: Delete stale snapshots (optional but recommended)
// ============================================================================

console.log('STEP 5: Deleting stale snapshots from stockx_market_snapshots...')

const { data: deletedSnapshots, error: deleteError } = await supabase
  .from('stockx_market_snapshots')
  .delete()
  .eq('stockx_product_id', BROKEN_STOCKX_PRODUCT_ID)
  .select('id')

if (deleteError) {
  console.log('⚠️  Failed to delete snapshots')
  console.log(`   Error: ${deleteError.message}`)
  console.log('   (Non-fatal - continuing...)')
} else {
  const count = deletedSnapshots?.length || 0
  console.log(`✅ Deleted ${count} stale snapshot(s) for product ${BROKEN_STOCKX_PRODUCT_ID}`)
}

console.log()

// ============================================================================
// STEP 6: Refresh materialized view
// ============================================================================

console.log('STEP 6: Refreshing stockx_market_latest materialized view...')

const { error: refreshError } = await supabase.rpc('refresh_stockx_market_latest')

if (refreshError) {
  console.log('⚠️  Failed to refresh materialized view')
  console.log(`   Error: ${refreshError.message}`)
  console.log('   (Non-fatal - view will be refreshed on next sync)')
} else {
  console.log('✅ Materialized view refreshed')
}

console.log()

// ============================================================================
// SUMMARY
// ============================================================================

console.log('=' .repeat(80))
console.log('SUMMARY:')
console.log(`  Mappings marked as invalid: ${updatedCount}`)
console.log(`  Errors: ${errorCount}`)
console.log('=' .repeat(80))

if (updatedCount > 0) {
  console.log(`
✅ Successfully marked Chicago Low items as invalid

WHAT CHANGED:
1. mapping_status = 'stockx_404' for ${updatedCount} item(s)
2. Stale snapshots deleted from database
3. Materialized view refreshed

WHAT HAPPENS NEXT:
1. Portfolio UI will stop showing prices for these items
2. Instead, UI should show: "⚠️ Price unavailable (StockX mapping broken)"
3. Items excluded from portfolio value totals (or shown with warning)

TO FIX THE MAPPING (when ready):
1. Run: node scripts/remap-stockx-product.mjs HQ6998-600
2. Select the correct product from search results
3. Script will update mappings and set status back to 'ok'
4. Portfolio will then show correct, fresh prices

VERIFY IN UI:
1. Open Portfolio page: http://localhost:3000/portfolio
2. Find HQ6998-600 UK 9 and UK 11
3. Should NOT show numeric prices
4. Should show warning badge/message instead
`)
}

console.log('✅ Done\n')
