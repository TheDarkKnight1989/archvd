import { syncStockxProductBySku } from '../src/lib/services/stockx-v4/sync';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sku = process.argv[2] || 'II1493-600';

async function syncSku() {
  console.log(`\n=== Syncing ${sku} to V4 tables ===\n`);

  // 1. Sync StockX
  try {
    console.log('Syncing StockX...');
    const result = await syncStockxProductBySku(sku);
    console.log('  Success:', result.success);
    console.log('  Variants:', result.counts.variantsUpserted);
    console.log('  Market Data:', result.counts.marketDataRefreshed);
    if (result.counts.rateLimited) {
      console.log('  Rate Limited:', result.counts.rateLimited);
    }
  } catch (err: any) {
    console.log('  StockX sync error:', err.message);
  }

  // 2. Check if Alias sync function exists
  try {
    console.log('\nChecking for Alias sync...');
    // Get alias_catalog_id from style catalog
    const { data: style } = await supabase
      .from('inventory_v4_style_catalog')
      .select('alias_catalog_id')
      .eq('style_id', sku)
      .single();

    if (style?.alias_catalog_id) {
      console.log('  Alias catalog ID:', style.alias_catalog_id);
      // Try to import and run Alias sync
      const { syncAliasProductByCatalogId } = await import('../src/lib/services/alias-v4/sync');
      const aliasResult = await syncAliasProductByCatalogId(style.alias_catalog_id);
      console.log('  Alias sync result:', aliasResult);
    } else {
      console.log('  No alias_catalog_id found');
    }
  } catch (err: any) {
    console.log('  Alias sync not available or failed:', err.message);
  }

  // 3. Verify data was synced
  console.log('\n=== Verifying V4 Data ===');

  const { data: catalogEntry } = await supabase
    .from('inventory_v4_style_catalog')
    .select('stockx_product_id, alias_catalog_id')
    .eq('style_id', sku)
    .single();

  if (catalogEntry?.stockx_product_id) {
    const { data: sxVariants } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('stockx_variant_id, variant_value')
      .eq('stockx_product_id', catalogEntry.stockx_product_id);

    console.log('\nStockX Variants:', sxVariants?.length || 0);

    const { data: sxMarket, count } = await supabase
      .from('inventory_v4_stockx_market_data')
      .select('*', { count: 'exact', head: true })
      .eq('stockx_product_id', catalogEntry.stockx_product_id);

    console.log('StockX Market Data rows:', count || 0);
  }

  if (catalogEntry?.alias_catalog_id) {
    const { data: alVariants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('id, size_value')
      .eq('alias_catalog_id', catalogEntry.alias_catalog_id);

    console.log('\nAlias Variants:', alVariants?.length || 0);

    const { data: alMarket, count } = await supabase
      .from('inventory_v4_alias_market_data')
      .select('*', { count: 'exact', head: true })
      .eq('alias_catalog_id', catalogEntry.alias_catalog_id);

    console.log('Alias Market Data rows:', count || 0);
  }

  console.log('\nDone!');
}

syncSku();
