#!/usr/bin/env node

/**
 * Alias (GOAT) Sync Script
 * Manual sync of listings, orders, and payouts
 * Usage: npm run sync:alias [--listings] [--orders] [--payouts] [--user-id=<uuid>]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

const args = process.argv.slice(2);
const options = {
  listings: args.includes('--listings'),
  orders: args.includes('--orders'),
  payouts: args.includes('--payouts'),
  userId: args.find((arg) => arg.startsWith('--user-id='))?.split('=')[1] || null,
  all: !args.some((arg) => arg.startsWith('--listings') || arg.startsWith('--orders') || arg.startsWith('--payouts')),
};

// If no specific sync requested, sync all
if (options.all) {
  options.listings = true;
  options.orders = true;
  options.payouts = true;
}

// ============================================================================
// Feature Flag Check
// ============================================================================

const isAliasEnabled = process.env.NEXT_PUBLIC_ALIAS_ENABLE === 'true';

if (!isAliasEnabled) {
  console.log('⚠️  Alias integration is disabled (NEXT_PUBLIC_ALIAS_ENABLE=false)');
  console.log('   Set NEXT_PUBLIC_ALIAS_ENABLE=true in .env.local to enable');
  process.exit(0);
}

// ============================================================================
// Main Sync Function
// ============================================================================

async function main() {
  console.log('🚀 Alias (GOAT) Sync Script\n');

  // Get users to sync
  let usersToSync = [];

  if (options.userId) {
    // Sync specific user
    const { data: user, error } = await supabase
      .from('alias_accounts')
      .select('id, user_id, alias_username, status')
      .eq('user_id', options.userId)
      .eq('status', 'active')
      .single();

    if (error || !user) {
      console.error(`❌ User ${options.userId} not found or not connected to Alias`);
      process.exit(1);
    }

    usersToSync = [user];
  } else {
    // Sync all connected users
    const { data: users, error } = await supabase
      .from('alias_accounts')
      .select('id, user_id, alias_username, status')
      .eq('status', 'active');

    if (error) {
      console.error('❌ Failed to fetch connected users:', error.message);
      process.exit(1);
    }

    usersToSync = users || [];
  }

  if (usersToSync.length === 0) {
    console.log('⚠️  No users connected to Alias');
    console.log('   Users must connect their Alias account via Settings → Integrations');
    process.exit(0);
  }

  console.log(`📊 Found ${usersToSync.length} connected user(s)\n`);

  // Sync each user
  for (const user of usersToSync) {
    console.log(`\n┌─ Syncing user: ${user.alias_username || user.user_id}`);
    console.log(`└─ Account ID: ${user.id}\n`);

    let syncedCount = 0;

    try {
      if (options.listings) {
        const listingsCount = await syncListings(user);
        syncedCount += listingsCount;
      }

      if (options.orders) {
        const ordersCount = await syncOrders(user);
        syncedCount += ordersCount;
      }

      if (options.payouts) {
        const payoutsCount = await syncPayouts(user);
        syncedCount += payoutsCount;
      }

      // Update last_sync_at
      await supabase
        .from('alias_accounts')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', user.id);

      console.log(`✅ Synced ${syncedCount} records for ${user.alias_username || user.user_id}\n`);
    } catch (error) {
      console.error(`❌ Sync failed for ${user.alias_username}:`, error.message);

      // Update sync_error
      await supabase
        .from('alias_accounts')
        .update({ sync_error: error.message })
        .eq('id', user.id);
    }
  }

  console.log('\n✅ Sync complete!\n');
}

// ============================================================================
// Sync Functions
// ============================================================================

async function syncListings(user) {
  console.log('📦 Syncing listings...');

  // TODO: Fetch from Alias API
  // For now, simulate with rate limit notice
  console.log('   ⚠️  TODO: Implement Alias API fetch');
  console.log('   Rate limit: ~120 requests/min');

  // Mock data for testing
  const mockListings = [];

  if (mockListings.length > 0) {
    const { error } = await supabase.from('alias_listings').upsert(mockListings, {
      onConflict: 'alias_listing_id',
    });

    if (error) {
      throw new Error(`Listings upsert failed: ${error.message}`);
    }

    console.log(`   ✅ Upserted ${mockListings.length} listings`);
    return mockListings.length;
  } else {
    console.log('   ℹ️  No listings to sync');
    return 0;
  }
}

async function syncOrders(user) {
  console.log('📋 Syncing orders...');

  // TODO: Fetch from Alias API
  console.log('   ⚠️  TODO: Implement Alias API fetch');

  // Mock data
  const mockOrders = [];

  if (mockOrders.length > 0) {
    const { error } = await supabase.from('alias_orders').upsert(mockOrders, {
      onConflict: 'alias_order_id',
    });

    if (error) {
      throw new Error(`Orders upsert failed: ${error.message}`);
    }

    console.log(`   ✅ Upserted ${mockOrders.length} orders`);
    return mockOrders.length;
  } else {
    console.log('   ℹ️  No orders to sync');
    return 0;
  }
}

async function syncPayouts(user) {
  console.log('💰 Syncing payouts...');

  // TODO: Fetch from Alias API
  console.log('   ⚠️  TODO: Implement Alias API fetch');

  // Mock data
  const mockPayouts = [];

  if (mockPayouts.length > 0) {
    const { error } = await supabase.from('alias_payouts').upsert(mockPayouts, {
      onConflict: 'alias_payout_id',
    });

    if (error) {
      throw new Error(`Payouts upsert failed: ${error.message}`);
    }

    console.log(`   ✅ Upserted ${mockPayouts.length} payouts`);
    return mockPayouts.length;
  } else {
    console.log('   ℹ️  No payouts to sync');
    return 0;
  }
}

// ============================================================================
// Rate Limiting Helper
// ============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedFetch(fetchFn, rateLimit = { requests: 120, perMinute: 1 }) {
  const delayMs = (60 * 1000) / rateLimit.requests;
  await sleep(delayMs);
  return fetchFn();
}

// ============================================================================
// Run
// ============================================================================

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
