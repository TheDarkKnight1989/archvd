#!/usr/bin/env node
/**
 * Apply master market data migrations
 * Applies the three migrations needed for master_market_data table
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function main() {
  console.log('🔧 Applying Master Market Data Migrations');
  console.log('==========================================\n');

  // Validate environment
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // List of migrations to apply in order
  const migrations = [
    '20251203_create_raw_snapshot_tables.sql',
    '20251203_create_master_market_data.sql',
    '20251203_add_flex_consigned_support.sql',
  ];

  for (const migration of migrations) {
    const migrationPath = join(projectRoot, 'supabase', 'migrations', migration);

    console.log(`\n📄 Applying: ${migration}`);
    console.log('   ' + '─'.repeat(60));

    try {
      // Read migration file
      const sql = readFileSync(migrationPath, 'utf-8');

      // Execute migration using rpc
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        // If exec_sql doesn't exist, try direct execution
        console.log('   ⚠️  exec_sql RPC not available, trying direct execution...');

        // Split by statements and execute one by one
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          const { error: stmtError } = await supabase.rpc('exec', {
            sql: statement + ';',
          });

          if (stmtError) {
            console.error('   ❌ Failed to execute statement');
            console.error('   Error:', stmtError.message);
            throw stmtError;
          }
        }
      }

      console.log('   ✅ Migration applied successfully');
    } catch (error) {
      console.error('   ❌ Failed to apply migration');
      console.error('   Error:', error.message);
      console.error('\n💡 Note: You may need to apply this migration manually via Supabase dashboard');
      console.error(`   Migration file: ${migrationPath}`);
      // Continue to next migration instead of exiting
    }
  }

  console.log('\n\n✅ Migration process complete');
  console.log('\n📊 Verifying tables exist...');

  // Verify tables exist
  try {
    const { data: snapshotsData, error: snapshotsError } = await supabase
      .from('stockx_raw_snapshots')
      .select('id')
      .limit(1);

    if (snapshotsError) {
      console.log('   ⚠️  stockx_raw_snapshots: ' + snapshotsError.message);
    } else {
      console.log('   ✅ stockx_raw_snapshots: OK');
    }

    const { data: masterData, error: masterError } = await supabase
      .from('master_market_data')
      .select('id')
      .limit(1);

    if (masterError) {
      console.log('   ⚠️  master_market_data: ' + masterError.message);
    } else {
      console.log('   ✅ master_market_data: OK');
    }
  } catch (error) {
    console.log('   ⚠️  Could not verify tables:', error.message);
  }

  console.log('\n✨ Done!');
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
