#!/usr/bin/env node
import { createClient } from '@/lib/supabase/service';
import { writeFileSync } from 'fs';

async function extract() {
  const supabase = createClient();

  const { data: products } = await supabase
    .from('inventory_v4_stockx_products')
    .select('url_key, style_id')
    .order('created_at', { ascending: true });

  if (!products || products.length === 0) {
    console.error('No StockX products found');
    process.exit(1);
  }

  const catalogIds = products
    .map(p => p.url_key)
    .filter(Boolean);

  console.log(`Found ${catalogIds.length} StockX variant IDs`);
  console.log('\nFirst 5:');
  catalogIds.slice(0, 5).forEach((id, i) => console.log(`  ${i+1}. ${id}`));

  writeFileSync('alias-catalog-ids-from-stockx-v4.txt', catalogIds.join('\n'));
  console.log('\n✅ Saved to alias-catalog-ids-from-stockx-v4.txt');
}

extract().catch(console.error);
