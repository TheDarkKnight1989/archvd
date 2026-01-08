#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function deleteZombies() {
  const zombieSkus = ['HQ8487-500', 'IM7410-001']

  console.log('\n🧹 DELETING ZOMBIE PRODUCTS\n')
  console.log('='.repeat(80))

  for (const sku of zombieSkus) {
    console.log(`\n${sku}:`)

    // Delete from inventory_v4_stockx_products
    const { error: deleteError } = await supabase
      .from('inventory_v4_stockx_products')
      .delete()
      .eq('style_id', sku)

    if (deleteError) {
      console.log(`  ❌ Error deleting: ${deleteError.message}`)
    } else {
      console.log(`  ✅ Deleted from inventory_v4_stockx_products`)
    }

    // Also delete from sync queue to clean up
    const { error: queueError } = await supabase
      .from('inventory_v4_sync_queue')
      .delete()
      .eq('style_id', sku)

    if (queueError) {
      console.log(`  ⚠️  Could not delete from queue: ${queueError.message}`)
    } else {
      console.log(`  ✅ Deleted from sync queue`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n✅ Cleanup complete!\n')
  console.log('📝 Next Steps:')
  console.log('  1. Go to http://localhost:3000/portfolio/admin/styles')
  console.log('  2. Add 4 SKUs')
  console.log('  3. This will trigger the sync queue automatically')
  console.log('  4. Run: npx tsx scripts/inventory-v4-sync-worker.ts')
  console.log('\n')
}

deleteZombies()
