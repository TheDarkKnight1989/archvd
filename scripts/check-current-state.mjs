/**
 * Check current state of active inventory
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

console.log('📊 CHECKING CURRENT INVENTORY STATE\n')

// Get active inventory
const { data: active, error } = await supabase
  .from('Inventory')
  .select('sku, brand, model, colorway, size_uk, image_url, purchase_price, status')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])
  .order('created_at', { ascending: false })

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log(`Found ${active?.length || 0} active items:\n`)

let hasImages = 0
let noImages = 0
let totalInvested = 0

for (const item of active || []) {
  const hasImage = item.image_url && item.image_url !== ''
  if (hasImage) hasImages++
  else noImages++

  totalInvested += item.purchase_price || 0

  console.log(`${hasImage ? '✅' : '❌'} ${item.sku}`)
  console.log(`   ${item.brand} ${item.model}${item.colorway ? ' - ' + item.colorway : ''}`)
  console.log(`   Size: ${item.size_uk || 'N/A'} | Price: £${item.purchase_price || 0}`)
  console.log(`   Image: ${hasImage ? '✓ Yes' : '✗ None'}`)
  if (hasImage) {
    console.log(`   URL: ${item.image_url}`)
  }
  console.log()
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`  SUMMARY`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`  Active items: ${active?.length || 0}`)
console.log(`  With images: ${hasImages}`)
console.log(`  Without images: ${noImages}`)
console.log(`  Total invested: £${totalInvested.toFixed(2)}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
