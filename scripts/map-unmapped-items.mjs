import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function mapUnmappedItems() {
  console.log('Finding items without StockX mappings...\n')

  // Get all inventory items
  const { data: allItems } = await supabase
    .from('Inventory')
    .select('id, sku, brand, model, colorway, size_uk')
    .eq('status', 'active')

  if (!allItems || allItems.length === 0) {
    console.log('No active items found')
    return
  }

  console.log(`Found ${allItems.length} active items\n`)

  // Get existing mappings
  const { data: existingMappings } = await supabase
    .from('inventory_market_links')
    .select('item_id')
    .eq('provider', 'stockx')

  const mappedItemIds = new Set(existingMappings?.map(m => m.item_id) || [])

  // Filter unmapped items
  const unmappedItems = allItems.filter(item => !mappedItemIds.has(item.id))

  console.log(`${unmappedItems.length} items need StockX mapping\n`)

  if (unmappedItems.length === 0) {
    console.log('✅ All items are already mapped!')
    return
  }

  console.log('Unmapped items:')
  unmappedItems.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.brand} ${item.model} - ${item.colorway} (${item.sku}) - UK${item.size_uk}`)
  })

  console.log('\n📋 Next steps:')
  console.log('1. Use StockX search API to find products for each item')
  console.log('2. Match by SKU/UPC')
  console.log('3. Create mappings in inventory_market_links table')
}

mapUnmappedItems().catch(console.error)
