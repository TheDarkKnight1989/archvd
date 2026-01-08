#!/usr/bin/env node
/**
 * Test Alias V4 Sync - Single Product
 *
 * Tests the full sync flow:
 * 1. Fetch catalog data
 * 2. Fetch availabilities (NEW + GOOD_CONDITION only)
 * 3. Insert into products table
 * 4. Insert into variants table
 * 5. Insert into market_data table
 * 6. Insert into price_history table
 * 7. Verify all data
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const ALIAS_PAT = process.env.ALIAS_PAT;
const ALIAS_BASE_URL = 'https://api.alias.org/api/v1';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ALIAS_PAT) {
  console.error('❌ Missing ALIAS_PAT environment variable');
  process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test SKU: Nike Dunk Low Black White
const TEST_SKU = 'DD1391-100';
const TEST_CATALOG_ID = 'dunk-low-black-white-dd1391-100';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchAlias(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${ALIAS_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${ALIAS_PAT}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Alias API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function convertCentsToMajor(centsString: string | null | undefined): number | null {
  if (!centsString || centsString === '0') return null;
  return parseFloat(centsString) / 100;
}

// ============================================================================
// STEP 1: FETCH CATALOG DATA
// ============================================================================

async function fetchCatalogData() {
  console.log('📦 Step 1: Fetching catalog data...');

  const response = await fetchAlias(`/catalog/${TEST_CATALOG_ID}`);
  const data = response.catalog_item; // Alias wraps response in catalog_item

  if (!data || !data.catalog_id) {
    throw new Error('Invalid catalog response - missing catalog_id');
  }

  console.log(`   ✅ Found: ${data.name}`);
  console.log(`   Brand: ${data.brand}`);
  console.log(`   SKU: ${data.sku}`);
  console.log(`   Sizes: ${data.allowed_sizes?.length || 0} available`);

  return data;
}

// ============================================================================
// STEP 2: FETCH AVAILABILITIES (NEW + GOOD_CONDITION)
// ============================================================================

async function fetchAvailabilities(catalogId: string, region: string = '1') {
  console.log(`\n💰 Step 2: Fetching availabilities (region ${region}, NEW + GOOD_CONDITION)...`);

  const data = await fetchAlias(`/pricing_insights/availabilities/${catalogId}`, {
    region_id: region,
  });

  // Filter to NEW + GOOD_CONDITION only
  const filtered = data.variants?.filter((v: any) =>
    v.product_condition === 'PRODUCT_CONDITION_NEW' &&
    v.packaging_condition === 'PACKAGING_CONDITION_GOOD_CONDITION'
  ) || [];

  console.log(`   ✅ Found ${filtered.length} variants (NEW + GOOD_CONDITION)`);

  // Group by consigned flag
  const standard = filtered.filter((v: any) => !v.consigned);
  const consigned = filtered.filter((v: any) => v.consigned);

  console.log(`   Standard: ${standard.length}, Consigned: ${consigned.length}`);

  return filtered;
}

// ============================================================================
// STEP 3: INSERT PRODUCT
// ============================================================================

async function insertProduct(catalogData: any) {
  console.log('\n📝 Step 3: Inserting product...');

  const productData = {
    alias_catalog_id: catalogData.catalog_id,
    brand: catalogData.brand,
    name: catalogData.name,
    nickname: catalogData.nickname || null,
    sku: catalogData.sku,
    colorway: catalogData.colorway || null,
    gender: catalogData.gender || null,
    product_category: catalogData.product_category,
    product_type: catalogData.product_type,
    release_date: catalogData.release_date || null,
    retail_price_cents: parseInt(catalogData.retail_price_cents || '0') || null,
    size_unit: catalogData.size_unit,
    allowed_sizes: catalogData.allowed_sizes || [],
    minimum_listing_price_cents: parseInt(catalogData.minimum_listing_price_cents || '0') || null,
    maximum_listing_price_cents: parseInt(catalogData.maximum_listing_price_cents || '0') || null,
    main_picture_url: catalogData.main_picture_url || null,
    requested_pictures: catalogData.requested_pictures || [],
    requires_listing_pictures: catalogData.requires_listing_pictures || false,
    resellable: catalogData.resellable !== false,
  };

  const { data, error } = await supabase
    .from('inventory_v4_alias_products')
    .upsert(productData, {
      onConflict: 'alias_catalog_id',
    })
    .select()
    .single();

  if (error) {
    console.error('   ❌ Error:', error.message);
    throw error;
  }

  console.log(`   ✅ Product upserted: ${data.alias_catalog_id}`);
  return data;
}

// ============================================================================
// STEP 4: INSERT VARIANTS
// ============================================================================

async function insertVariants(catalogId: string, variants: any[], regionId: string = '1') {
  console.log('\n🔢 Step 4: Inserting variants...');

  const variantData = variants.map(v => ({
    alias_catalog_id: catalogId,
    size_value: v.size,
    size_display: v.size.toString(),
    size_unit: 'US', // TODO: Get from product data
    consigned: v.consigned || false,
    region_id: regionId,
  }));

  const { data, error } = await supabase
    .from('inventory_v4_alias_variants')
    .upsert(variantData, {
      onConflict: 'alias_catalog_id,size_value,consigned,region_id',
    })
    .select();

  if (error) {
    console.error('   ❌ Error:', error.message);
    throw error;
  }

  console.log(`   ✅ Inserted ${data?.length || 0} variants`);
  return data || [];
}

// ============================================================================
// STEP 5: INSERT MARKET DATA
// ============================================================================

async function insertMarketData(variants: any[], apiVariants: any[]) {
  console.log('\n📊 Step 5: Inserting market data...');

  // Create lookup map: size+consigned -> variant_id
  const variantMap = new Map(
    variants.map(v => [`${v.size_value}_${v.consigned}`, v.id])
  );

  const marketData = apiVariants.map(av => {
    const key = `${av.size}_${av.consigned || false}`;
    const variantId = variantMap.get(key);

    if (!variantId) {
      console.warn(`   ⚠️  No variant ID for size ${av.size}, consigned=${av.consigned}`);
      return null;
    }

    return {
      alias_variant_id: variantId,
      lowest_ask: convertCentsToMajor(av.availability?.lowest_listing_price_cents),
      highest_bid: convertCentsToMajor(av.availability?.highest_offer_price_cents),
      last_sale_price: convertCentsToMajor(av.availability?.last_sold_listing_price_cents),
      global_indicator_price: convertCentsToMajor(av.availability?.global_indicator_price_cents),
      currency_code: 'USD',
      ask_count: null, // Not available in Alias API
      bid_count: null, // Not available in Alias API
      sales_last_72h: null, // Populated separately via recent_sales
      sales_last_30d: null, // Populated separately via recent_sales
      total_sales_volume: null,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }).filter(Boolean);

  const { data, error } = await supabase
    .from('inventory_v4_alias_market_data')
    .upsert(marketData, {
      onConflict: 'alias_variant_id',
    })
    .select();

  if (error) {
    console.error('   ❌ Error:', error.message);
    throw error;
  }

  console.log(`   ✅ Inserted ${data?.length || 0} market data records`);

  // Show price summary
  const withPrices = data?.filter(d => d.lowest_ask) || [];
  if (withPrices.length > 0) {
    console.log(`   💵 Price range: $${Math.min(...withPrices.map(d => d.lowest_ask))} - $${Math.max(...withPrices.map(d => d.lowest_ask))}`);
  }

  return data || [];
}

// ============================================================================
// STEP 6: INSERT PRICE HISTORY
// ============================================================================

async function insertPriceHistory(variants: any[], marketData: any[]) {
  console.log('\n📈 Step 6: Inserting price history...');

  const historyData = marketData.map(md => ({
    alias_variant_id: md.alias_variant_id,
    currency_code: md.currency_code,
    lowest_ask: md.lowest_ask,
    highest_bid: md.highest_bid,
    last_sale_price: md.last_sale_price,
    global_indicator_price: md.global_indicator_price,
    recorded_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('inventory_v4_alias_price_history')
    .insert(historyData)
    .select();

  if (error) {
    console.error('   ❌ Error:', error.message);
    throw error;
  }

  console.log(`   ✅ Inserted ${data?.length || 0} price history records`);
  return data || [];
}

// ============================================================================
// STEP 7: VERIFY DATA
// ============================================================================

async function verifyData(catalogId: string) {
  console.log('\n🔍 Step 7: Verifying data...\n');

  // Check products
  const { data: product, error: prodError } = await supabase
    .from('inventory_v4_alias_products')
    .select('*')
    .eq('alias_catalog_id', catalogId)
    .single();

  if (prodError || !product) {
    console.log('   ❌ Product not found');
  } else {
    console.log('   ✅ Product:', product.name);
  }

  // Check variants
  const { data: variants, error: varError } = await supabase
    .from('inventory_v4_alias_variants')
    .select('*')
    .eq('alias_catalog_id', catalogId);

  if (varError || !variants) {
    console.log('   ❌ Variants not found');
  } else {
    console.log(`   ✅ Variants: ${variants.length} total`);
    const standard = variants.filter(v => !v.consigned).length;
    const consigned = variants.filter(v => v.consigned).length;
    console.log(`      Standard: ${standard}, Consigned: ${consigned}`);
  }

  // Check market data
  const { data: marketData, error: mktError } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('*')
    .in('alias_variant_id', variants?.map(v => v.id) || []);

  if (mktError || !marketData) {
    console.log('   ❌ Market data not found');
  } else {
    console.log(`   ✅ Market data: ${marketData.length} records`);
    const withPrices = marketData.filter(d => d.lowest_ask);
    console.log(`      ${withPrices.length} with prices`);
  }

  // Check price history
  const { data: priceHistory, error: histError } = await supabase
    .from('inventory_v4_alias_price_history')
    .select('*')
    .in('alias_variant_id', variants?.map(v => v.id) || []);

  if (histError || !priceHistory) {
    console.log('   ❌ Price history not found');
  } else {
    console.log(`   ✅ Price history: ${priceHistory.length} records`);
  }

  // Check materialized view
  const { data: mvData, error: mvError } = await supabase
    .from('inventory_v4_alias_market_latest')
    .select('*')
    .eq('alias_catalog_id', catalogId);

  if (mvError || !mvData) {
    console.log('   ⚠️  Materialized view: needs refresh (run refresh_alias_market_latest())');
  } else {
    console.log(`   ✅ Materialized view: ${mvData.length} records`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Alias V4 Sync Test\n');
  console.log(`   SKU: ${TEST_SKU}`);
  console.log(`   Catalog ID: ${TEST_CATALOG_ID}`);
  console.log(`   Region: US (region_id=1)\n`);
  console.log('═'.repeat(60));

  try {
    // Step 1: Fetch catalog
    const catalogData = await fetchCatalogData();

    // Step 2: Fetch availabilities (NEW + GOOD_CONDITION)
    const variants = await fetchAvailabilities(catalogData.catalog_id);

    // Step 3: Insert product
    await insertProduct(catalogData);

    // Step 4: Insert variants
    const insertedVariants = await insertVariants(catalogData.catalog_id, variants);

    // Step 5: Insert market data
    const marketData = await insertMarketData(insertedVariants, variants);

    // Step 6: Insert price history
    await insertPriceHistory(insertedVariants, marketData);

    // Step 7: Verify
    await verifyData(catalogData.catalog_id);

    console.log('\n═'.repeat(60));
    console.log('✅ Alias V4 sync test complete!\n');

  } catch (error: any) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

main();
