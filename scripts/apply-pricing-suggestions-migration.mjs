#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('🔧 Applying pricing suggestions migration...\n');
  
  const sql = readFileSync('/Users/ritesh/Projects/archvd/supabase/migrations/202512053_add_stockx_pricing_suggestions.sql', 'utf-8');
  
  // Split into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .map(s => s + ';');

  console.log(`Executing ${statements.length} SQL statements...\n`);

  for (const statement of statements) {
    // Execute via raw SQL
    const { error } = await supabase.rpc('exec', { sql: statement });

    if (error) {
      console.error('❌ Error:', error.message);
      console.error('Statement:', statement.substring(0, 100) + '...');
    }
  }

  console.log('\n✅ Migration applied!');
}

applyMigration().catch(console.error);
