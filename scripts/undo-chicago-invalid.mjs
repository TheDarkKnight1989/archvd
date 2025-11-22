import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

console.log('🔧 UNDO: Restoring Chicago Low mappings to "ok" status\n')

const CHICAGO_ITEM_IDS = [
  '729d9d3d-b9e2-4f1e-8286-e235624b2923', // UK 9
  '85a1fbbd-b271-4961-b65b-4d862ec2ac23'  // UK 11
]

// Update mapping_status back to 'ok'
for (const itemId of CHICAGO_ITEM_IDS) {
  const { error } = await supabase
    .from('inventory_market_links')
    .update({ mapping_status: 'ok' })
    .eq('item_id', itemId)
  
  if (error) {
    console.log(`❌ Failed to restore ${itemId}: ${error.message}`)
  } else {
    console.log(`✅ Restored mapping_status to 'ok' for item ${itemId}`)
  }
}

console.log('\n✅ Done - mappings restored to ok status\n')
