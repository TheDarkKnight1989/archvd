#!/usr/bin/env node

/**
 * Inventory V4 - StockX Single SKU Sync
 * CLI wrapper for testing sync functions with one SKU
 *
 * Usage:
 *   node scripts/inventory-v4-stockx-sync-single.mjs DD1391-100
 *   node scripts/inventory-v4-stockx-sync-single.mjs DD1391-100 --refresh
 */

import { fullSyncStockxProductBySku, syncStockxProductBySku } from '@/lib/services/stockx-v4/sync';

// ============================================================================
// CLI Arguments
// ============================================================================

const args = process.argv.slice(2);
const sku = args[0];
const forceRefresh = args.includes('--refresh') || args.includes('-r');

if (!sku) {
  console.error('❌ ERROR: SKU required');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/inventory-v4-stockx-sync-single.mjs <SKU>');
  console.error('  node scripts/inventory-v4-stockx-sync-single.mjs DD1391-100');
  console.error('  node scripts/inventory-v4-stockx-sync-single.mjs DD1391-100 --refresh');
  console.error('');
  process.exit(1);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🔄 INVENTORY V4 - STOCKX SINGLE SKU SYNC');
  console.log('='.repeat(80));
  console.log('');
  console.log('SKU:', sku);
  console.log('Mode:', forceRefresh ? 'Force Full Sync' : 'Smart Sync (auto-detect)');
  console.log('Currency: GBP 🇬🇧');
  console.log('');
  console.log('='.repeat(80));
  console.log('');

  const startTime = Date.now();

  try {
    // Use appropriate sync function
    const result = forceRefresh
      ? await fullSyncStockxProductBySku(sku)
      : await syncStockxProductBySku(sku);

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

    // Product ID
    if (result.productId) {
      console.log(`🎯 Product ID: ${result.productId}`);
    }

    // Counts
    console.log('');
    console.log('📈 Counts:');
    console.log(`  Variants Synced:         ${result.counts.variantsSynced}`);
    console.log(`  Market Data Refreshed:   ${result.counts.marketDataRefreshed}`);
    console.log(`  Price Snapshots Inserted: ${result.counts.priceSnapshotsInserted}`);

    // Errors
    if (result.errors.length > 0) {
      console.log('');
      console.log('⚠️  Errors:');
      result.errors.forEach((err, idx) => {
        const location = err.size
          ? `Size ${err.size} (${err.variantId?.substring(0, 8)}...)`
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

    if (result.success && result.productId) {
      console.log('🔍 Database Verification:');
      console.log('');
      console.log('Run these queries to verify:');
      console.log('');
      console.log(`  -- Product`);
      console.log(`  SELECT * FROM inventory_v4_stockx_products WHERE stockx_product_id = '${result.productId}';`);
      console.log('');
      console.log(`  -- Variants (${result.counts.variantsSynced})`);
      console.log(`  SELECT stockx_variant_id, variant_value, is_flex_eligible`);
      console.log(`  FROM inventory_v4_stockx_variants WHERE stockx_product_id = '${result.productId}';`);
      console.log('');
      console.log(`  -- Market Data (${result.counts.marketDataRefreshed})`);
      console.log(`  SELECT v.variant_value, m.lowest_ask, m.highest_bid, m.updated_at`);
      console.log(`  FROM inventory_v4_stockx_market_data m`);
      console.log(`  JOIN inventory_v4_stockx_variants v ON v.stockx_variant_id = m.stockx_variant_id`);
      console.log(`  WHERE v.stockx_product_id = '${result.productId}'`);
      console.log(`  ORDER BY v.variant_value;`);
      console.log('');
      console.log(`  -- Price History (${result.counts.priceSnapshotsInserted})`);
      console.log(`  SELECT v.variant_value, h.lowest_ask, h.highest_bid, h.recorded_at`);
      console.log(`  FROM inventory_v4_stockx_price_history h`);
      console.log(`  JOIN inventory_v4_stockx_variants v ON v.stockx_variant_id = h.stockx_variant_id`);
      console.log(`  WHERE v.stockx_product_id = '${result.productId}'`);
      console.log(`  ORDER BY v.variant_value, h.recorded_at DESC;`);
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
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('');
      console.error('Stack:');
      console.error(error.stack);
    }
    console.error('');
    console.error(`⏱️  Duration: ${duration}s`);
    console.error('');

    process.exit(1);
  }
}

main();
