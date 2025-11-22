#!/usr/bin/env node
/**
 * PHASE 3.7: Test both Chicago Low items + one working item
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

const USER_ID = 'fbcde760-820b-4eaf-949f-534a8130d44b'

// Test items
const items = [
  { id: '729d9d3d-b9e2-4f1e-8286-e235624b2923', sku: 'HQ6998-600', size: '9', desc: 'Chicago Low (size 9)' },
  { id: '85a1fbbd-b271-4961-b65b-4d862ec2ac23', sku: 'HQ6998-600', size: '11', desc: 'Chicago Low (size 11)' },
  { id: '3c386636-f732-401e-9d78-201f36a217f2', sku: 'AA2261-100', size: '10.5', desc: 'White/Gum (working item)' },
]

console.log('🔍 PHASE 3.7: Testing Chicago Low fix + regression check\n')

// Import worker function
const { syncSingleInventoryItemFromStockx } = await import('../src/lib/providers/stockx-worker.ts')

let passed = 0
let failed = 0

for (const item of items) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📦 Testing: ${item.desc} (${item.sku}:${item.size})`)
  console.log('='.repeat(70))

  try {
    const result = await syncSingleInventoryItemFromStockx({
      inventoryItemId: item.id,
      userId: USER_ID,
    })

    if (result.market.snapshotsCreated > 0) {
      console.log(`✅ PASSED: ${result.market.snapshotsCreated} snapshot(s) created`)
      passed++
    } else {
      console.log(`❌ FAILED: No snapshots created`)
      console.log(`   Error: ${result.error || 'Unknown'}`)
      failed++
    }
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}`)
    failed++
  }

  // Small delay between items
  await new Promise(resolve => setTimeout(resolve, 1000))
}

console.log(`\n${'='.repeat(70)}`)
console.log('📊 Final Results:')
console.log(`   ✅ Passed: ${passed}/${items.length}`)
console.log(`   ❌ Failed: ${failed}/${items.length}`)
console.log('='.repeat(70))

if (failed === 0) {
  console.log('\n🎉 All items synced successfully! Chicago Low fix is working.')
} else {
  console.log(`\n⚠️  ${failed} item(s) failed. Review errors above.`)
  process.exit(1)
}
