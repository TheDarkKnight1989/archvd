/**
 * Check StockX database tables and contents
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('='.repeat(60))
  console.log('StockX Database Tables Check')
  console.log('='.repeat(60))

  // Check stockx_accounts table
  console.log('\n📊 Checking stockx_accounts table...')
  const { data: accounts, error: accountsError, count: accountsCount } = await supabase
    .from('stockx_accounts')
    .select('*', { count: 'exact' })

  if (accountsError) {
    console.log('   ❌ Error querying stockx_accounts:', accountsError.message)
  } else {
    console.log(`   Found ${accountsCount || 0} accounts`)
    if (accounts && accounts.length > 0) {
      accounts.forEach(acc => {
        console.log('   -', {
          user_id: acc.user_id,
          created_at: acc.created_at,
          has_access_token: !!acc.access_token,
          has_refresh_token: !!acc.refresh_token,
          expires_at: acc.expires_at,
        })
      })
    }
  }

  // Check stockx_products table
  console.log('\n📊 Checking stockx_products table...')
  const { count: productsCount } = await supabase
    .from('stockx_products')
    .select('*', { count: 'exact', head: true })
  console.log(`   Found ${productsCount || 0} products`)

  // Check stockx_variants table
  console.log('\n📊 Checking stockx_variants table...')
  const { count: variantsCount } = await supabase
    .from('stockx_variants')
    .select('*', { count: 'exact', head: true })
  console.log(`   Found ${variantsCount || 0} variants`)

  // Check stockx_listings table
  console.log('\n📊 Checking stockx_listings table...')
  const { count: listingsCount } = await supabase
    .from('stockx_listings')
    .select('*', { count: 'exact', head: true })
  console.log(`   Found ${listingsCount || 0} listings`)

  // Check inventory_market_links for StockX mappings
  console.log('\n📊 Checking inventory_market_links (StockX mappings)...')
  const { data: links, count: linksCount } = await supabase
    .from('inventory_market_links')
    .select('*', { count: 'exact' })
    .eq('provider', 'stockx')

  console.log(`   Found ${linksCount || 0} StockX mappings`)
  if (links && links.length > 0) {
    console.log('   Sample mappings:')
    links.slice(0, 5).forEach(link => {
      console.log('   -', {
        item_id: link.item_id,
        stockx_product_id: link.stockx_product_id,
        stockx_variant_id: link.stockx_variant_id,
        stockx_listing_id: link.stockx_listing_id,
      })
    })
  }

  // Check if there's an integrations table (old schema)
  console.log('\n📊 Checking for legacy integrations table...')
  const { data: integrations, error: integrationsError } = await supabase
    .from('integrations')
    .select('*')
    .eq('provider', 'stockx')

  if (integrationsError) {
    console.log('   ❌ integrations table not found (expected)')
  } else {
    console.log(`   Found ${integrations?.length || 0} StockX integrations (LEGACY)`)
    if (integrations && integrations.length > 0) {
      console.log('   ⚠️  WARNING: Using legacy table!')
      integrations.forEach(int => {
        console.log('   -', {
          user_id: int.user_id,
          provider: int.provider,
          has_access_token: !!int.access_token,
          created_at: int.created_at,
        })
      })
    }
  }
}

main().catch(console.error)
