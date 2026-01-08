#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SKU = 'FV5029-010';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sync() {
  console.log('🔍 STOCKX SYNC - SKU:', SKU);
  console.log('='.repeat(80));

  const { data: product } = await supabase
    .from('product_catalog')
    .select('id, sku, stockx_product_id')
    .eq('sku', SKU)
    .single();

  console.log('\n✅ Product:', product.sku);
  console.log('   StockX Product ID:', product.stockx_product_id);

  console.log('\n' + '='.repeat(80));
  console.log('🔄 RUNNING refreshStockxMarketData...\n');

  const { refreshStockxMarketData } = await import('../src/lib/services/stockx/market-refresh.ts');

  const result = await refreshStockxMarketData(
    undefined,
    product.stockx_product_id,
    'GBP'
  );

  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPLETE API RESPONSE:\n');
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('\n' + '='.repeat(80));
    console.log('💾 CHECKING master_market_data...\n');

    const { data: rows } = await supabase
      .from('master_market_data')
      .select('provider, sku, size_key, lowest_ask, highest_bid, sales_last_30d, sales_last_72h, is_flex, snapshot_at')
      .eq('provider', 'stockx')
      .eq('sku', SKU)
      .order('size_numeric', { ascending: true });

    if (rows && rows.length > 0) {
      console.log('✅ Found', rows.length, 'rows\n');
      console.log('Sample (first 10):');
      rows.slice(0, 10).forEach(row => {
        console.log(
          '   Size', (row.size_key || '?').padEnd(5),
          'Ask:', (row.lowest_ask || 'NULL').toString().padStart(7),
          'Bid:', (row.highest_bid || 'NULL').toString().padStart(7),
          '72h:', (row.sales_last_72h || 'N').toString().padStart(3),
          '30d:', (row.sales_last_30d || 'N').toString().padStart(3),
          'Flex:', row.is_flex ? 'Y' : 'N'
        );
      });
    } else {
      console.log('❌ No rows found in master_market_data');
    }
  }
}

sync().catch(err => {
  console.error('\n❌ ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
