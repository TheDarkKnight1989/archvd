import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function proveSchema() {
  console.log('=== 2A) COLUMN LIST + TYPES ===\n');

  // Fallback: describe table by selecting one row
  const { data, error } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('Columns from sample row:');
    const row = data[0] as Record<string, unknown>;
    for (const [key, value] of Object.entries(row)) {
      const jsType = value === null ? 'null' : typeof value;
      const sample = String(value).slice(0, 60);
      console.log('  ' + key + ': ' + jsType + ' (sample: ' + sample + ')');
    }
  } else {
    console.log('No rows found - table may be empty');
  }

  console.log('\n=== 2B) EXISTING INDEXES ===');
  console.log('BLOCKED: Cannot query pg_indexes via Supabase JS client');
  console.log('Fallback: Check Supabase Dashboard -> Table Editor -> Indexes\n');

  console.log('=== 2C) EXISTING CONSTRAINTS ===');
  console.log('BLOCKED: Cannot query pg_constraint via Supabase JS client');
  console.log('Fallback: Check Supabase Dashboard -> Table Editor -> Constraints\n');
}

proveSchema().catch(console.error);
