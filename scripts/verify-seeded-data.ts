#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  console.log('Verifying seeded data...\n')

  // Check product_catalog
  const { data: catalog, error: catalogError } = await supabase
    .from('product_catalog')
    .select('*')
    .eq('sku', '555088-134')
    .single()

  if (catalogError) {
    console.error('❌ Error fetching catalog:', catalogError)
  } else {
    console.log('✅ Catalog entry found:')
    console.table([catalog])
  }

  // Check market prices
  const { data: prices, error: pricesError } = await supabase
    .from('product_market_prices')
    .select('*')
    .eq('sku', '555088-134')

  if (pricesError) {
    console.error('❌ Error fetching prices:', pricesError)
  } else {
    console.log(`\n✅ Found ${prices?.length || 0} prices:`)
    console.table(prices)
  }

  // Check latest_market_prices view
  const { data: latestPrices, error: latestError } = await supabase
    .from('latest_market_prices')
    .select('*')
    .eq('sku', '555088-134')

  if (latestError) {
    console.error('❌ Error fetching latest prices:', latestError)
  } else {
    console.log(`\n✅ Found ${latestPrices?.length || 0} latest prices:`)
    console.table(latestPrices)
  }
}

main().catch(console.error)
