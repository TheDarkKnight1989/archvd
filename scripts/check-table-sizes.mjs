import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSizes() {
  // Get row counts for key tables
  const tables = [
    'stockx_market_snapshots',
    'inventory_v4_alias_variants',
    'inventory_v4_alias_market_data',
    'inventory_v4_alias_price_history',
    'inventory_v4_alias_sales_history',
    'inventory_v4_stockx_variants',
    'inventory_v4_stockx_market_data',
    'inventory_v4_stockx_price_history',
    'inventory_items',
    'product_catalog',
    'inventory_v4_alias_products',
    'inventory_v4_stockx_products'
  ];

  console.log('=== ROW COUNTS ===');
  let totalRows = 0;
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (!error) {
      console.log(`${table}: ${count?.toLocaleString() || 0} rows`);
      totalRows += count || 0;
    } else {
      console.log(`${table}: ERROR - ${error.message}`);
    }
  }
  console.log(`\nTotal rows across key tables: ${totalRows.toLocaleString()}`);

  // Check invalid Alias variants (sizes outside allowed_sizes)
  console.log('\n=== ALIAS INVALID VARIANTS (can delete) ===');

  // Get all alias products with their allowed_sizes
  const { data: products } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, allowed_sizes');

  if (products) {
    let invalidCount = 0;
    let validCount = 0;

    for (const product of products) {
      const allowedValues = new Set(
        (product.allowed_sizes || []).map(s => s.value)
      );

      const { data: variants } = await supabase
        .from('inventory_v4_alias_variants')
        .select('size_value')
        .eq('alias_catalog_id', product.alias_catalog_id);

      if (variants) {
        for (const v of variants) {
          if (allowedValues.has(v.size_value)) {
            validCount++;
          } else {
            invalidCount++;
          }
        }
      }
    }

    console.log(`Valid variants: ${validCount.toLocaleString()}`);
    console.log(`Invalid variants (deletable): ${invalidCount.toLocaleString()}`);
    console.log(`Invalid %: ${((invalidCount / (validCount + invalidCount)) * 100).toFixed(1)}%`);
  }

  // Estimate storage
  console.log('\n=== STORAGE ESTIMATES ===');
  console.log('Rough estimate (avg 200 bytes/row for variant tables):');

  const { count: v3Snapshots } = await supabase.from('stockx_market_snapshots').select('*', { count: 'exact', head: true });
  console.log(`\nV3 stockx_market_snapshots: ${v3Snapshots?.toLocaleString()} rows`);
  console.log(`  Estimated size: ~${((v3Snapshots || 0) * 300 / 1024 / 1024).toFixed(1)} MB`);

  const { count: aliasVariants } = await supabase.from('inventory_v4_alias_variants').select('*', { count: 'exact', head: true });
  const { count: aliasMarket } = await supabase.from('inventory_v4_alias_market_data').select('*', { count: 'exact', head: true });
  const { count: aliasHistory } = await supabase.from('inventory_v4_alias_price_history').select('*', { count: 'exact', head: true });

  const invalidPct = 0.34; // ~34% invalid based on earlier analysis
  const deletableAliasRows = Math.round(((aliasVariants || 0) + (aliasMarket || 0) + (aliasHistory || 0)) * invalidPct);

  console.log(`\nAlias V4 deletable (~34% invalid):`);
  console.log(`  variants: ~${Math.round((aliasVariants || 0) * invalidPct).toLocaleString()} rows`);
  console.log(`  market_data: ~${Math.round((aliasMarket || 0) * invalidPct).toLocaleString()} rows`);
  console.log(`  price_history: ~${Math.round((aliasHistory || 0) * invalidPct).toLocaleString()} rows`);
  console.log(`  Total deletable: ~${deletableAliasRows.toLocaleString()} rows`);
  console.log(`  Estimated size: ~${(deletableAliasRows * 200 / 1024 / 1024).toFixed(1)} MB`);

  console.log('\n=== TOTAL POTENTIAL SAVINGS ===');
  const v3Bytes = (v3Snapshots || 0) * 300;
  const aliasBytes = deletableAliasRows * 200;
  const totalBytes = v3Bytes + aliasBytes;
  console.log(`V3 tables: ~${(v3Bytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Invalid Alias: ~${(aliasBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`TOTAL: ~${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`\nTarget: 300 MB - ${totalBytes / 1024 / 1024 >= 300 ? '✅ ACHIEVABLE' : '❌ NOT ENOUGH'}`);
}

checkSizes().catch(console.error);
