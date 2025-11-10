#!/usr/bin/env node

/**
 * Check current database schema
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('=== Database Schema Check ===\n');

  // Check Inventory table
  console.log('1. Checking Inventory table columns...\n');
  const { data: invData, error: invError } = await supabase
    .from('Inventory')
    .select('*')
    .limit(1);

  if (invError) {
    console.error('Error:', invError.message);
  } else if (invData && invData.length > 0) {
    const columns = Object.keys(invData[0]);
    console.log('Inventory columns:');
    columns.forEach(col => console.log(`  - ${col}`));
  } else {
    console.log('No data in Inventory table');
  }

  // Check for market prices tables
  console.log('\n2. Checking market price tables...\n');

  const priceTables = ['latest_market_prices', 'market_prices', 'MarketPrices', 'marketprices'];

  for (const tableName of priceTables) {
    const { data: priceData, error: priceError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (!priceError && priceData !== null) {
      console.log(`✅ Found table: ${tableName}`);
      if (priceData.length > 0) {
        const columns = Object.keys(priceData[0]);
        console.log(`   Columns:`);
        columns.forEach(col => console.log(`   - ${col}`));
      } else {
        console.log(`   (No data in table)`);
      }
      break;
    }
  }

  console.log('\n3. Checking for existing views...\n');

  // Try to query a view
  const { data: viewData, error: viewError } = await supabase
    .from('portfolio_latest_prices_v2')
    .select('*')
    .limit(1);

  if (!viewError) {
    console.log('✅ portfolio_latest_prices_v2 view exists');
  } else {
    console.log('❌ portfolio_latest_prices_v2 view does not exist');
  }
}

checkSchema().catch(console.error);
