import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function backfill() {
  // Get items missing url_key but have product_id
  const { data: catalog } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_product_id')
    .not('stockx_product_id', 'is', null)
    .is('stockx_url_key', null)

  if (!catalog || catalog.length === 0) {
    console.log('No items need backfill')
    return
  }

  console.log('Items to backfill:', catalog.length)

  for (const item of catalog) {
    // Look up url_key from stockx_products table
    const { data: product } = await supabase
      .from('inventory_v4_stockx_products')
      .select('url_key')
      .eq('stockx_product_id', item.stockx_product_id)
      .single()

    if (product && product.url_key) {
      const { error } = await supabase
        .from('inventory_v4_style_catalog')
        .update({ stockx_url_key: product.url_key })
        .eq('style_id', item.style_id)

      if (error) {
        console.log('Failed:', item.style_id, error.message)
      } else {
        console.log('Updated:', item.style_id, '->', product.url_key)
      }
    } else {
      console.log('No url_key found for:', item.style_id)
    }
  }

  console.log('Done!')
}

backfill()
