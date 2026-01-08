#!/usr/bin/env node
import { createClient } from '@/lib/supabase/service';
import { readFileSync } from 'fs';

async function applyMigration() {
  const supabase = createClient();

  console.log('📦 Applying style catalog migration...\n');

  const sql = readFileSync(
    'supabase/migrations/20251210_create_inventory_v4_style_catalog.sql',
    'utf-8'
  );

  // Split by statement and execute each
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';

    if (statement.trim().length < 5) continue;

    console.log(`Executing statement ${i + 1}/${statements.length}...`);

    const { error } = await supabase.rpc('exec_sql', { sql_string: statement });

    if (error && !error.message.includes('already exists')) {
      console.error(`❌ Error:`, error.message);
      console.error(`Statement:`, statement.substring(0, 100));
    }
  }

  console.log('\n✅ Migration applied successfully');

  // Verify table exists
  const { count, error: verifyError } = await supabase
    .from('inventory_v4_style_catalog')
    .select('*', { count: 'exact', head: true });

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
  } else {
    console.log(`✅ Table verified: ${count} rows`);
  }
}

applyMigration().catch(console.error);
