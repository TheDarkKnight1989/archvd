import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Get all styles
  const { data, error } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_product_id, alias_catalog_id, stockx_url_key');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const total = data.length;
  const withStockx = data.filter(s => s.stockx_product_id).length;
  const withAlias = data.filter(s => s.alias_catalog_id).length;
  const withStockxUrlKey = data.filter(s => s.stockx_url_key).length;
  const missingBoth = data.filter(s => !s.stockx_product_id && !s.alias_catalog_id).length;
  const hasBoth = data.filter(s => s.stockx_product_id && s.alias_catalog_id).length;

  console.log('=== STYLE CATALOG COUNTS ===');
  console.log('Total styles:', total);
  console.log('With stockx_product_id:', withStockx);
  console.log('With stockx_url_key:', withStockxUrlKey);
  console.log('With alias_catalog_id:', withAlias);
  console.log('Has BOTH mappings:', hasBoth);
  console.log('Missing BOTH mappings:', missingBoth);
  console.log('');

  // List styles missing both
  if (missingBoth > 0) {
    console.log('Styles missing BOTH mappings (will be SKIPPED):');
    data.filter(s => !s.stockx_product_id && !s.alias_catalog_id).forEach(s => {
      console.log('  -', s.style_id);
    });
  }

  // List all styles for reference
  console.log('');
  console.log('=== ALL TRACKED STYLES ===');
  data.forEach(s => {
    const sx = s.stockx_product_id ? 'SX:✓' : 'SX:✗';
    const al = s.alias_catalog_id ? 'AL:✓' : 'AL:✗';
    console.log(`  ${s.style_id} | ${sx} | ${al}`);
  });
}

main();
