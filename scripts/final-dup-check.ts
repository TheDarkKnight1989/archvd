import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function finalCheck() {
  console.log('=== FINAL DUPLICATE CHECK ===\n');

  // Total row count
  const { count: totalRows } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*', { count: 'exact', head: true });
  console.log('Total rows:', totalRows);

  // Sample for duplicates
  const { data: sample } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('alias_catalog_id, size_value, price, purchased_at')
    .limit(10000);

  if (sample) {
    const keyMap = new Map<string, number>();
    for (const row of sample) {
      const key = [row.alias_catalog_id, row.size_value, row.price, row.purchased_at].join('|');
      keyMap.set(key, (keyMap.get(key) || 0) + 1);
    }

    let dupeGroups = 0;
    for (const count of keyMap.values()) {
      if (count > 1) dupeGroups++;
    }

    console.log('Sample size:', sample.length);
    console.log('Unique keys in sample:', keyMap.size);
    console.log('Duplicate groups in sample:', dupeGroups);
  }

  console.log('\nRun full check in SQL Editor:');
  console.log(`SELECT COUNT(*) AS duplicate_groups FROM (
  SELECT alias_catalog_id, size_value, price, purchased_at
  FROM inventory_v4_alias_sales_history
  GROUP BY 1,2,3,4
  HAVING COUNT(*) > 1
) g;`);
}

finalCheck().catch(console.error);
