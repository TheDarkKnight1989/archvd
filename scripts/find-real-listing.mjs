#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Find all rows with non-null stockx_listing_id
const { data, error } = await supabase
  .from('inventory_market_links')
  .select(`
    id,
    item_id,
    user_id,
    stockx_product_id,
    stockx_variant_id,
    stockx_listing_id,
    stockx_listing_status,
    stockx_last_listing_sync_at,
    stockx_listing_payload,
    created_at,
    updated_at
  `)
  .not('stockx_listing_id', 'is', null)
  .order('updated_at', { ascending: false })
  .limit(5);

if (error) {
  console.error('Query error:', error);
  process.exit(1);
}

console.log('\n' + '='.repeat(80));
console.log('REAL STOCKX LISTINGS (with non-null stockx_listing_id)');
console.log('='.repeat(80));
console.log(`Found ${data?.length || 0} listings\n`);

if (!data || data.length === 0) {
  console.log('❌ No listings found with stockx_listing_id');
  console.log('\nThis means either:');
  console.log('  1. No listings have been created yet');
  console.log('  2. The create API is not saving stockx_listing_id correctly\n');
} else {
  data.forEach((link, i) => {
    console.log(`\n[${i + 1}] Listing:`);
    console.log('  Link ID:              ', link.id);
    console.log('  Inventory Item ID:    ', link.item_id);
    console.log('  User ID:              ', link.user_id);
    console.log('  StockX Product ID:    ', link.stockx_product_id);
    console.log('  StockX Variant ID:    ', link.stockx_variant_id);
    console.log('  StockX Listing ID:    ', link.stockx_listing_id);
    console.log('  StockX Listing Status:', link.stockx_listing_status || 'NULL ❌');
    console.log('  Last Sync At:         ', link.stockx_last_listing_sync_at || 'NULL');
    console.log('  Has Payload:          ', !!link.stockx_listing_payload);
    if (link.stockx_listing_payload) {
      console.log('  Payload Status:       ', link.stockx_listing_payload.status);
      console.log('  Payload Amount:       ', link.stockx_listing_payload.amount);
    }
    console.log('  Created At:           ', link.created_at);
    console.log('  Updated At:           ', link.updated_at);

    // Highlight issues
    if (!link.stockx_listing_status || link.stockx_listing_status === 'UNKNOWN') {
      console.log('\n  ⚠️  ISSUE: stockx_listing_status is NULL or UNKNOWN');
      console.log('      This listing will be FILTERED OUT by the UI!');
    }
  });
}

console.log('\n' + '='.repeat(80) + '\n');
