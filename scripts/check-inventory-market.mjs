import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const skus = ['AJ4219-400', 'AT3057-100', 'IF2885-100', '910772-001', 'IB4523-004']

console.log('📊 Market data freshness for your inventory:\n')

for (const sku of skus) {
  // Get stockx product id from style catalog
  const { data: catalog } = await supabase
    .from('inventory_v4_style_catalog')
    .select('stockx_product_id, name')
    .eq('style_id', sku)
    .single()

  if (!catalog || !catalog.stockx_product_id) {
    console.log('❌', sku, '- no StockX mapping')
    continue
  }

  // Get latest market data
  const { data: market } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('updated_at, currency_code, lowest_ask, highest_bid')
    .eq('stockx_product_id', catalog.stockx_product_id)
    .order('updated_at', { ascending: false })
    .limit(6)

  if (!market || market.length === 0) {
    console.log('⚠️', sku, '-', catalog.name.substring(0, 35), '... NO MARKET DATA')
  } else {
    const latest = market[0]
    const age = (Date.now() - new Date(latest.updated_at).getTime()) / 1000 / 60
    const currencies = [...new Set(market.map(m => m.currency_code))].join('/')
    console.log('✅', sku, '-', catalog.name.substring(0, 30))
    console.log('   Last update:', Math.round(age), 'min ago | Currencies:', currencies)
    console.log('   Ask:', latest.lowest_ask, latest.currency_code, '| Bid:', latest.highest_bid)
  }
}
