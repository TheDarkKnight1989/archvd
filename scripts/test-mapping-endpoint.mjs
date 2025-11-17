import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testMappingQuery() {
  console.log('Testing inventory_market_links query...\n')

  // Get a test item ID
  const { data: items } = await supabase
    .from('Inventory')
    .select('id')
    .limit(1)

  if (!items || items.length === 0) {
    console.log('No inventory items found')
    return
  }

  const itemId = items[0].id
  console.log('Testing with item ID:', itemId)

  console.time('Query Time')

  const { data: mapping, error } = await supabase
    .from('inventory_market_links')
    .select('stockx_product_id, stockx_variant_id')
    .eq('item_id', itemId)
    .maybeSingle()

  console.timeEnd('Query Time')

  if (error) {
    console.error('❌ Error:', error.message)
  } else {
    console.log('✅ Success:', mapping ? 'Mapping found' : 'No mapping')
  }
}

testMappingQuery().catch(console.error)
