#!/usr/bin/env node

import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

// Read the migration SQL
const sql = readFileSync('supabase/migrations/20251130_add_inventory_fk_to_market_links.sql', 'utf-8');

console.log('🚀 Applying inventory FK migration...\n');

// Build connection string from Supabase URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not set');
  process.exit(1);
}

// Extract project ref from URL (e.g., cjoucwhhwhpippksytoi from https://cjoucwhhwhpippksytoi.supabase.co)
const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!match) {
  console.error('❌ Invalid Supabase URL format');
  process.exit(1);
}

const projectRef = match[1];
const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD || ''}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('✅ Connected to database');

  await client.query(sql);
  console.log('✅ Migration applied successfully!\n');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  console.error('\nIf you see a password authentication error, you need to set SUPABASE_DB_PASSWORD in .env.local');
  console.error('You can find it in Supabase Dashboard → Project Settings → Database → Database password\n');
  process.exit(1);
} finally {
  await client.end();
}
