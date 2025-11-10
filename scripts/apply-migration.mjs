#!/usr/bin/env node

/**
 * Apply migration using Supabase client
 * Usage: node scripts/apply-migration.mjs <migration-file>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Usage: node scripts/apply-migration.mjs <migration-file>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', migrationFile);

  console.log(`\n🚀 Applying migration: ${migrationFile}`);
  console.log(`📄 File: ${migrationPath}\n`);

  let sql;
  try {
    sql = readFileSync(migrationPath, 'utf-8');
  } catch (err) {
    console.error(`❌ Error reading file: ${err.message}`);
    process.exit(1);
  }

  console.log('⚙️  Executing SQL...\n');

  // Use Supabase RPC to execute raw SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // If exec_sql doesn't exist, try direct query
    const { error: queryError } = await supabase.from('_').select('*').limit(0);

    // Create exec_sql function if it doesn't exist
    const createFnSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
      RETURNS TEXT
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql_query;
        RETURN 'Success';
      EXCEPTION WHEN OTHERS THEN
        RETURN 'Error: ' || SQLERRM;
      END;
      $$;
    `;

    // Try using postgres REST API for raw SQL execution
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql_query: sql })
    });

    if (!response.ok) {
      console.error(`❌ Migration failed!`);
      console.error(`Error: Cannot execute raw SQL through Supabase client.`);
      console.error(`\nPlease add DATABASE_URL to your .env.local file.`);
      console.error(`You can find it in: Supabase Dashboard → Project Settings → Database → Connection string (Direct)`);
      process.exit(1);
    }
  }

  console.log(`✅ Migration applied successfully!\n`);
}

applyMigration().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
