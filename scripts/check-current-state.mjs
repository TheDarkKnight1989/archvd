#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('🔍 CHECKING V4 INVENTORY STATE\n');
  console.log('='.repeat(80));

  // 1. Check inventory_v4_items
  console.log('\n=== inventory_v4_items ===\n');
  const { data: v4Items, error: v4Error, count: v4Count } = await supabase
    .from('inventory_v4_items')
    .select('id, style_id, size, status, purchase_price', { count: 'exact' })
    .limit(10);

  console.log('Error:', v4Error);
  console.log('Count:', v4Count);
  console.log('Items:', JSON.stringify(v4Items, null, 2));

  // 2. Check style catalog for these items
  if (v4Items && v4Items.length > 0) {
    const styleIds = v4Items.map(i => i.style_id);
    console.log('\n=== Style Catalog for V4 Items ===\n');
    const { data: catalog, error: catError } = await supabase
      .from('inventory_v4_style_catalog')
      .select('style_id, name, brand, stockx_product_id, alias_catalog_id')
      .in('style_id', styleIds);

    console.log('Error:', catError);
    console.log('Found:', catalog?.length, 'of', styleIds.length, 'SKUs');

    if (catalog) {
      const foundIds = new Set(catalog.map(c => c.style_id));
      const missing = styleIds.filter(id => !foundIds.has(id));
      console.log('Missing from catalog:', missing);
      console.log('Catalog entries:', JSON.stringify(catalog, null, 2));
    }
  }

  // 3. Test the join query
  console.log('\n=== Testing Join Query (like useInventoryV4) ===\n');
  const { data: joinedData, error: joinError } = await supabase
    .from('inventory_v4_items')
    .select(`
      *,
      style:inventory_v4_style_catalog (*)
    `)
    .in('status', ['in_stock', 'listed', 'consigned', 'sold', 'active'])
    .limit(5);

  console.log('Join error:', joinError);
  console.log('Joined items count:', joinedData?.length);
  if (joinedData) {
    joinedData.forEach(item => {
      console.log('  -', item.style_id, '| style:', item.style ? 'FOUND' : 'NULL');
    });
  }

  console.log('\n' + '='.repeat(80));
}

check().catch(console.error);
