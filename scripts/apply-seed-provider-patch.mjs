#!/usr/bin/env node

/**
 * Apply seed provider patch
 * Adds 'seed' to provider constraints and meta column to market_products
 */

import pg from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL environment variable')
  process.exit(1)
}

const { Client } = pg

async function applyPatch() {
  console.log('🔧 Applying seed provider patch...\n')

  const client = new Client({ connectionString })

  try {
    await client.connect()

    // 1. Add meta column to market_products
    console.log('1. Adding meta column to market_products...')
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'market_products' AND column_name = 'meta'
        ) THEN
          ALTER TABLE market_products ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;
        END IF;
      END $$;
    `)
    console.log('   ✅ Done\n')

    // 2. Update market_products constraint
    console.log('2. Updating market_products provider constraint...')
    await client.query(`
      ALTER TABLE market_products DROP CONSTRAINT IF EXISTS market_products_provider_check;
    `)
    await client.query(`
      ALTER TABLE market_products ADD CONSTRAINT market_products_provider_check
        CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));
    `)
    console.log('   ✅ Done\n')

    // 3. Update market_prices constraint
    console.log('3. Updating market_prices provider constraint...')
    await client.query(`
      ALTER TABLE market_prices DROP CONSTRAINT IF EXISTS market_prices_provider_check;
    `)
    await client.query(`
      ALTER TABLE market_prices ADD CONSTRAINT market_prices_provider_check
        CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));
    `)
    console.log('   ✅ Done\n')

    // 4. Update inventory_market_links constraint
    console.log('4. Updating inventory_market_links provider constraint...')
    await client.query(`
      ALTER TABLE inventory_market_links DROP CONSTRAINT IF EXISTS inventory_market_links_provider_check;
    `)
    await client.query(`
      ALTER TABLE inventory_market_links ADD CONSTRAINT inventory_market_links_provider_check
        CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));
    `)
    console.log('   ✅ Done\n')

    // 5. Update market_orders constraint
    console.log('5. Updating market_orders provider constraint...')
    await client.query(`
      ALTER TABLE market_orders DROP CONSTRAINT IF EXISTS market_orders_provider_check;
    `)
    await client.query(`
      ALTER TABLE market_orders ADD CONSTRAINT market_orders_provider_check
        CHECK (provider IN ('stockx', 'alias', 'ebay', 'seed'));
    `)
    console.log('   ✅ Done\n')

    console.log('✨ Patch applied successfully!')

  } catch (err) {
    console.error('❌ Failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

applyPatch()
