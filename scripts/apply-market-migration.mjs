#!/usr/bin/env node
/**
 * Apply market unified migration using direct postgres connection
 */

import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL environment variable');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('📦 Applying market unified migration...\n');

    await client.connect();
    console.log('✅ Connected to database\n');

    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251111_market_unified.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    // Execute the entire migration as a single transaction
    await client.query('BEGIN');
    console.log('🔄 Starting transaction...\n');

    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('✅ Transaction committed\n');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Transaction rolled back due to error\n');
      throw err;
    }

    console.log('✅ Migration applied successfully!\n');
    console.log('📋 Created tables:');
    console.log('  - market_products');
    console.log('  - market_prices');
    console.log('  - inventory_market_links');
    console.log('  - market_orders');
    console.log('\n📊 Created materialized views:');
    console.log('  - market_price_daily_medians');
    console.log('  - portfolio_value_daily');
    console.log('\n👁️  Created views:');
    console.log('  - latest_market_prices');
    console.log('  - stockx_products_compat (compatibility)');
    console.log('  - stockx_latest_prices (compatibility)');
    console.log('\n🔄 Created refresh functions:');
    console.log('  - refresh_market_price_daily_medians()');
    console.log('  - refresh_portfolio_value_daily()');
    console.log('  - refresh_all_market_mvs()');
    console.log('\n✨ Next steps:');
    console.log('  1. npm run sync:market:catalog  # Migrate existing StockX products');
    console.log('  2. npm run sync:market:prices   # Import price data');
    console.log('  3. npm run refresh:mvs          # Refresh materialized views');

  } catch (err) {
    console.error('❌ Error applying migration:');
    console.error(err.message);
    if (err.position) {
      console.error(`Position in SQL: ${err.position}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
