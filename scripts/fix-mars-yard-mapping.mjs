import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const MARS_YARD_ITEM_ID = '3c386636-f732-401e-9d78-201f36a217f2'
const PRODUCT_ID = '08a9310b-8a27-4222-8c21-864a18dcaf2c'

async function fixMapping() {
  console.log('🔧 Fixing Mars Yard 1.0 mapping...\n')

  // Find the correct variant for UK 11 (which is US Men's 12)
  const { data: variants, error: varError } = await supabase
    .from('stockx_variants')
    .select('*')
    .eq('stockx_product_id', PRODUCT_ID)

  if (varError) {
    console.error('Error fetching variants:', varError)
    return
  }

  console.log('Available variants for Mars Yard 1.0:')
  console.log('=' .repeat(70))

  let correctVariant = null

  for (const variant of variants) {
    const sizeChart = variant.size_chart?.availableConversions || []
    const ukSize = sizeChart.find(s => s.type === 'uk')?.size

    console.log(`Variant ID: ${variant.stockx_variant_id}`)
    console.log(`  US Size: ${variant.variant_value}`)
    console.log(`  UK Size: ${ukSize || 'N/A'}`)

    // Look for UK 11
    if (ukSize && ukSize.includes('11') && !ukSize.includes('11.5') && !ukSize.includes('10')) {
      correctVariant = variant
      console.log('  ✅ THIS IS UK 11!')
    }
    console.log()
  }

  if (!correctVariant) {
    console.log('❌ Could not find UK 11 variant')
    return
  }

  console.log('=' .repeat(70))
  console.log('Found correct variant for UK 11:')
  console.log(`  StockX Variant ID: ${correctVariant.stockx_variant_id}`)
  console.log(`  US Size: ${correctVariant.variant_value}`)
  console.log()

  // Update the mapping
  console.log('Updating mapping...')
  const { error: updateError } = await supabase
    .from('inventory_market_links')
    .update({
      stockx_variant_id: correctVariant.stockx_variant_id,
      updated_at: new Date().toISOString()
    })
    .eq('item_id', MARS_YARD_ITEM_ID)

  if (updateError) {
    console.error('❌ Error updating mapping:', updateError)
    return
  }

  console.log('✅ Mapping updated successfully!')
  console.log()
  console.log('Now try syncing again with:')
  console.log(`fetch('/api/stockx/sync/item', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inventoryItemId: '${MARS_YARD_ITEM_ID}'
  })
}).then(r => r.json()).then(console.log)`)
}

fixMapping()
