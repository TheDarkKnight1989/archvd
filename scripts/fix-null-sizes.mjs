/**
 * Fix Null Sizes
 * Updates inventory items that have null sizes with reasonable defaults
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = process.env.USER_ID || 'fbcde760-820b-4eaf-949f-534a8130d44b'

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixNullSizes() {
  console.log('🔧 Fixing null sizes...\n')

  // Fix DZ5485-612 - Air Jordan 1 High OG
  // Since we don't know the actual size, use a common size: UK10
  const { error: error1 } = await supabase
    .from('Inventory')
    .update({
      size: 'UK10',
      size_uk: '10'
    })
    .eq('sku', 'DZ5485-612')
    .eq('user_id', userId)
    .is('size', null)

  if (error1) {
    console.error('❌ Failed to update DZ5485-612:', error1.message)
  } else {
    console.log('✓ Updated DZ5485-612 to UK10')
  }

  // Fix DZ5485-410 - Nike Dunk Low Retro
  // Since we don't know the actual size, use a common size: UK10
  const { error: error2 } = await supabase
    .from('Inventory')
    .update({
      size: 'UK10',
      size_uk: '10'
    })
    .eq('sku', 'DZ5485-410')
    .eq('user_id', userId)
    .is('size', null)

  if (error2) {
    console.error('❌ Failed to update DZ5485-410:', error2.message)
  } else {
    console.log('✓ Updated DZ5485-410 to UK10')
  }

  console.log('\n✅ Size fixes complete!')
}

fixNullSizes().catch(console.error)
