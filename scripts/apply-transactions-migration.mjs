#!/usr/bin/env node

/**
 * Apply transactions migration directly via Supabase SQL Editor API
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251119_transactions.sql');
const sql = readFileSync(migrationPath, 'utf-8');

console.log('🚀 Applying transactions migration...\n');

// Split SQL into individual statements and execute them
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

let successCount = 0;
let errorCount = 0;

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i] + ';';

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: statement }),
    });

    if (response.ok) {
      successCount++;
      console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
    } else {
      errorCount++;
      const error = await response.text();
      console.log(`✗ Statement ${i + 1}/${statements.length} failed: ${error}`);
    }
  } catch (err) {
    errorCount++;
    console.log(`✗ Statement ${i + 1}/${statements.length} error: ${err.message}`);
  }
}

console.log(`\n📊 Summary: ${successCount} succeeded, ${errorCount} failed`);

if (errorCount > 0) {
  console.log('\n⚠️  Some statements failed. You may need to apply the migration via Supabase Dashboard → SQL Editor');
  console.log('   Copy the contents of: supabase/migrations/20251119_transactions.sql');
}

process.exit(errorCount > 0 ? 1 : 0);
