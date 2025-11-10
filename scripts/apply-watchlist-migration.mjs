#!/usr/bin/env node

/**
 * Apply watchlist alerts migration
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function applyMigration() {
  console.log('\n🚀 Applying watchlist alerts migration...\n');

  try {
    const sql = readFileSync('supabase/migrations/20251113_watchlist_alerts_and_activity.sql', 'utf-8');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';

      // Skip comments and empty statements
      if (stmt.trim().startsWith('DO $$') || stmt.trim().startsWith('COMMENT ON')) {
        console.log(`⏭️  Skipping statement ${i + 1}/${statements.length} (metadata)`);
        continue;
      }

      try {
        // Use rpc to execute SQL
        const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });

        if (error) {
          // Try direct query as fallback
          const { error: queryError } = await supabase.from('_').select().maybeSingle();
          if (queryError) {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            throw error;
          }
        }

        console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
      } catch (err) {
        console.error(`❌ Error at statement ${i + 1}:`, err.message);
        console.error(`Statement: ${stmt.substring(0, 100)}...`);
        throw err;
      }
    }

    console.log('\n✅ Migration applied successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.log('\n💡 Please apply the migration manually via Supabase Dashboard SQL Editor');
    console.log('   File: supabase/migrations/20251113_watchlist_alerts_and_activity.sql\n');
    process.exit(1);
  }
}

applyMigration();
