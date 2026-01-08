import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function execute() {
  console.log('=== EXECUTING TRUNCATE ===\n');

  // Try to truncate via RPC or raw SQL
  const { error } = await supabase.rpc('exec_sql' as any, {
    sql: 'TRUNCATE TABLE inventory_v4_alias_sales_history;'
  });

  if (error) {
    console.log('Cannot execute TRUNCATE via Supabase JS client');
    console.log('Error: ' + error.message);
    console.log('\n=== RUN THIS IN SUPABASE SQL EDITOR ===\n');
    console.log(`-- Step 1: TRUNCATE
TRUNCATE TABLE inventory_v4_alias_sales_history;

-- Step 2: Verify empty
SELECT COUNT(*) AS after_truncate FROM inventory_v4_alias_sales_history;

-- Step 3: Add UNIQUE constraint
ALTER TABLE inventory_v4_alias_sales_history
ADD CONSTRAINT unique_alias_sale_event
UNIQUE (alias_catalog_id, size_value, price, purchased_at);

-- Step 4: Verify constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'inventory_v4_alias_sales_history'::regclass
  AND contype = 'u';`);
  } else {
    console.log('TRUNCATE executed successfully');
  }
}

execute().catch(console.error);
