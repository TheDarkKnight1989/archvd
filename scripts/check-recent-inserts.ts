import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('=== CHECK RECENT INSERTS FOR DUPLICATES ===\n');

  // Get the last 20 rows with full natural key
  const { data: recent } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('id, alias_catalog_id, size_value, price, purchased_at, recorded_at')
    .order('id', { ascending: false })
    .limit(20);

  if (!recent) {
    console.log('No data');
    return;
  }

  console.log('Last 20 rows:');
  for (const row of recent) {
    console.log(`id=${row.id} | ${row.alias_catalog_id.slice(0,25)}... | size=${row.size_value} | $${row.price} | purchased=${row.purchased_at}`);
  }

  // Check for duplicate natural keys
  const keyMap = new Map<string, number[]>();
  for (const row of recent) {
    const key = [row.alias_catalog_id, row.size_value, row.price, row.purchased_at].join('|');
    if (!keyMap.has(key)) keyMap.set(key, []);
    keyMap.get(key)!.push(row.id);
  }

  console.log('\nDuplicate check:');
  let hasDupes = false;
  for (const [key, ids] of keyMap.entries()) {
    if (ids.length > 1) {
      console.log(`  DUPLICATE: ${key} -> ids: ${ids.join(', ')}`);
      hasDupes = true;
    }
  }

  if (!hasDupes) {
    console.log('  No duplicates found in last 20 rows');
    console.log('  (Same catalog/size but different price/purchased_at = legitimate different sales)');
  }
}

check().catch(console.error);
