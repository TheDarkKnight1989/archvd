/**
 * Test Phase 3.5 Fix - Direct Worker Test
 *
 * Calls syncSingleInventoryItemFromStockx directly to test that
 * market snapshots are now written to the correct table
 */

import { config } from 'dotenv'
import { syncSingleInventoryItemFromStockx } from '../src/lib/providers/stockx-worker.ts'

config({ path: '.env.local' })

const TEST_ITEM_ID = '729d9d3d-b9e2-4f1e-8286-e235624b2923' // HQ6998-600 item 1
const USER_ID = 'b2a8f72c-6fa5-4f0e-9bb8-1a27d5c5f789' // Your user ID

async function testFix() {
  console.log('🧪 Testing Phase 3.5 Fix - Market Snapshot Write Target\n')
  console.log('=' .repeat(70))
  console.log('TEST ITEM:', TEST_ITEM_ID)
  console.log('=' .repeat(70) + '\n')

  try {
    console.log('📞 Calling syncSingleInventoryItemFromStockx...\n')

    const result = await syncSingleInventoryItemFromStockx({
      inventoryItemId: TEST_ITEM_ID,
      userId: USER_ID,
    })

    console.log('\n' + '=' .repeat(70))
    console.log('RESULT')
    console.log('=' .repeat(70))
    console.log(JSON.stringify(result, null, 2))

    // Check for debug info (this is a DEBUG_INVENTORY_ID)
    if (result.debug) {
      console.log('\n' + '=' .repeat(70))
      console.log('DEBUG INFO')
      console.log('=' .repeat(70))
      console.log('Table used:', result.debug.snapshotTableUsed)
      console.log('Snapshot created:', result.debug.snapshotCreationSuccess)
      console.log('V2 API success:', result.debug.v2ApiSuccess)

      if (result.debug.skipReason) {
        console.log('⚠️  Skip reason:', result.debug.skipReason)
      }

      if (result.debug.snapshotCreationSuccess) {
        console.log('✅ SUCCESS: Snapshot written to stockx_market_snapshots')
      } else {
        console.log('❌ FAILED: Snapshot NOT created')
      }
    }

    console.log('\n' + '=' .repeat(70))
    console.log('NEXT STEPS')
    console.log('=' .repeat(70))
    console.log('1. Run: node scripts/check-specific-items.mjs')
    console.log('2. Verify snapshot appears in stockx_market_snapshots table')
    console.log('3. Verify data appears in stockx_market_latest view')
    console.log('4. Check Portfolio UI to confirm market data is visible')

  } catch (error) {
    console.error('\n❌ ERROR:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testFix()
