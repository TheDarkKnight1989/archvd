#!/usr/bin/env node
/**
 * PHASE 3.7: Test sync for one Chicago Low item to diagnose snapshot insertion failure
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

// Chicago Low size 9
const ITEM_ID = '729d9d3d-b9e2-4f1e-8286-e235624b2923'
const USER_ID = 'fbcde760-820b-4eaf-949f-534a8130d44b'

console.log('🔍 PHASE 3.7: Testing Chicago Low sync\n')
console.log(`Item ID: ${ITEM_ID}`)
console.log(`SKU: HQ6998-600 (size 9)\n`)

// Import and call worker function
const { syncSingleInventoryItemFromStockx } = await import('../src/lib/providers/stockx-worker.ts')

const result = await syncSingleInventoryItemFromStockx({
  inventoryItemId: ITEM_ID,
  userId: USER_ID,
})

console.log('\n' + '='.repeat(70))
console.log('📊 Result:')
console.log(JSON.stringify(result, null, 2))
console.log('='.repeat(70))
