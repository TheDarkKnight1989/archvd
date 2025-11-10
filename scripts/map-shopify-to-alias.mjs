#!/usr/bin/env node
/**
 * Map Shopify → Alias
 * For each Shopify SKU, search Alias API and create inventory_alias_links
 * Logs unmatched SKUs for review
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

// ============================================================================
// Configuration
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALIAS_ENABLED = process.env.NEXT_PUBLIC_ALIAS_ENABLE === 'true';
const ALIAS_MOCK = process.env.NEXT_PUBLIC_ALIAS_MOCK !== 'false';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Search Alias API for a product by SKU
 */
async function searchAliasBySku(sku) {
  console.log(`  🔍 Searching Alias for SKU: ${sku}`);

  try {
    const response = await fetch(
      `http://localhost:3000/api/alias/products/search?q=${encodeURIComponent(sku)}&limit=5`
    );

    if (!response.ok) {
      console.error(`  ❌ Alias search failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      console.log(`  ⚠️  No Alias matches for SKU: ${sku}`);
      return null;
    }

    // Try to find exact SKU match first
    const exactMatch = data.results.find(
      (product) => product.sku?.toLowerCase() === sku.toLowerCase()
    );

    if (exactMatch) {
      console.log(`  ✅ Found exact match: ${exactMatch.name}`);
      return exactMatch;
    }

    // Otherwise return first result
    const firstMatch = data.results[0];
    console.log(`  ⚠️  Using fuzzy match: ${firstMatch.name} (SKU: ${firstMatch.sku})`);
    return firstMatch;
  } catch (error) {
    console.error(`  ❌ Error searching Alias: ${error.message}`);
    return null;
  }
}

/**
 * Create or update inventory_alias_link
 */
async function createAliasLink(inventoryId, aliasProductId, aliasProductSku) {
  console.log(`  🔗 Creating link for inventory ${inventoryId}`);

  // Check if link already exists
  const { data: existingLink } = await supabase
    .from('inventory_alias_links')
    .select('id')
    .eq('inventory_id', inventoryId)
    .single();

  if (existingLink) {
    console.log(`  ⚠️  Link already exists, skipping`);
    return { action: 'skipped' };
  }

  // Get inventory purchase price for spread calculation
  const { data: inventoryItem } = await supabase
    .from('Inventory')
    .select('purchase_price')
    .eq('id', inventoryId)
    .single();

  // Note: We don't have alias_listing_id yet (needs live listing creation)
  // For now, just store the product mapping
  const { error } = await supabase
    .from('inventory_alias_links')
    .insert({
      inventory_id: inventoryId,
      alias_listing_id: null, // Will be set when listing is created
      alias_product_id: aliasProductId,
      alias_product_sku: aliasProductSku,
      inventory_purchase_price: inventoryItem?.purchase_price || null,
      alias_ask_price: null, // Will be set when listing is created
      last_sync_at: new Date().toISOString(),
    });

  if (error) {
    console.error(`  ❌ Failed to create link: ${error.message}`);
    return { action: 'failed', error: error.message };
  }

  console.log(`  ✅ Link created successfully`);
  return { action: 'created' };
}

/**
 * Log unmatched SKU
 */
async function logUnmatchedSku(inventoryId, sku, reason) {
  const { error } = await supabase
    .from('alias_unmatched_log')
    .insert({
      inventory_id: inventoryId,
      sku,
      reason,
      attempted_at: new Date().toISOString(),
    });

  if (error) {
    console.error(`  ❌ Failed to log unmatched SKU: ${error.message}`);
  }
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log('🚀 Starting Inventory → Alias Mapping\n');

  // Check if Alias is enabled
  if (!ALIAS_ENABLED) {
    console.error('❌ Alias integration is not enabled');
    console.error('Set NEXT_PUBLIC_ALIAS_ENABLE=true in .env.local');
    process.exit(1);
  }

  const mode = ALIAS_MOCK ? 'mock' : 'live';
  console.log(`📍 Mode: ${mode}\n`);

  // Fetch all inventory items with SKUs (not already linked)
  const { data: inventoryItems, error: fetchError } = await supabase
    .from('Inventory')
    .select('id, sku, brand, model, size')
    .not('sku', 'is', null);

  if (fetchError) {
    console.error(`❌ Failed to fetch inventory: ${fetchError.message}`);
    process.exit(1);
  }

  if (!inventoryItems || inventoryItems.length === 0) {
    console.log('ℹ️  No inventory items with SKUs found');
    process.exit(0);
  }

  console.log(`📦 Found ${inventoryItems.length} inventory items with SKUs\n`);

  // Get already linked inventory IDs
  const { data: existingLinks } = await supabase
    .from('inventory_alias_links')
    .select('inventory_id');

  const linkedInventoryIds = new Set(existingLinks?.map((link) => link.inventory_id) || []);

  // Filter to unlinked items
  const unlinkedItems = inventoryItems.filter((item) => !linkedInventoryIds.has(item.id));

  console.log(`🔗 ${linkedInventoryIds.size} already linked`);
  console.log(`🆕 ${unlinkedItems.length} items to map\n`);

  if (unlinkedItems.length === 0) {
    console.log('✅ All items are already mapped!');
    process.exit(0);
  }

  // Process each item
  const results = {
    matched: 0,
    unmatched: 0,
    skipped: 0,
    failed: 0,
  };

  for (const item of unlinkedItems) {
    console.log(`\n📦 Processing: ${item.brand || 'Unknown'} ${item.model || ''} (SKU: ${item.sku})`);

    // Search Alias for this SKU
    const aliasProduct = await searchAliasBySku(item.sku);

    if (!aliasProduct) {
      console.log(`  ⚠️  No match found, logging`);
      await logUnmatchedSku(item.id, item.sku, 'No Alias product found');
      results.unmatched++;
      continue;
    }

    // Create link
    const linkResult = await createAliasLink(
      item.id,
      aliasProduct.id,
      aliasProduct.sku
    );

    if (linkResult.action === 'created') {
      results.matched++;
    } else if (linkResult.action === 'skipped') {
      results.skipped++;
    } else {
      results.failed++;
    }

    // Rate limit: wait 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Mapping Summary');
  console.log('='.repeat(60));
  console.log(`✅ Matched:   ${results.matched}`);
  console.log(`⚠️  Unmatched: ${results.unmatched}`);
  console.log(`⏭️  Skipped:   ${results.skipped}`);
  console.log(`❌ Failed:    ${results.failed}`);
  console.log(`📦 Total:     ${unlinkedItems.length}`);
  console.log('='.repeat(60) + '\n');

  if (results.unmatched > 0) {
    console.log(`\n⚠️  ${results.unmatched} items could not be matched to Alias`);
    console.log('Check alias_unmatched_log table for details\n');
  }

  console.log('✅ Mapping complete!\n');
}

// Run script
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
