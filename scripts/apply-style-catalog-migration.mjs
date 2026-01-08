#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = readFileSync('supabase/migrations/20251210_create_inventory_v4_style_catalog.sql', 'utf-8');

console.log('Applying style catalog migration...\n');

const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

if (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}

console.log('✅ Migration applied successfully');
