#!/usr/bin/env node

/**
 * Re-sync all Alias data using the singular /availability endpoint
 * This ensures ONLY NEW + GOOD_CONDITION data
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const aliasPat = process.env.ALIAS_PAT

if (!supabaseUrl || !supabaseServiceKey || !aliasPat) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fetchAliasPricingSingular(catalogId, usSize) {
  const params = new URLSearchParams({
    catalog_id: catalogId,
    size: usSize.toString(),
    product_condition: 'PRODUCT_CONDITION_NEW',
    packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
    consigned: 'false',
  })

  const response = await fetch(`https://api.alias.org/api/v1/pricing_insights/availability?${params}`, {
    headers: {
      'Authorization': `Bearer ${aliasPat}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Alias API error ${response.status}: ${text}`)
  }

  return response.json()
}

async function resyncAll() {
  console.log('\n=== RE-SYNCING ALL ALIAS DATA (SINGULAR ENDPOINT) ===\n')

  // Step 1: Clear all existing snapshots
  console.log('Step 1: Clearing all existing snapshots...')
  const { error: deleteError } = await supabase
    .from('alias_market_snapshots')
    .delete()
    .neq('catalog_id', '')

  if (deleteError) {
    console.error('Error clearing snapshots:', deleteError)
    return
  }
  console.log('✓ Cleared all snapshots\n')

  // Step 2: Get all inventory items with Alias links
  console.log('Step 2: Fetching inventory items with Alias links...')
  const { data: links, error: linksError } = await supabase
    .from('inventory_alias_links')
    .select(`
      inventory_id,
      alias_catalog_id,
      Inventory!inner(size_uk, brand, model)
    `)
    .not('alias_catalog_id', 'is', null)
    .eq('mapping_status', 'ok')

  if (linksError || !links) {
    console.error('Error fetching links:', linksError)
    return
  }

  console.log(`✓ Found ${links.length} inventory items\n`)

  // Step 3: Sync each item individually
  console.log('Step 3: Syncing each item with NEW + GOOD_CONDITION...\n')

  let successCount = 0
  let errorCount = 0

  for (const link of links) {
    const inv = link.Inventory
    const sizeUk = parseFloat(inv.size_uk)
    const usSize = sizeUk + 1 // UK to US conversion

    console.log(`Syncing: ${inv.brand} ${inv.model} - Size ${usSize} US (${sizeUk} UK)`)
    console.log(`  Catalog: ${link.alias_catalog_id}`)

    try {
      // Fetch pricing for this specific variant
      const data = await fetchAliasPricingSingular(link.alias_catalog_id, usSize)

      const snapshot = {
        catalog_id: link.alias_catalog_id,
        size: usSize,
        currency: 'USD',
        lowest_ask_cents: data.availability.lowest_listing_price_cents
          ? parseInt(data.availability.lowest_listing_price_cents, 10)
          : null,
        highest_bid_cents: data.availability.highest_offer_price_cents
          ? parseInt(data.availability.highest_offer_price_cents, 10)
          : null,
        last_sold_price_cents: data.availability.last_sold_listing_price_cents
          ? parseInt(data.availability.last_sold_listing_price_cents, 10)
          : null,
        global_indicator_price_cents: data.availability.global_indicator_price_cents
          ? parseInt(data.availability.global_indicator_price_cents, 10)
          : null,
        snapshot_at: new Date().toISOString(),
      }

      // Insert snapshot
      const { error: insertError } = await supabase
        .from('alias_market_snapshots')
        .insert([snapshot])

      if (insertError) {
        console.log(`  ✗ Database error: ${insertError.message}`)
        errorCount++
        continue
      }

      console.log(`  ✓ $${snapshot.lowest_ask_cents ? snapshot.lowest_ask_cents/100 : 0}/$${snapshot.highest_bid_cents ? snapshot.highest_bid_cents/100 : 0}/$${snapshot.last_sold_price_cents ? snapshot.last_sold_price_cents/100 : 0}`)

      // Update sync timestamp
      await supabase
        .from('inventory_alias_links')
        .update({
          last_sync_success_at: new Date().toISOString(),
          last_sync_error: null,
        })
        .eq('inventory_id', link.inventory_id)

      successCount++

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300))

    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`)

      await supabase
        .from('inventory_alias_links')
        .update({
          last_sync_error: error.message,
        })
        .eq('inventory_id', link.inventory_id)

      errorCount++
    }
  }

  console.log('\n=== RE-SYNC COMPLETE ===')
  console.log(`Success: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log(`Total: ${links.length}`)
  console.log()
  console.log('✅ All data now uses NEW + GOOD_CONDITION from singular endpoint!')
}

resyncAll().catch(console.error)
