import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Get SKUs that have stockx_url_key but no stockx_product_id
const { data, error } = await supabase
  .from('inventory_v4_style_catalog')
  .select('style_id, stockx_url_key, stockx_product_id, alias_catalog_id')
  .not('stockx_url_key', 'is', null)
  .is('stockx_product_id', null)

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

console.log('SKUs needing StockX sync:', data.map(d => d.style_id).join('\n'))
