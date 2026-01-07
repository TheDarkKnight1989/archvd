import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all data including updated_at
const { data, error } = await supabase
  .from('inventory_v4_stockx_market_data')
  .select('currency_code, lowest_ask, highest_bid, stockx_variant_id, updated_at')
  .order('updated_at', { ascending: false });

if (error) {
  console.log('Error:', error.message);
  process.exit(1);
}

// Group by currency
const byCode = {};
data.forEach(row => {
  if (!byCode[row.currency_code]) byCode[row.currency_code] = [];
  byCode[row.currency_code].push(row);
});

console.log('📊 StockX Market Data by Currency:');
Object.entries(byCode).sort().forEach(([code, rows]) => {
  console.log(`   ${code}: ${rows.length} rows`);
});
console.log(`   Total: ${data.length} rows`);

// Show most recent 5 entries with actual prices
const withPrices = data.filter(r => r.lowest_ask !== null);
console.log(`\n📅 Most recent 5 entries WITH prices (${withPrices.length} total non-null):`);
withPrices.slice(0, 5).forEach(row => {
  const symbol = { GBP: '£', EUR: '€', USD: '$' }[row.currency_code] || row.currency_code;
  console.log(`   ${row.currency_code} - ${symbol}${row.lowest_ask} ask - ${row.updated_at}`);
});

// Find a variant with all 3 currencies AND actual prices
const variantData = {};
data.forEach(row => {
  if (!variantData[row.stockx_variant_id]) variantData[row.stockx_variant_id] = {};
  variantData[row.stockx_variant_id][row.currency_code] = row;
});

// Find variant with all 3 currencies and at least one non-null price
const multiCurrencyVariant = Object.keys(variantData).find(v => {
  const currencies = variantData[v];
  return currencies.GBP && currencies.EUR && currencies.USD &&
    (currencies.GBP.lowest_ask || currencies.EUR.lowest_ask || currencies.USD.lowest_ask);
});

if (multiCurrencyVariant) {
  console.log('\n📈 Sample variant with multi-currency data:');
  const currencies = variantData[multiCurrencyVariant];
  ['EUR', 'GBP', 'USD'].forEach(code => {
    const r = currencies[code];
    if (r) {
      const symbol = { GBP: '£', EUR: '€', USD: '$' }[code];
      console.log(`   ${code}: lowest_ask=${symbol}${r.lowest_ask ?? 'n/a'}, highest_bid=${symbol}${r.highest_bid ?? 'n/a'}`);
    }
  });
} else {
  console.log('\n⚠️  No variant found with all 3 currencies');
}
