#!/usr/bin/env node
/**
 * Automated sync of all inventory items with StockX mappings
 * PHASE 3.6: Complete automated solution - fetches real data from StockX
 *
 * This script:
 * 1. Finds all items with StockX mappings
 * 2. Syncs each item directly via worker function (bypasses API auth)
 * 3. Populates stockx_products, stockx_variants, and stockx_market_snapshots
 * 4. No manual intervention required
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Helper to sleep between syncs
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function syncAllItems() {
  console.log('🔄 Starting automated StockX sync for all items...\n')

  // Get all items with StockX mappings
  const { data: links, error: linksError } = await supabase
    .from('inventory_market_links')
    .select('item_id, stockx_product_id, stockx_variant_id')
    .not('stockx_product_id', 'is', null)

  if (linksError) {
    console.error('❌ Failed to fetch mappings:', linksError.message)
    process.exit(1)
  }

  console.log(`Found ${links.length} items with StockX mappings\n`)

  let succeeded = 0
  let failed = 0
  const errors = []

  for (const link of links) {
    try {
      // Get item details
      const { data: item } = await supabase
        .from('Inventory')
        .select('id, sku, size, user_id')
        .eq('id', link.item_id)
        .single()

      if (!item) {
        console.log(`⚠️  Skipping ${link.item_id}: Item not found`)
        continue
      }

      console.log(`📦 Syncing ${item.sku}${item.size ? `:${item.size}` : ''}...`)

      // Import and call worker function dynamically
      const { syncSingleInventoryItemFromStockx } = await import('../src/lib/providers/stockx-worker.ts')

      const result = await syncSingleInventoryItemFromStockx({
        inventoryItemId: item.id,
        userId: item.user_id,
      })

      if (!result.error) {
        succeeded++
        console.log(`✅ Synced ${item.sku}: ${result.market.snapshotsCreated} snapshots created`)
      } else {
        failed++
        errors.push({ itemId: item.id, sku: item.sku, error: result.error })
        console.log(`❌ Failed ${item.sku}: ${result.error}`)
      }

      // Rate limiting: wait 700ms between items to avoid hitting StockX limits
      await sleep(700)

    } catch (error) {
      failed++
      errors.push({ itemId: link.item_id, error: error.message })
      console.error(`❌ Error processing ${link.item_id}:`, error.message)
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('📊 Sync Summary:')
  console.log(`   ✅ Succeeded: ${succeeded}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log('='.repeat(70))

  if (errors.length > 0) {
    console.log('\n❌ Errors:')
    errors.forEach(e => {
      console.log(`   ${e.sku || e.itemId}: ${e.error}`)
    })
  }

  console.log('\n✅ Automated sync complete!')
}

syncAllItems().catch(console.error)
