import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function preflight() {
  console.log('=== PRE-FLIGHT CHECK ===\n');

  // 1. Row count
  const { count: beforeRows } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*', { count: 'exact', head: true });
  console.log('before_rows: ' + beforeRows);

  // 2. Products count
  const { count: products } = await supabase
    .from('inventory_v4_alias_products')
    .select('*', { count: 'exact', head: true });
  console.log('products: ' + products);

  // 3. Check unique constraints (cannot query pg_constraint directly, report limitation)
  console.log('\nUnique constraints: CANNOT QUERY pg_constraint via Supabase JS client');
  console.log('Run this in SQL Editor:');
  console.log(`  SELECT conname FROM pg_constraint WHERE conrelid = 'inventory_v4_alias_sales_history'::regclass AND contype = 'u';`);
}

preflight().catch(console.error);
