#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n🔧 Fixing UNKNOWN listing status...\n');

// Fix the UNKNOWN listing (ID from trace above)
const linkId = 'd325c4df-a5b0-4fb7-bc26-168a935dc705';

const { data, error } = await supabase
  .from('inventory_market_links')
  .update({
    stockx_listing_status: 'ACTIVE', // Set to ACTIVE since it was created successfully
    stockx_last_listing_sync_at: new Date().toISOString(),
  })
  .eq('id', linkId)
  .select();

if (error) {
  console.error('❌ Failed:', error);
  process.exit(1);
}

console.log('✅ Updated listing status to ACTIVE');
console.log('Updated row:', data[0]);
console.log('\nNow the listing should appear in the StockX Listings page!\n');
