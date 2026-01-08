#!/usr/bin/env node

/**
 * Inventory V4 - Alias Single Catalog ID Sync
 * CLI wrapper for testing sync functions with one catalog_id
 *
 * Usage:
 *   npx tsx scripts/inventory-v4-alias-sync-single.ts dunk-low-black-white-dd1391-100
 *   npx tsx scripts/inventory-v4-alias-sync-single.ts dunk-low-black-white-dd1391-100 --refresh
 *   npx tsx scripts/inventory-v4-alias-sync-single.ts dunk-low-black-white-dd1391-100 --sales
 */

import { fullSyncAliasProductByCatalogId, syncAliasProductByCatalogId } from '@/lib/services/alias-v4/sync';

// ============================================================================
// CLI Arguments
// ============================================================================

const args = process.argv.slice(2);
const catalogId = args[0];
const forceRefresh = args.includes('--refresh') || args.includes('-r');
const fetchSales = args.includes('--sales') || args.includes('-s');

if (!catalogId) {
  console.error('❌ ERROR: Catalog ID required');
  console.error('');
  console.error('Usage:');
  console.error('  npx tsx scripts/inventory-v4-alias-sync-single.ts <catalog_id>');
  console.error('  npx tsx scripts/inventory-v4-alias-sync-single.ts dunk-low-black-white-dd1391-100');
  console.error('  npx tsx scripts/inventory-v4-alias-sync-single.ts dunk-low-black-white-dd1391-100 --refresh');
  console.error('  npx tsx scripts/inventory-v4-alias-sync-single.ts dunk-low-black-white-dd1391-100 --sales');
  console.error('');
  console.error('Options:');
  console.error('  --refresh, -r    Force full refresh (skip cache)');
  console.error('  --sales, -s      Fetch sales history (requires ALIAS_RECENT_SALES_ENABLED=true)');
  console.error('');
  process.exit(1);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🔄 INVENTORY V4 - ALIAS SINGLE CATALOG SYNC');
  console.log('='.repeat(80));
  console.log('');
  console.log('Catalog ID:', catalogId);
  console.log('Mode:', forceRefresh ? 'Force Full Sync' : 'Smart Sync (auto-detect)');
  console.log('Regions: UK 🇬🇧 → EU 🇪🇺 → US 🇺🇸 (priority order)');
  console.log('Currency: USD');
  console.log('Sales History:', fetchSales ? 'Enabled' : 'Disabled');
  console.log('');
  console.log('='.repeat(80));
  console.log('');

  const startTime = Date.now();

  try {
    // Use appropriate sync function
    const result = forceRefresh
      ? await fullSyncAliasProductByCatalogId(catalogId, { forceRefresh: true, fetchSales })
      : await syncAliasProductByCatalogId(catalogId, { fetchSales });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // ========================================================================
    // Display Results
    // ========================================================================

    console.log('');
    console.log('='.repeat(80));
    console.log('📊 SYNC RESULTS');
    console.log('='.repeat(80));
    console.log('');

    // Status
    if (result.success) {
      console.log('✅ Status: SUCCESS');
    } else {
      console.log('❌ Status: FAILED');
    }

    // Catalog ID
    if (result.catalogId) {
      console.log(`🎯 Catalog ID: ${result.catalogId}`);
    }

    // Counts
    console.log('');
    console.log('📈 Counts:');
    console.log(`  Variants Synced:          ${result.counts.variantsSynced}`);
    console.log(`  Market Data Refreshed:    ${result.counts.marketDataRefreshed}`);
    console.log(`  Price Snapshots Inserted: ${result.counts.priceSnapshotsInserted}`);
    if (fetchSales) {
      console.log(`  Sales Records Inserted:   ${result.counts.salesRecordsInserted}`);
    }

    // Errors
    if (result.errors.length > 0) {
      console.log('');
      console.log('⚠️  Errors:');
      result.errors.forEach((err, idx) => {
        const location = err.region
          ? `Region ${err.region}`
          : err.size
            ? `Size ${err.size}`
            : err.variantId
              ? `Variant ${err.variantId.substring(0, 8)}...`
              : 'N/A';
        console.log(`  ${idx + 1}. [${err.stage}] ${location}`);
        console.log(`     ${err.error}`);
      });
    } else {
      console.log('');
      console.log('✅ No errors');
    }

    // Duration
    console.log('');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('');
    console.log('='.repeat(80));
    console.log('');

    // ========================================================================
    // Database Verification
    // ========================================================================

    if (result.success && result.catalogId) {
      console.log('🔍 Database Verification:');
      console.log('');
      console.log('Run these queries to verify:');
      console.log('');
      console.log(`  -- Product`);
      console.log(`  SELECT * FROM inventory_v4_alias_products WHERE alias_catalog_id = '${result.catalogId}';`);
      console.log('');
      console.log(`  -- Variants (${result.counts.variantsSynced})`);
      console.log(`  SELECT id, size_value, size_display, consigned, region_id`);
      console.log(`  FROM inventory_v4_alias_variants WHERE alias_catalog_id = '${result.catalogId}'`);
      console.log(`  ORDER BY region_id, size_value, consigned;`);
      console.log('');
      console.log(`  -- Market Data (${result.counts.marketDataRefreshed})`);
      console.log(`  SELECT v.size_value, v.region_id, v.consigned, m.lowest_ask, m.highest_bid, m.updated_at`);
      console.log(`  FROM inventory_v4_alias_market_data m`);
      console.log(`  JOIN inventory_v4_alias_variants v ON v.id = m.alias_variant_id`);
      console.log(`  WHERE v.alias_catalog_id = '${result.catalogId}'`);
      console.log(`  ORDER BY v.region_id, v.size_value, v.consigned;`);
      console.log('');
      console.log(`  -- Price History (${result.counts.priceSnapshotsInserted})`);
      console.log(`  SELECT v.size_value, v.region_id, h.lowest_ask, h.highest_bid, h.recorded_at`);
      console.log(`  FROM inventory_v4_alias_price_history h`);
      console.log(`  JOIN inventory_v4_alias_variants v ON v.id = h.alias_variant_id`);
      console.log(`  WHERE v.alias_catalog_id = '${result.catalogId}'`);
      console.log(`  ORDER BY v.region_id, v.size_value, h.recorded_at DESC;`);
      console.log('');
      console.log(`  -- Materialized View`);
      console.log(`  SELECT * FROM inventory_v4_alias_market_latest`);
      console.log(`  WHERE alias_catalog_id = '${result.catalogId}'`);
      console.log(`  ORDER BY region_id, size_value;`);
      console.log('');
      console.log(`  -- Refresh Materialized View`);
      console.log(`  REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_v4_alias_market_latest;`);
      console.log('');
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.error('');
    console.error('='.repeat(80));
    console.error('❌ SYNC FAILED');
    console.error('='.repeat(80));
    console.error('');
    console.error('Error:', (error as Error)?.message ?? String(error));
    if ((error as Error)?.stack) {
      console.error('');
      console.error('Stack:');
      console.error((error as Error).stack);
    }
    console.error('');
    console.error(`⏱️  Duration: ${duration}s`);
    console.error('');

    process.exit(1);
  }
}

main();
