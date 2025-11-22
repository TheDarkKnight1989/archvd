/**
 * Check actual mapping data for specific item
 * This will help us understand why the worker reports "No mapping"
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TEST_ITEM_ID = '3c386636-f732-401e-9d78-201f36a217f2'

async function checkMappingData() {
  console.log('🔍 Checking mapping data for item:', TEST_ITEM_ID)
  console.log('=' .repeat(70) + '\n')

  // Check inventory_market_links
  const { data: link, error: linkError } = await supabase
    .from('inventory_market_links')
    .select('*')
    .eq('item_id', TEST_ITEM_ID)
    .single()

  if (linkError) {
    console.error('❌ Error fetching link:', linkError)
    return
  }

  if (!link) {
    console.log('❌ No link found in inventory_market_links')
    return
  }

  console.log('✅ Found link in inventory_market_links:')
  console.log(JSON.stringify(link, null, 2))
  console.log()

  // Check what the worker expects
  console.log('=' .repeat(70))
  console.log('WORKER EXPECTATION CHECK')
  console.log('=' .repeat(70))

  console.log('\n1. stockx_product_id:', link.stockx_product_id)
  console.log('   Type:', typeof link.stockx_product_id)
  console.log('   Truthy:', !!link.stockx_product_id)

  console.log('\n2. stockx_variant_id:', link.stockx_variant_id)
  console.log('   Type:', typeof link.stockx_variant_id)
  console.log('   Truthy:', !!link.stockx_variant_id)

  console.log('\n3. Both present:', !!(link.stockx_product_id && link.stockx_variant_id))

  // Check if the IDs exist in their respective tables
  if (link.stockx_product_id) {
    console.log('\n' + '=' .repeat(70))
    console.log('CHECKING stockx_products TABLE')
    console.log('=' .repeat(70))

    const { data: product, error: prodError } = await supabase
      .from('stockx_products')
      .select('id, stockx_product_id, name')
      .eq('stockx_product_id', link.stockx_product_id)
      .single()

    if (prodError) {
      console.log('❌ Product not found:', prodError.message)
    } else {
      console.log('✅ Product found:')
      console.log('   UUID:', product.id)
      console.log('   StockX ID:', product.stockx_product_id)
      console.log('   Name:', product.name)
    }
  }

  if (link.stockx_variant_id) {
    console.log('\n' + '=' .repeat(70))
    console.log('CHECKING stockx_variants TABLE')
    console.log('=' .repeat(70))

    const { data: variant, error: varError } = await supabase
      .from('stockx_variants')
      .select('id, stockx_variant_id, size_display')
      .eq('stockx_variant_id', link.stockx_variant_id)
      .single()

    if (varError) {
      console.log('❌ Variant not found:', varError.message)
    } else {
      console.log('✅ Variant found:')
      console.log('   UUID:', variant.id)
      console.log('   StockX ID:', variant.stockx_variant_id)
      console.log('   Size:', variant.size_display)
    }
  }

  // Check the inventory item
  console.log('\n' + '=' .repeat(70))
  console.log('CHECKING INVENTORY ITEM')
  console.log('=' .repeat(70))

  const { data: item, error: itemError } = await supabase
    .from('Inventory')
    .select('id, sku, size, brand, model')
    .eq('id', TEST_ITEM_ID)
    .single()

  if (itemError) {
    console.log('❌ Item not found:', itemError.message)
  } else {
    console.log('✅ Item found:')
    console.log(JSON.stringify(item, null, 2))
  }
}

checkMappingData()
