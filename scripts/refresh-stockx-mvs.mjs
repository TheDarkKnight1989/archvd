#!/usr/bin/env node
/**
 * Refresh materialized views after StockX integration
 * Run: node scripts/refresh-stockx-mvs.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function refreshMaterializedViews() {
  console.log('🔄 Refreshing sneaker_price_daily_medians...');
  const { error: sneakerError } = await supabase.rpc('refresh_sneaker_daily_medians');
  
  if (sneakerError) {
    console.error('❌ Failed to refresh sneaker_price_daily_medians:', sneakerError.message);
  } else {
    console.log('✅ sneaker_price_daily_medians refreshed');
  }

  console.log('🔄 Refreshing portfolio_value_daily...');
  const { error: portfolioError } = await supabase.rpc('refresh_portfolio_value_daily');
  
  if (portfolioError) {
    console.error('❌ Failed to refresh portfolio_value_daily:', portfolioError.message);
  } else {
    console.log('✅ portfolio_value_daily refreshed');
  }

  console.log('✅ All materialized views refreshed successfully');
}

refreshMaterializedViews();
