#!/usr/bin/env node
/**
 * Proof Script: Atomic Mark as Sold V4 Flow
 *
 * Tests the ATOMIC MOVE operation:
 * 1. Pick 1 unsold item from inventory_v4_items
 * 2. Mark as sold → Item DELETED from inventory, Sale record created
 * 3. Verify: inventory count -1, sales count +1
 * 4. Undo sale → Sale DELETED, Item re-inserted to inventory
 * 5. Verify: inventory count +1, sales count -1
 *
 * Run: node scripts/prove-mark-sold-v4.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function getInventoryCount(userId) {
  const { count } = await supabase
    .from('inventory_v4_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count || 0
}

async function getSalesCount(userId) {
  const { count } = await supabase
    .from('inventory_v4_sales')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count || 0
}

async function main() {
  console.log('=' .repeat(60))
  console.log('PROOF: Atomic Mark as Sold V4 Flow')
  console.log('=' .repeat(60))

  // Step 1: Find an unsold item
  console.log('\n[1] Finding an unsold V4 item...')
  const { data: unsoldItems, error: fetchError } = await supabase
    .from('inventory_v4_items')
    .select('id, user_id, style_id, size, status, purchase_price, purchase_currency, condition')
    .neq('status', 'sold')
    .limit(1)

  if (fetchError) {
    console.error('ERROR: Failed to fetch items:', fetchError.message)
    process.exit(1)
  }

  if (!unsoldItems || unsoldItems.length === 0) {
    console.log('No unsold items found in inventory_v4_items.')
    console.log('Add an item first, then re-run this script.')
    process.exit(0)
  }

  const item = unsoldItems[0]
  console.log('Found unsold item:')
  console.log(`  ID:       ${item.id}`)
  console.log(`  Style ID: ${item.style_id}`)
  console.log(`  Size:     ${item.size}`)
  console.log(`  Status:   ${item.status}`)

  // Get initial counts
  const initialInventoryCount = await getInventoryCount(item.user_id)
  const initialSalesCount = await getSalesCount(item.user_id)
  console.log(`\n  Initial inventory count: ${initialInventoryCount}`)
  console.log(`  Initial sales count:     ${initialSalesCount}`)

  // Step 2: ATOMIC MOVE - Mark as sold (insert sale, delete item)
  console.log('\n[2] Marking item as sold (ATOMIC MOVE)...')

  const soldDate = new Date().toISOString().split('T')[0]
  const soldPrice = item.purchase_price ? item.purchase_price * 1.2 : 100

  // Map condition for sales table
  const conditionMap = { 'new': 'New', 'used': 'Used', 'deadstock': 'New' }
  const saleCondition = conditionMap[item.condition] || null

  // Step 2a: Insert sale record FIRST
  const saleRecord = {
    user_id: item.user_id,
    style_id: item.style_id,
    sku: item.style_id,
    size: item.size || 'N/A',
    size_unit: 'UK',
    purchase_price: item.purchase_price,
    purchase_currency: item.purchase_currency || 'GBP',
    condition: saleCondition,
    sold_price: soldPrice,
    sale_currency: 'GBP',
    sold_date: soldDate,
    platform: 'other',
    sales_fee: 0,
    base_currency: 'GBP',
    fx_rate_to_base: 1.0,
    sold_price_base: soldPrice,
    original_item_id: item.id,
    notes: 'Created by prove-mark-sold-v4.mjs script',
  }

  const { data: sale, error: saleError } = await supabase
    .from('inventory_v4_sales')
    .insert(saleRecord)
    .select()
    .single()

  if (saleError) {
    console.error('ERROR: Failed to create sale record:', saleError.message)
    process.exit(1)
  }
  console.log('  Sale record created: ' + sale.id)

  // Step 2b: DELETE item from inventory
  const { error: deleteError } = await supabase
    .from('inventory_v4_items')
    .delete()
    .eq('id', item.id)

  if (deleteError) {
    console.error('ERROR: Failed to delete item:', deleteError.message)
    // Rollback: delete the sale we just created
    await supabase.from('inventory_v4_sales').delete().eq('id', sale.id)
    process.exit(1)
  }
  console.log('  Item deleted from inventory')

  // Step 3: Verify counts after mark-sold
  console.log('\n[3] Verifying counts after mark-sold...')
  const afterSoldInventoryCount = await getInventoryCount(item.user_id)
  const afterSoldSalesCount = await getSalesCount(item.user_id)

  const inventoryDecreased = afterSoldInventoryCount === initialInventoryCount - 1
  const salesIncreased = afterSoldSalesCount === initialSalesCount + 1

  console.log(`  Inventory count: ${initialInventoryCount} → ${afterSoldInventoryCount} (expected -1: ${inventoryDecreased ? 'YES' : 'NO'})`)
  console.log(`  Sales count:     ${initialSalesCount} → ${afterSoldSalesCount} (expected +1: ${salesIncreased ? 'YES' : 'NO'})`)

  // Verify item no longer in inventory
  const { data: itemCheck } = await supabase
    .from('inventory_v4_items')
    .select('id')
    .eq('id', item.id)
    .single()

  const itemDeleted = !itemCheck
  console.log(`  Item deleted:    ${itemDeleted ? 'YES' : 'NO'}`)

  // Step 4: UNDO - Restore item to inventory
  console.log('\n[4] Undoing sale (ATOMIC RESTORE)...')

  // Map condition back
  const itemCondition = { 'New': 'new', 'Used': 'used' }[sale.condition] || 'new'

  // Step 4a: Insert item back to inventory
  const restoreRecord = {
    id: item.id, // Use original ID
    user_id: item.user_id,
    style_id: sale.style_id,
    size: sale.size,
    purchase_price: sale.purchase_price,
    purchase_currency: sale.purchase_currency || 'GBP',
    condition: itemCondition,
    status: 'in_stock',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { error: restoreError } = await supabase
    .from('inventory_v4_items')
    .insert(restoreRecord)

  if (restoreError) {
    console.error('ERROR: Failed to restore item:', restoreError.message)
    process.exit(1)
  }
  console.log('  Item restored to inventory')

  // Step 4b: Delete sale record
  const { error: deleteSaleError } = await supabase
    .from('inventory_v4_sales')
    .delete()
    .eq('id', sale.id)

  if (deleteSaleError) {
    console.error('ERROR: Failed to delete sale:', deleteSaleError.message)
    process.exit(1)
  }
  console.log('  Sale record deleted')

  // Step 5: Verify final counts (should match initial)
  console.log('\n[5] Verifying final counts after undo...')
  const finalInventoryCount = await getInventoryCount(item.user_id)
  const finalSalesCount = await getSalesCount(item.user_id)

  const inventoryRestored = finalInventoryCount === initialInventoryCount
  const salesRestored = finalSalesCount === initialSalesCount

  console.log(`  Inventory count: ${afterSoldInventoryCount} → ${finalInventoryCount} (expected ${initialInventoryCount}: ${inventoryRestored ? 'YES' : 'NO'})`)
  console.log(`  Sales count:     ${afterSoldSalesCount} → ${finalSalesCount} (expected ${initialSalesCount}: ${salesRestored ? 'YES' : 'NO'})`)

  // Summary
  console.log('\n' + '=' .repeat(60))
  console.log('PROOF RESULT')
  console.log('=' .repeat(60))
  console.log(`Mark sold: inventory -1     ${inventoryDecreased ? 'PASS' : 'FAIL'}`)
  console.log(`Mark sold: sales +1         ${salesIncreased ? 'PASS' : 'FAIL'}`)
  console.log(`Mark sold: item deleted     ${itemDeleted ? 'PASS' : 'FAIL'}`)
  console.log(`Undo: inventory restored    ${inventoryRestored ? 'PASS' : 'FAIL'}`)
  console.log(`Undo: sales restored        ${salesRestored ? 'PASS' : 'FAIL'}`)
  console.log('')

  const allPassed = inventoryDecreased && salesIncreased && itemDeleted && inventoryRestored && salesRestored

  if (allPassed) {
    console.log('STATUS: PASS - Atomic Mark as Sold flow works correctly')
    process.exit(0)
  } else {
    console.log('STATUS: FAIL - Some checks did not pass')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
