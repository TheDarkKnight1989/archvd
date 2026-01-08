import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CANARY_CATALOG_ID = 'air-jordan-4-retro-og-fire-red-2020-dc7770-160';

async function getRowCount(): Promise<number> {
  const { count } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*', { count: 'exact', head: true })
    .eq('alias_catalog_id', CANARY_CATALOG_ID);
  return count || 0;
}

async function getDuplicateGroups(): Promise<number> {
  // Can't run complex SQL via JS, so sample-based check
  const { data } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('alias_catalog_id, size_value, price, purchased_at')
    .eq('alias_catalog_id', CANARY_CATALOG_ID)
    .limit(5000);

  if (!data) return -1;

  const keyMap = new Map<string, number>();
  for (const row of data) {
    const key = [row.alias_catalog_id, row.size_value, row.price, row.purchased_at].join('|');
    keyMap.set(key, (keyMap.get(key) || 0) + 1);
  }

  let dupes = 0;
  for (const count of keyMap.values()) {
    if (count > 1) dupes++;
  }
  return dupes;
}

async function main() {
  const action = process.argv[2];

  if (action === 'before') {
    const rows = await getRowCount();
    const dupes = await getDuplicateGroups();
    console.log('=== BEFORE SYNC ===');
    console.log('Canary product:', CANARY_CATALOG_ID);
    console.log('Row count:', rows);
    console.log('Duplicate groups (sampled):', dupes);
    console.log('Timestamp:', new Date().toISOString());
  } else if (action === 'after') {
    const rows = await getRowCount();
    const dupes = await getDuplicateGroups();
    console.log('=== AFTER SYNC ===');
    console.log('Canary product:', CANARY_CATALOG_ID);
    console.log('Row count:', rows);
    console.log('Duplicate groups (sampled):', dupes);
    console.log('Timestamp:', new Date().toISOString());
  } else {
    console.log('Usage: npx tsx canary-test.ts [before|after]');
  }
}

main().catch(console.error);
