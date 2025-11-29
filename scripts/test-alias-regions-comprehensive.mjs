#!/usr/bin/env node
/**
 * Comprehensive Alias Regions Testing
 * Tests all region-related endpoints including:
 * - List regions
 * - Pricing insights with regions
 * - Offer histogram with regions
 * - Listing histogram with regions
 */

import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const TEST_PRODUCT = {
  sku: 'DZ5485-612',
  catalogId: 'air-jordan-1-retro-high-og-dz5485-612',
  size: 10,
};

/**
 * Test the regions list endpoint
 */
async function testListRegions() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: LIST ALL REGIONS');
  console.log('='.repeat(80));

  try {
    const url = `${BASE_URL}/api/alias/regions`;
    console.log(`\nGET ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to list regions:', data);
      return null;
    }

    if (data.success && data.regions) {
      console.log(`\n✓ Found ${data.regions.length} regions:`);
      data.regions.forEach(region => {
        console.log(`  [${region.id}] ${region.name}`);
      });
      return data.regions;
    } else {
      console.log('❌ No regions data in response');
      return null;
    }
  } catch (error) {
    console.error('❌ Error listing regions:', error.message);
    return null;
  }
}

/**
 * Test pricing insights for multiple regions
 */
async function testPricingAcrossRegions(catalogId, size, regions) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: PRICING INSIGHTS ACROSS REGIONS');
  console.log('='.repeat(80));

  const results = {};

  // Test global first
  console.log(`\n📊 Testing Global (no region filter)...`);
  const globalUrl = `${BASE_URL}/api/alias/pricing/${catalogId}?size=${size}`;
  console.log(`GET ${globalUrl}`);

  try {
    const globalResponse = await fetch(globalUrl);
    const globalData = await globalResponse.json();

    if (globalResponse.ok && globalData.availability) {
      results.global = globalData.availability;
      console.log('✓ Global pricing retrieved');
    } else {
      console.log('⚠️  Global pricing not available');
    }
  } catch (error) {
    console.error('❌ Error fetching global pricing:', error.message);
  }

  // Test each region
  for (const region of regions) {
    console.log(`\n📊 Testing ${region.name} (region_id=${region.id})...`);
    const regionUrl = `${BASE_URL}/api/alias/pricing/${catalogId}?size=${size}&region_id=${region.id}`;
    console.log(`GET ${regionUrl}`);

    try {
      const regionResponse = await fetch(regionUrl);
      const regionData = await regionResponse.json();

      if (regionResponse.ok && regionData.availability) {
        results[region.name] = regionData.availability;
        console.log(`✓ ${region.name} pricing retrieved`);
      } else {
        console.log(`⚠️  ${region.name} pricing not available`);
      }
    } catch (error) {
      console.error(`❌ Error fetching ${region.name} pricing:`, error.message);
    }
  }

  return results;
}

/**
 * Display pricing comparison table
 */
function displayPricingComparison(pricingResults) {
  console.log('\n' + '='.repeat(80));
  console.log('PRICING COMPARISON TABLE');
  console.log('='.repeat(80));

  // Header
  console.log('\n' + '-'.repeat(80));
  console.log(
    'Region'.padEnd(15) +
    'Lowest Ask'.padEnd(15) +
    'Highest Bid'.padEnd(15) +
    'Last Sold'.padEnd(15) +
    'Listings'.padEnd(12)
  );
  console.log('-'.repeat(80));

  // Rows
  for (const [regionName, pricing] of Object.entries(pricingResults)) {
    const lowestAsk = pricing.lowest_listing_price_cents
      ? `$${(pricing.lowest_listing_price_cents / 100).toFixed(2)}`
      : 'N/A';
    const highestBid = pricing.highest_offer_price_cents
      ? `$${(pricing.highest_offer_price_cents / 100).toFixed(2)}`
      : 'N/A';
    const lastSold = pricing.last_sold_listing_price_cents
      ? `$${(pricing.last_sold_listing_price_cents / 100).toFixed(2)}`
      : 'N/A';
    const listings = pricing.number_of_active_listings || 0;

    console.log(
      regionName.padEnd(15) +
      lowestAsk.padEnd(15) +
      highestBid.padEnd(15) +
      lastSold.padEnd(15) +
      listings.toString().padEnd(12)
    );
  }
  console.log('-'.repeat(80));
}

/**
 * Test direct API calls to Alias (bypassing our API routes)
 */
async function testDirectAliasAPI(catalogId, size, regionId) {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: DIRECT ALIAS API CALLS (region_id=2)');
  console.log('='.repeat(80));

  const ALIAS_PAT = process.env.ALIAS_PAT;
  if (!ALIAS_PAT) {
    console.log('⚠️  ALIAS_PAT not set, skipping direct API tests');
    return;
  }

  const baseUrl = 'https://api.alias.org/api/v1';

  // Test 1: List pricing insights with region
  console.log('\n📊 Testing listPricingInsights with region_id=2...');
  try {
    const url = `${baseUrl}/pricing_insights/availabilities/${catalogId}?region_id=${regionId}`;
    console.log(`GET ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok && data.availabilities) {
      console.log(`✓ Retrieved ${data.availabilities.length} size variants for EU region`);

      // Find our test size
      const ourSize = data.availabilities.find(
        a => parseFloat(a.size) === size && a.product_condition === 'new'
      );

      if (ourSize) {
        console.log(`\n  Size ${size} EU Pricing:`);
        console.log(`    Lowest Ask: $${(ourSize.lowest_listing_price_cents / 100).toFixed(2)}`);
        console.log(`    Highest Bid: $${(ourSize.highest_offer_price_cents / 100).toFixed(2)}`);
        console.log(`    Active Listings: ${ourSize.number_of_active_listings}`);
      }
    } else {
      console.log('⚠️  No availabilities data:', data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 2: Get specific pricing insights
  console.log('\n📊 Testing getPricingInsights for specific size...');
  try {
    const params = new URLSearchParams({
      catalog_id: catalogId,
      size: size.toString(),
      product_condition: 'new',
      packaging_condition: 'good_condition',
      region_id: regionId.toString(),
    });

    const url = `${baseUrl}/pricing_insights/availability?${params}`;
    console.log(`GET ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok && data.availability) {
      console.log('✓ Retrieved specific pricing for size 10, EU region:');
      console.log(`  Lowest Ask: $${(data.availability.lowest_listing_price_cents / 100).toFixed(2)}`);
      console.log(`  Highest Bid: $${(data.availability.highest_offer_price_cents / 100).toFixed(2)}`);
      console.log(`  Last Sold: $${data.availability.last_sold_listing_price_cents ? (data.availability.last_sold_listing_price_cents / 100).toFixed(2) : 'N/A'}`);
    } else {
      console.log('⚠️  No availability data:', data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 3: Offer histogram
  console.log('\n📊 Testing offer histogram...');
  try {
    const params = new URLSearchParams({
      catalog_id: catalogId,
      size: size.toString(),
      product_condition: 'new',
      packaging_condition: 'good_condition',
      region_id: regionId.toString(),
    });

    const url = `${baseUrl}/pricing_insights/offer_histogram?${params}`;
    console.log(`GET ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok && data.histogram) {
      console.log(`✓ Retrieved offer histogram with ${data.histogram.length} buckets`);
      if (data.histogram.length > 0) {
        console.log(`  Price range: $${(data.histogram[0].price_cents / 100).toFixed(2)} - $${(data.histogram[data.histogram.length - 1].price_cents / 100).toFixed(2)}`);
      }
    } else {
      console.log('⚠️  No histogram data');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 4: Listing histogram
  console.log('\n📊 Testing listing histogram...');
  try {
    const params = new URLSearchParams({
      catalog_id: catalogId,
      size: size.toString(),
      product_condition: 'new',
      packaging_condition: 'good_condition',
      region_id: regionId.toString(),
    });

    const url = `${baseUrl}/pricing_insights/listing_histogram?${params}`;
    console.log(`GET ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok && data.histogram) {
      console.log(`✓ Retrieved listing histogram with ${data.histogram.length} buckets`);
      if (data.histogram.length > 0) {
        console.log(`  Price range: $${(data.histogram[0].price_cents / 100).toFixed(2)} - $${(data.histogram[data.histogram.length - 1].price_cents / 100).toFixed(2)}`);
      }
    } else {
      console.log('⚠️  No histogram data');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Main test flow
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         COMPREHENSIVE ALIAS REGIONS TESTING                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  console.log(`\nTest Product: ${TEST_PRODUCT.sku}`);
  console.log(`Catalog ID: ${TEST_PRODUCT.catalogId}`);
  console.log(`Test Size: ${TEST_PRODUCT.size}`);

  // Test 1: List all regions
  const regions = await testListRegions();
  if (!regions || regions.length === 0) {
    console.log('\n❌ Cannot proceed without regions data');
    return;
  }

  // Test 2: Get pricing for all regions
  const pricingResults = await testPricingAcrossRegions(
    TEST_PRODUCT.catalogId,
    TEST_PRODUCT.size,
    regions
  );

  // Display comparison table
  displayPricingComparison(pricingResults);

  // Test 3: Direct API calls with EU region
  await testDirectAliasAPI(TEST_PRODUCT.catalogId, TEST_PRODUCT.size, 2);

  console.log('\n' + '='.repeat(80));
  console.log('✓ Comprehensive Region Testing Complete');
  console.log('='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
