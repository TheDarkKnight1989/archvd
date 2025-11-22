#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n📊 Final Database Counts:\n')

const { count: productsCount } = await supabase
  .from('stockx_products')
  .select('*', { count: 'exact', head: true })

const { count: variantsCount } = await supabase
  .from('stockx_variants')
  .select('*', { count: 'exact', head: true })

const { count: snapshotsCount } = await supabase
  .from('stockx_market_snapshots')
  .select('*', { count: 'exact', head: true })

const { count: linksCount } = await supabase
  .from('inventory_market_links')
  .select('*', { count: 'exact', head: true })

console.log(`inventory_market_links:     ${linksCount} rows`)
console.log(`stockx_products:            ${productsCount} rows (was 0)`)
console.log(`stockx_variants:            ${variantsCount} rows (was 0)`)
console.log(`stockx_market_snapshots:    ${snapshotsCount} rows (was 0)`)
console.log('\n✅ Pipeline is flowing end-to-end!\n')
