/**
 * Backfill Master Market Data
 * Migrates existing market data from legacy tables → master_market_data
 *
 * This script:
 * 1. Reads existing stockx_market_snapshots
 * 2. Reads existing alias_market_snapshots
 * 3. Transforms and inserts into master_market_data
 * 4. Refreshes master_market_latest materialized view
 *
 * Usage:
 *   npx tsx scripts/backfill-master-market-data.ts [--dry-run] [--limit=N]
 */

import { createClient } from '@supabase/supabase-js'

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 Master Market Data Backfill Script')
  console.log('=====================================')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will write to DB)'}`)
  console.log(`Limit: ${LIMIT ? `${LIMIT} rows per table` : 'No limit (process all)'}`)
  console.log('')

  // Step 1: Backfill from stockx_market_snapshots
  console.log('📦 Step 1: Backfilling from stockx_market_snapshots...')
  const stockxCount = await backfillStockXSnapshots()
  console.log(`✅ StockX: ${stockxCount} rows processed\n`)

  // Step 2: Backfill from alias_market_snapshots
  console.log('📦 Step 2: Backfilling from alias_market_snapshots...')
  const aliasCount = await backfillAliasSnapshots()
  console.log(`✅ Alias: ${aliasCount} rows processed\n`)

  // Step 3: Refresh materialized view
  if (!DRY_RUN) {
    console.log('🔄 Step 3: Refreshing master_market_latest materialized view...')
    await refreshMaterializedView()
    console.log('✅ Materialized view refreshed\n')
  } else {
    console.log('⏭️  Step 3: Skipping materialized view refresh (dry run)\n')
  }

  // Summary
  console.log('📊 Backfill Summary')
  console.log('===================')
  console.log(`StockX rows: ${stockxCount}`)
  console.log(`Alias rows: ${aliasCount}`)
  console.log(`Total rows: ${stockxCount + aliasCount}`)
  console.log('')
  console.log('✨ Backfill complete!')
}

// ============================================================================
// STOCKX BACKFILL
// ============================================================================

async function backfillStockXSnapshots(): Promise<number> {
  // Query existing stockx_market_snapshots
  let query = supabase
    .from('stockx_market_snapshots')
    .select('*')
    .order('created_at', { ascending: false })

  if (LIMIT) {
    query = query.limit(LIMIT)
  }

  const { data: snapshots, error } = await query

  if (error) {
    console.error('❌ Error fetching StockX snapshots:', error)
    return 0
  }

  if (!snapshots || snapshots.length === 0) {
    console.log('⚠️  No StockX snapshots found')
    return 0
  }

  console.log(`   Found ${snapshots.length} StockX snapshots`)

  let processedCount = 0

  for (const snapshot of snapshots) {
    try {
      // Transform to master_market_data format
      const masterRow = {
        // Provider identification
        provider: 'stockx',
        provider_source: 'stockx_market_snapshots_backfill',
        provider_product_id: snapshot.product_id,
        provider_variant_id: snapshot.variant_id,

        // Normalized identifiers
        sku: snapshot.sku,
        size_key: snapshot.size,
        size_numeric: parseSizeNumeric(snapshot.size),
        size_system: 'US',

        // Currency context
        currency_code: snapshot.currency || 'USD',

        // Pricing data (stockx_market_snapshots already in major units)
        lowest_ask: snapshot.lowest_ask,
        highest_bid: snapshot.highest_bid,
        last_sale_price: snapshot.last_sale,

        // Volume indicators
        sales_last_72h: snapshot.sales_last_72h,
        sales_last_30d: null, // Not tracked in old table

        // StockX-specific
        average_deadstock_price: snapshot.average_price,
        volatility: snapshot.volatility,

        // Metadata
        snapshot_at: snapshot.as_of || snapshot.created_at,
        ingested_at: new Date(),
        raw_snapshot_id: null, // Legacy data doesn't have raw snapshots
        raw_snapshot_provider: 'stockx',
      }

      if (!DRY_RUN) {
        // Insert (ignore conflicts - may already exist)
        const { error: insertError } = await supabase
          .from('master_market_data')
          .insert(masterRow)
          .select()

        if (insertError) {
          // Log but don't fail - may be duplicate constraint violation
          if (!insertError.message.includes('duplicate key value')) {
            console.error(`   ⚠️  Insert failed for ${snapshot.sku} / ${snapshot.size}:`, insertError.message)
          }
        } else {
          processedCount++
        }
      } else {
        processedCount++
      }
    } catch (err) {
      console.error(`   ❌ Error processing snapshot ${snapshot.id}:`, err)
    }
  }

  return processedCount
}

// ============================================================================
// ALIAS BACKFILL
// ============================================================================

async function backfillAliasSnapshots(): Promise<number> {
  // Query existing alias_market_snapshots
  let query = supabase
    .from('alias_market_snapshots')
    .select('*')
    .order('created_at', { ascending: false })

  if (LIMIT) {
    query = query.limit(LIMIT)
  }

  const { data: snapshots, error } = await query

  if (error) {
    console.error('❌ Error fetching Alias snapshots:', error)
    return 0
  }

  if (!snapshots || snapshots.length === 0) {
    console.log('⚠️  No Alias snapshots found')
    return 0
  }

  console.log(`   Found ${snapshots.length} Alias snapshots`)

  let processedCount = 0

  for (const snapshot of snapshots) {
    try {
      // Parse Alias prices (may be in cents or already converted - check magnitude)
      let lowestAsk = snapshot.lowest_ask
      let highestOffer = snapshot.highest_offer

      // If values are > 1000, assume they're in cents and convert
      if (lowestAsk && lowestAsk > 1000) {
        lowestAsk = lowestAsk / 100
      }
      if (highestOffer && highestOffer > 1000) {
        highestOffer = highestOffer / 100
      }

      // Transform to master_market_data format
      const masterRow = {
        // Provider identification
        provider: 'alias',
        provider_source: 'alias_market_snapshots_backfill',
        provider_product_id: snapshot.catalog_id,
        provider_variant_id: null,

        // Normalized identifiers
        sku: snapshot.sku,
        size_key: snapshot.size?.toString() || 'Unknown',
        size_numeric: snapshot.size,
        size_system: 'US', // Alias defaults to US

        // Currency context
        currency_code: 'USD', // Alias only supports USD
        region_code: snapshot.region_id || 'global',

        // Pricing data (converted to major units above)
        lowest_ask: lowestAsk,
        highest_bid: highestOffer,
        last_sale_price: null,

        // Market depth
        ask_count: snapshot.number_of_listings,
        bid_count: snapshot.number_of_offers,

        // Metadata
        snapshot_at: snapshot.as_of || snapshot.created_at,
        ingested_at: new Date(),
        raw_snapshot_id: null, // Legacy data doesn't have raw snapshots
        raw_snapshot_provider: 'alias',
      }

      if (!DRY_RUN) {
        // Insert (ignore conflicts)
        const { error: insertError } = await supabase
          .from('master_market_data')
          .insert(masterRow)
          .select()

        if (insertError) {
          if (!insertError.message.includes('duplicate key value')) {
            console.error(`   ⚠️  Insert failed for ${snapshot.sku} / ${snapshot.size}:`, insertError.message)
          }
        } else {
          processedCount++
        }
      } else {
        processedCount++
      }
    } catch (err) {
      console.error(`   ❌ Error processing snapshot ${snapshot.id}:`, err)
    }
  }

  return processedCount
}

// ============================================================================
// MATERIALIZED VIEW REFRESH
// ============================================================================

async function refreshMaterializedView(): Promise<void> {
  const { error } = await supabase.rpc('refresh_master_market_latest')

  if (error) {
    console.error('❌ Error refreshing materialized view:', error)
    throw error
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseSizeNumeric(sizeKey: string | null): number | null {
  if (!sizeKey) return null

  const cleaned = sizeKey.replace(/[^0-9.]/g, '')
  if (!cleaned) return null

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}

// ============================================================================
// RUN
// ============================================================================

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Backfill failed:', err)
    process.exit(1)
  })
