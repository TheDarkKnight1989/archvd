/**
 * Simple test for repricing suggestions
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  console.log('🔍 Testing Repricing Suggestions\n')

  // Get first user
  const { data: users } = await supabase
    .from('Inventory')
    .select('user_id')
    .limit(1)

  if (!users || users.length === 0) {
    console.log('❌ No inventory found')
    return
  }

  const userId = users[0].user_id
  console.log(`User ID: ${userId}\n`)

  // Step 1: Fetch inventory
  const { data: inventory, error: invError } = await supabase
    .from('Inventory')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'listed', 'worn'])

  console.log(`📦 Inventory items: ${inventory?.length || 0}`)
  if (invError) console.error('Error:', invError)

  if (!inventory || inventory.length === 0) return

  // Step 2: Fetch StockX mappings
  const { data: stockxMappings, error: sxError } = await supabase
    .from('inventory_market_links')
    .select('*')
    .in('item_id', inventory.map(i => i.id))

  console.log(`🔗 StockX mappings: ${stockxMappings?.length || 0}`)
  if (sxError) console.error('Error:', sxError)

  // Step 3: Fetch Alias mappings
  const { data: aliasMappings, error: aliasError } = await supabase
    .from('inventory_alias_links')
    .select('*')
    .in('inventory_id', inventory.map(i => i.id))

  console.log(`🔗 Alias mappings: ${aliasMappings?.length || 0}`)
  if (aliasError) console.error('Error:', aliasError)

  // Step 4: Fetch StockX market data
  const stockxVariantIds = stockxMappings?.map(m => m.stockx_variant_id).filter(Boolean) || []
  if (stockxVariantIds.length > 0) {
    const { data: stockxMarket, error: smError } = await supabase
      .from('stockx_market_latest')
      .select('*')
      .in('variant_id', stockxVariantIds)
      .limit(5)

    console.log(`📈 StockX market data: ${stockxMarket?.length || 0}`)
    if (smError) console.error('Error:', smError)
    if (stockxMarket && stockxMarket.length > 0) {
      console.log('Sample:', stockxMarket[0])
    }
  }

  // Step 5: Fetch Alias market data
  const aliasCatalogIds = aliasMappings?.map(m => m.alias_catalog_id).filter(Boolean) || []
  if (aliasCatalogIds.length > 0) {
    const { data: aliasMarket, error: amError } = await supabase
      .from('alias_market_snapshots')
      .select('*')
      .in('catalog_id', aliasCatalogIds)
      .limit(5)

    console.log(`📈 Alias market data: ${aliasMarket?.length || 0}`)
    if (amError) console.error('Error:', amError)
    if (aliasMarket && aliasMarket.length > 0) {
      console.log('Sample:', aliasMarket[0])
    }
  }

  // Check age of inventory
  const now = new Date()
  const aged = inventory.filter(item => {
    const purchaseDate = item.purchase_date ? new Date(item.purchase_date) : new Date(item.created_at)
    const days = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
    return days >= 30
  })

  console.log(`\n⏰ Items > 30 days old: ${aged.length}`)
  if (aged.length > 0) {
    const sample = aged[0]
    const purchaseDate = sample.purchase_date ? new Date(sample.purchase_date) : new Date(sample.created_at)
    const days = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
    console.log(`   Sample: ${sample.sku} - ${days} days old`)
  }
}

test()
