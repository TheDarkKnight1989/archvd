#!/usr/bin/env node

/**
 * Apply migration using Node.js postgres driver
 * Usage: npx dotenv -e .env.local -- node scripts/apply-migration-node.mjs <migration-file>
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not set');
  console.error('Please set it in your .env.local');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Usage: node scripts/apply-migration-node.mjs <migration-file>');
  process.exit(1);
}

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

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log(`✅ Migration applied successfully!\n`);
  } catch (err) {
    console.error(`❌ Migration failed!`);
    console.error(`Error: ${err.message}\n`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
