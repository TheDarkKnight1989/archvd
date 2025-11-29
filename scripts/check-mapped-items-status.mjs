#!/usr/bin/env node

/**
 * Check status of mapped Alias items
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkMappedItems() {
  console.log('\n=== MAPPED ALIAS ITEMS STATUS ===\n')

  // Get all mappings with inventory details
  const { data: mappings, error: mappingsError } = await supabase
    .from('inventory_alias_links')
    .select(`
      *,
      inventory:Inventory!inventory_id (
        id,
        sku,
        brand,
        model,
        size_uk
      )
    `)

  if (mappingsError) {
    console.error('Error fetching mappings:', mappingsError)
    return
  }

  if (!mappings || mappings.length === 0) {
    console.log('No Alias mappings found!')
    return
  }

  console.log(`Found ${mappings.length} mapped items:\n`)

  for (const mapping of mappings) {
    const inv = mapping.inventory
    console.log(`${inv.brand} ${inv.model} (${inv.sku}) - Size UK ${inv.size_uk}`)
    console.log(`  Catalog ID: ${mapping.alias_catalog_id}`)
    console.log(`  Listing ID: ${mapping.alias_listing_id || 'N/A'}`)
    console.log(`  Mapping Status: ${mapping.mapping_status}`)
    console.log(`  Last Sync Success: ${mapping.last_sync_success_at || 'Never'}`)
    console.log(`  Last Sync Error: ${mapping.last_sync_error || 'None'}`)

    // Check if there's market data for this item
    const { data: snapshot, error: snapError } = await supabase
      .from('alias_market_snapshots')
      .select('*')
      .eq('catalog_id', mapping.alias_catalog_id)
      .eq('size', inv.size_uk)
      .single()

    if (snapshot) {
      console.log(`  Market Data: ✓ Market=$${snapshot.lowest_ask_cents / 100}, Bid=$${snapshot.highest_bid_cents / 100}`)
    } else {
      console.log(`  Market Data: ✗ No snapshot for size ${inv.size_uk}`)
    }
    console.log()
  }

  // Count items with sync timestamps
  const withSync = mappings.filter(m => m.last_sync_success_at).length
  console.log(`\n=== SUMMARY ===`)
  console.log(`Mapped items: ${mappings.length}`)
  console.log(`With sync timestamp: ${withSync}`)
  console.log(`Without sync timestamp: ${mappings.length - withSync}`)

  if (withSync < mappings.length) {
    console.log('\n⚠️  Some items are missing last_sync_success_at timestamp!')
    console.log('This may cause them not to appear in the "Last synced" filter.')
    console.log('Run the resync script to update timestamps.')
  }
}

checkMappedItems().catch(console.error)
