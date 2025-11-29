#!/usr/bin/env node
/**
 * Check Alias market snapshot data for a specific item
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAliasMarketData() {
  console.log('\n🔍 Checking Alias market snapshots...\n')

  // Get all catalog IDs from inventory_alias_links
  const { data: links, error: linksError } = await supabase
    .from('inventory_alias_links')
    .select('inventory_id, alias_catalog_id')

  if (linksError) {
    console.error('Error fetching links:', linksError)
    return
  }

  console.log(`Found ${links?.length || 0} Alias catalog links\n`)

  if (!links || links.length === 0) {
    return
  }

  // Check for market snapshots
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('alias_market_snapshots')
    .select('catalog_id, size, currency, lowest_ask_cents, highest_bid_cents, snapshot_at')
    .order('snapshot_at', { ascending: false })
    .limit(20)

  if (snapshotsError) {
    console.error('Error fetching snapshots:', snapshotsError)
    return
  }

  console.log(`Found ${snapshots?.length || 0} market snapshots:\n`)

  if (snapshots && snapshots.length > 0) {
    for (const snap of snapshots) {
      console.log(`  Catalog: ${snap.catalog_id}`)
      console.log(`  Size: ${snap.size}`)
      console.log(`  Currency: ${snap.currency}`)
      console.log(`  Lowest Ask: ${snap.lowest_ask_cents ? `$${(snap.lowest_ask_cents / 100).toFixed(2)}` : 'N/A'}`)
      console.log(`  Highest Bid: ${snap.highest_bid_cents ? `$${(snap.highest_bid_cents / 100).toFixed(2)}` : 'N/A'}`)
      console.log(`  Snapshot: ${new Date(snap.snapshot_at).toLocaleString()}`)
      console.log()
    }
  } else {
    console.log('❌ NO Alias market snapshots found!')
    console.log('This is why the modal is showing StockX prices instead of Alias prices.')
    console.log('\nTo fix: Sync Alias market data using the /api/alias/pricing endpoint')
  }

  // Check specific inventory item to see what data it has
  const { data: inventory, error: invError } = await supabase
    .from('Inventory')
    .select('id, sku, brand, model, size_uk')
    .limit(5)

  if (inventory && inventory.length > 0) {
    console.log('\n📦 Sample inventory items:')
    for (const item of inventory) {
      console.log(`  ${item.brand} ${item.model} (${item.sku}) - Size UK ${item.size_uk}`)

      // Check if this item has Alias mapping
      const link = links.find(l => l.inventory_id === item.id)
      if (link) {
        console.log(`    ✓ Mapped to Alias catalog: ${link.alias_catalog_id}`)

        // Check if there's market data
        const snap = snapshots?.find(s => s.catalog_id === link.alias_catalog_id && s.size === item.size_uk)
        if (snap) {
          console.log(`    ✓ Has market data: $${(snap.lowest_ask_cents / 100).toFixed(2)}`)
        } else {
          console.log(`    ✗ NO market data found for size ${item.size_uk}`)
        }
      } else {
        console.log(`    ✗ Not mapped to Alias`)
      }
    }
  }
}

checkAliasMarketData()
  .then(() => {
    console.log('\n✅ Check complete')
    process.exit(0)
  })
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
