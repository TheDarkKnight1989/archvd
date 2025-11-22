import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const MARS_YARD_ITEM_ID = '3c386636-f732-401e-9d78-201f36a217f2'

async function checkMarsYardMapping() {
  console.log('🔍 Checking Mars Yard 1.0 mapping...\n')

  // Get the inventory item
  const { data: item } = await supabase
    .from('Inventory')
    .select('*')
    .eq('id', MARS_YARD_ITEM_ID)
    .single()

  console.log('Inventory Item:')
  console.log('  SKU:', item.sku)
  console.log('  Size:', item.size)
  console.log('  Brand:', item.brand)
  console.log('  Model:', item.model, '\n')

  // Get the mapping
  const { data: link } = await supabase
    .from('inventory_market_links')
    .select('*')
    .eq('item_id', MARS_YARD_ITEM_ID)
    .single()

  console.log('Mapping:')
  console.log('  StockX Product ID:', link.stockx_product_id)
  console.log('  StockX Variant ID:', link.stockx_variant_id, '\n')

  // Get the product details
  const { data: product } = await supabase
    .from('stockx_products')
    .select('*')
    .eq('stockx_product_id', link.stockx_product_id)
    .single()

  console.log('StockX Product:')
  console.log('  UUID:', product.id)
  console.log('  StockX ID:', product.stockx_product_id)
  console.log('  Brand:', product.brand)
  console.log('  Model:', product.model)
  console.log('  Colorway:', product.colorway)
  console.log('  Style ID:', product.style_id, '\n')

  // Get the variant details
  const { data: variant } = await supabase
    .from('stockx_variants')
    .select('*')
    .eq('stockx_variant_id', link.stockx_variant_id)
    .single()

  console.log('StockX Variant:')
  console.log('  UUID:', variant.id)
  console.log('  StockX ID:', variant.stockx_variant_id)
  console.log('  Size:', variant.size_display || variant.size_value)
  console.log('  Size System:', variant.size_system, '\n')

  // Check the latest snapshot
  const { data: snapshot } = await supabase
    .from('stockx_market_snapshots')
    .select('*')
    .eq('stockx_product_id', link.stockx_product_id)
    .eq('stockx_variant_id', link.stockx_variant_id)
    .eq('currency_code', 'GBP')
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single()

  if (snapshot) {
    console.log('Latest Snapshot (GBP):')
    console.log('  Lowest Ask: £' + snapshot.lowest_ask)
    console.log('  Highest Bid:', snapshot.highest_bid ? '£' + snapshot.highest_bid : 'N/A')
    console.log('  Snapshot Time:', snapshot.snapshot_at)
  } else {
    console.log('No snapshots found')
  }
}

checkMarsYardMapping()
