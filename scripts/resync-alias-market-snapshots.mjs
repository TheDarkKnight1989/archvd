#!/usr/bin/env node

/**
 * Re-sync Alias market data with the fixed field mapping
 * This deletes old snapshots and fetches fresh data from Alias API
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

async function resyncAliasMarketData() {
  console.log('=== RE-SYNCING ALIAS MARKET DATA WITH FIXED MAPPING ===\n')

  // 1. Delete existing snapshots
  console.log('Step 1: Deleting old snapshots...')
  const { error: deleteError } = await supabase
    .from('alias_market_snapshots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (deleteError) {
    console.error('Error deleting snapshots:', deleteError)
    return
  }

  console.log('✓ Old snapshots deleted\n')

  // 2. Get unique catalog IDs to sync
  const { data: links, error: linksError } = await supabase
    .from('inventory_alias_links')
    .select('alias_catalog_id')
    .not('alias_catalog_id', 'is', null)

  if (linksError || !links || links.length === 0) {
    console.error('No Alias links found:', linksError)
    return
  }

  const catalogIds = [...new Set(links.map(l => l.alias_catalog_id))]

  console.log(`Step 2: Fetching fresh data for ${catalogIds.length} catalog items...\n`)

  // 3. Fetch and sync each catalog item
  for (const catalogId of catalogIds) {
    console.log(`  Syncing ${catalogId}...`)

    try {
      // Fetch from Alias API
      const response = await fetch(`https://api.alias.org/api/v1/pricing_insights/availabilities/${catalogId}`, {
        headers: {
          'Authorization': `Bearer ${aliasPat}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error(`    ✗ API error: ${response.status}`)
        continue
      }

      const data = await response.json()

      if (!data.variants || data.variants.length === 0) {
        console.log(`    ✗ No variants found`)
        continue
      }

      // Prepare snapshots with FIXED mapping
      const snapshotTime = new Date().toISOString()

      // Group variants by size and pick the best one (with most pricing data)
      const variantsBySize = new Map()
      for (const v of data.variants.filter(v => v.availability)) {
        const existing = variantsBySize.get(v.size)

        // Prefer variant with more non-zero pricing data
        const scoreVariant = (variant) => {
          let score = 0
          if (variant.availability.highest_offer_price_cents && parseInt(variant.availability.highest_offer_price_cents) > 0) score++
          if (variant.availability.lowest_listing_price_cents && parseInt(variant.availability.lowest_listing_price_cents) > 0) score++
          if (variant.availability.last_sold_listing_price_cents && parseInt(variant.availability.last_sold_listing_price_cents) > 0) score++
          return score
        }

        if (!existing || scoreVariant(v) > scoreVariant(existing)) {
          variantsBySize.set(v.size, v)
        }
      }

      const snapshots = Array.from(variantsBySize.values()).map(v => ({
        catalog_id: catalogId,
        size: v.size,
        currency: 'USD',
        // CORRECT MAPPING (no swap needed):
        // Market column = lowest_ask_cents = lowest_listing_price_cents (what sellers ask)
        // Highest Bid column = highest_bid_cents = highest_offer_price_cents (what buyers bid)
        lowest_ask_cents: v.availability.lowest_listing_price_cents
          ? parseInt(v.availability.lowest_listing_price_cents, 10)
          : null,
        highest_bid_cents: v.availability.highest_offer_price_cents
          ? parseInt(v.availability.highest_offer_price_cents, 10)
          : null,
        last_sold_price_cents: v.availability.last_sold_listing_price_cents
          ? parseInt(v.availability.last_sold_listing_price_cents, 10)
          : null,
        global_indicator_price_cents: v.availability.global_indicator_price_cents
          ? parseInt(v.availability.global_indicator_price_cents, 10)
          : null,
        snapshot_at: snapshotTime,
      }))

      // Insert into database (note: we can't use upsert with snapshot_at in conflict)
      // Instead, we'll delete old snapshots for this catalog and insert new ones
      const { error: deleteOldError } = await supabase
        .from('alias_market_snapshots')
        .delete()
        .eq('catalog_id', catalogId)

      if (deleteOldError) {
        console.error(`    ✗ Error deleting old snapshots:`, deleteOldError.message)
        continue
      }

      const { error: insertError } = await supabase
        .from('alias_market_snapshots')
        .insert(snapshots)

      if (insertError) {
        console.error(`    ✗ Database error:`, insertError.message)
      } else {
        console.log(`    ✓ Synced ${snapshots.length} variants`)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))

    } catch (error) {
      console.error(`    ✗ Error:`, error.message)
    }
  }

  console.log('\n=== SYNC COMPLETE ===\n')

  // 4. Verify the fix
  console.log('Verifying fix for size 6...')
  const { data: size6Snap } = await supabase
    .from('alias_market_snapshots')
    .select('*')
    .eq('catalog_id', 'air-jordan-5-retro-grape-2025-hq7978-100')
    .eq('size', 6)
    .single()

  if (size6Snap) {
    const market = size6Snap.lowest_ask_cents / 100
    const highestBid = size6Snap.highest_bid_cents / 100
    console.log('  Market (lowest_ask_cents):', `$${market}`)
    console.log('  Highest Bid (highest_bid_cents):', `$${highestBid}`)
    console.log()
    console.log('Expected behavior:')
    console.log('  In most cases: Market (ask) >= Highest Bid (offer) ✓')
    console.log('  If Market < Highest Bid: Crossed market (arbitrage opportunity)')
    console.log()
    console.log('Actual:', market >= highestBid ? '✓ Normal spread' : '⚠️  Crossed market (legitimate market condition)')
  } else {
    console.log('  No snapshot found for size 6')
  }
}

resyncAliasMarketData().catch(console.error)
