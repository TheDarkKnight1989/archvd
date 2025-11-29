#!/usr/bin/env node

/**
 * Sync market data for ALL Alias-mapped items
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

async function fetchAliasPricing(catalogId) {
  const response = await fetch(`https://api.alias.org/api/v1/pricing_insights/availabilities/${catalogId}`, {
    headers: {
      'Authorization': `Bearer ${aliasPat}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Alias API error: ${response.status}`)
  }

  return response.json()
}

async function syncAllAliasItems() {
  console.log('\n=== SYNCING MARKET DATA FOR ALL ALIAS ITEMS ===\n')

  // Get all unique catalog IDs from inventory_alias_links
  const { data: links, error: linksError } = await supabase
    .from('inventory_alias_links')
    .select('alias_catalog_id')
    .eq('mapping_status', 'ok')

  if (linksError || !links) {
    console.error('Error fetching links:', linksError)
    return
  }

  const catalogIds = [...new Set(links.map(l => l.alias_catalog_id))]

  console.log(`Found ${catalogIds.length} unique catalog IDs to sync\n`)

  let successCount = 0
  let errorCount = 0

  for (const catalogId of catalogIds) {
    console.log(`Syncing: ${catalogId}`)

    try {
      // Fetch pricing data
      const data = await fetchAliasPricing(catalogId)

      if (!data.variants || data.variants.length === 0) {
        console.log(`  ✗ No variants found`)
        errorCount++
        continue
      }

      // Group variants by size and pick the best NEW condition variant
      // Priority: NEW + GOOD_CONDITION > NEW + ANY > NEW_WITH_DEFECTS > USED (last resort)
      const variantsBySize = new Map()
      for (const v of data.variants.filter(v => v.availability)) {
        const existing = variantsBySize.get(v.size)

        const getConditionScore = (variant) => {
          const productCond = variant.product_condition || ''
          const packagingCond = variant.packaging_condition || ''

          // NEW + GOOD_CONDITION = highest priority
          if (productCond === 'PRODUCT_CONDITION_NEW' && packagingCond === 'PACKAGING_CONDITION_GOOD_CONDITION') {
            return 1000
          }
          // NEW + any other packaging
          if (productCond === 'PRODUCT_CONDITION_NEW') {
            return 500
          }
          // NEW_WITH_DEFECTS
          if (productCond === 'PRODUCT_CONDITION_NEW_WITH_DEFECTS') {
            return 100
          }
          // USED = last resort
          if (productCond === 'PRODUCT_CONDITION_USED') {
            return 10
          }
          return 0
        }

        const getDataScore = (variant) => {
          let score = 0
          if (variant.availability.highest_offer_price_cents && parseInt(variant.availability.highest_offer_price_cents) > 0) score++
          if (variant.availability.lowest_listing_price_cents && parseInt(variant.availability.lowest_listing_price_cents) > 0) score++
          if (variant.availability.last_sold_listing_price_cents && parseInt(variant.availability.last_sold_listing_price_cents) > 0) score++
          return score
        }

        const getTotalScore = (variant) => {
          return getConditionScore(variant) + getDataScore(variant)
        }

        if (!existing || getTotalScore(v) > getTotalScore(existing)) {
          variantsBySize.set(v.size, v)
        }
      }

      const snapshotTime = new Date().toISOString()
      const snapshots = Array.from(variantsBySize.values()).map(v => ({
        catalog_id: catalogId,
        size: v.size,
        currency: 'USD',
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

      // Delete old snapshots and insert new ones
      await supabase
        .from('alias_market_snapshots')
        .delete()
        .eq('catalog_id', catalogId)

      const { error: insertError } = await supabase
        .from('alias_market_snapshots')
        .insert(snapshots)

      if (insertError) {
        console.log(`  ✗ Database error: ${insertError.message}`)
        errorCount++
      } else {
        console.log(`  ✓ Synced ${snapshots.length} variants`)
        successCount++
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))

    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`)
      errorCount++
    }
  }

  console.log('\n=== SYNC COMPLETE ===')
  console.log(`Successfully synced: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log(`Total catalogs: ${catalogIds.length}`)

  // Update sync timestamps for all mappings
  console.log('\nUpdating sync timestamps...')
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('inventory_alias_links')
    .update({
      last_sync_success_at: now,
      last_sync_error: null
    })
    .eq('mapping_status', 'ok')

  if (updateError) {
    console.error('Error updating timestamps:', updateError)
  } else {
    console.log(`✓ Updated all sync timestamps to ${now}`)
  }
}

syncAllAliasItems().catch(console.error)
