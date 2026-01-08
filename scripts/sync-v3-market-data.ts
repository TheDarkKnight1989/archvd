/**
 * Sync V3 Market Data (for Market Inspector)
 *
 * This syncs to the V3 tables:
 * - stockx_market_snapshots → stockx_market_latest view
 * - alias_market_snapshots
 *
 * Usage: npx tsx scripts/sync-v3-market-data.ts II1493-600
 */

import { createClient } from '@supabase/supabase-js';
import { syncProductAllRegions } from '../src/lib/services/stockx/market-refresh';
import { syncAliasProductMultiRegion } from '../src/lib/services/alias/sync';
import { AliasClient } from '../src/lib/services/alias/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sku = process.argv[2] || 'II1493-600';

async function syncV3MarketData() {
  console.log(`\n=== Syncing V3 Market Data for ${sku} ===\n`);

  // 1. Get stockx_product_id from stockx_products (V3 table)
  const { data: stockxProduct, error: sxErr } = await supabase
    .from('stockx_products')
    .select('stockx_product_id, style_id')
    .eq('style_id', sku)
    .single();

  if (sxErr || !stockxProduct) {
    console.log('StockX product not found in V3 tables for SKU:', sku);
    console.log('Checking product_catalog...');

    // Try product_catalog
    const { data: catalog } = await supabase
      .from('product_catalog')
      .select('stockx_product_id, alias_catalog_id')
      .eq('sku', sku)
      .single();

    if (catalog?.stockx_product_id) {
      console.log('Found in product_catalog:', catalog.stockx_product_id);
    } else {
      console.log('Not found in product_catalog either');
    }
  } else {
    console.log('Found StockX product:', stockxProduct.stockx_product_id);

    // 2. Sync StockX V3
    console.log('\n--- Syncing StockX (V3) ---');
    try {
      const result = await syncProductAllRegions(undefined, stockxProduct.stockx_product_id, 'UK', true);
      console.log('StockX sync result:', {
        success: result.success,
        primaryRegion: result.primaryRegion,
        totalSnapshots: result.totalSnapshotsCreated,
      });
    } catch (err: any) {
      console.log('StockX sync error:', err.message);
    }
  }

  // 3. Get alias_catalog_id
  const { data: aliasLink } = await supabase
    .from('inventory_alias_links')
    .select('alias_catalog_id')
    .eq('sku', sku)
    .single();

  // Also check product_catalog
  const { data: catalogAlias } = await supabase
    .from('product_catalog')
    .select('alias_catalog_id')
    .eq('sku', sku)
    .single();

  const aliasCatalogId = aliasLink?.alias_catalog_id || catalogAlias?.alias_catalog_id;

  if (aliasCatalogId) {
    console.log('\n--- Syncing Alias (V3) ---');
    console.log('Alias catalog ID:', aliasCatalogId);

    try {
      const aliasClient = new AliasClient();
      const result = await syncAliasProductMultiRegion(aliasClient, aliasCatalogId, {
        sku,
        userRegion: 'UK',
        syncSecondaryRegions: true,
      });
      console.log('Alias sync result:', {
        success: result.success,
        primaryRegion: result.primaryRegion,
        totalVariants: result.totalVariantsIngested,
      });
    } catch (err: any) {
      console.log('Alias sync error:', err.message);
    }
  } else {
    console.log('\nNo Alias catalog ID found for SKU:', sku);
  }

  // 4. Verify the sync worked
  console.log('\n=== Verifying V3 Data ===');

  if (stockxProduct?.stockx_product_id) {
    const { data: sxLatest } = await supabase
      .from('stockx_market_latest')
      .select('snapshot_at')
      .eq('stockx_product_id', stockxProduct.stockx_product_id)
      .order('snapshot_at', { ascending: false })
      .limit(1);

    console.log('StockX latest snapshot:', sxLatest?.[0]?.snapshot_at || 'None');
  }

  if (aliasCatalogId) {
    const { data: aliasLatest } = await supabase
      .from('alias_market_snapshots')
      .select('snapshot_at')
      .eq('catalog_id', aliasCatalogId)
      .order('snapshot_at', { ascending: false })
      .limit(1);

    console.log('Alias latest snapshot:', aliasLatest?.[0]?.snapshot_at || 'None');
  }

  console.log('\nDone!');
}

syncV3MarketData();
