import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findCanarySku() {
  console.log('=== FINDING CANARY SKU ===\n');

  // Find a style_catalog entry that has alias_catalog_id
  const { data: styles } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, alias_catalog_id')
    .not('alias_catalog_id', 'is', null)
    .limit(10);

  if (!styles || styles.length === 0) {
    console.log('No styles with alias_catalog_id found');
    return;
  }

  console.log('Available SKUs with Alias mapping:');
  for (const s of styles) {
    // Check if this alias_catalog_id has sales data
    const { count } = await supabase
      .from('inventory_v4_alias_sales_history')
      .select('*', { count: 'exact', head: true })
      .eq('alias_catalog_id', s.alias_catalog_id);

    console.log(`  ${s.style_id} -> ${s.alias_catalog_id} (${count || 0} sales)`);
  }

  // Also check alias_products directly
  console.log('\nAlias products with sales data:');
  const { data: products } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id')
    .limit(5);

  if (products) {
    for (const p of products) {
      const { count } = await supabase
        .from('inventory_v4_alias_sales_history')
        .select('*', { count: 'exact', head: true })
        .eq('alias_catalog_id', p.alias_catalog_id);

      console.log(`  ${p.alias_catalog_id.slice(0, 50)}... (${count || 0} sales)`);
    }
  }
}

findCanarySku().catch(console.error);
