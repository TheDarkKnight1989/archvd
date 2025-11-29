#!/usr/bin/env node
/**
 * Test Alias API with EU Region (region_id = 2)
 * Tests catalog search and pricing endpoints with EU region
 */

import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';
const TEST_SKUS = [
  'DZ5485-612', // Air Jordan 1 Chicago
  'DD1391-100', // Panda Dunks
];

/**
 * Test the catalog search endpoint
 */
async function testCatalogSearch(sku) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TESTING CATALOG SEARCH: ${sku}`);
  console.log('='.repeat(80));

  try {
    const url = `${BASE_URL}/api/alias/search?query=${encodeURIComponent(sku)}&limit=1`;
    console.log(`\nGET ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Search failed:', data);
      return null;
    }

    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      console.log('\n✓ Found product:');
      console.log(`  Catalog ID: ${item.catalog_id}`);
      console.log(`  Name: ${item.name}`);
      console.log(`  Brand: ${item.brand}`);
      console.log(`  SKU: ${item.sku}`);
      console.log(`  Category: ${item.product_category_v2}`);
      return item;
    } else {
      console.log('❌ No products found');
      return null;
    }
  } catch (error) {
    console.error('❌ Error searching catalog:', error.message);
    return null;
  }
}

/**
 * Test pricing insights for a specific region
 */
async function testPricingWithRegion(catalogId, size, regionId, regionName) {
  console.log(`\n${'-'.repeat(80)}`);
  console.log(`TESTING PRICING: ${regionName} (region_id=${regionId || 'global'})`);
  console.log('-'.repeat(80));

  try {
    const params = new URLSearchParams({
      size: size.toString(),
    });
    if (regionId) {
      params.append('region_id', regionId);
    }

    const url = `${BASE_URL}/api/alias/pricing/${catalogId}?${params}`;
    console.log(`\nGET ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Pricing failed (${regionName}):`, data);
      return null;
    }

    if (data.availability) {
      const avail = data.availability;
      console.log(`\n✓ Pricing data for ${regionName}:`);
      console.log(`  Lowest Ask: ${avail.lowest_listing_price_cents ? `$${(avail.lowest_listing_price_cents / 100).toFixed(2)}` : 'N/A'}`);
      console.log(`  Highest Bid: ${avail.highest_offer_price_cents ? `$${(avail.highest_offer_price_cents / 100).toFixed(2)}` : 'N/A'}`);
      console.log(`  Last Sold: ${avail.last_sold_listing_price_cents ? `$${(avail.last_sold_listing_price_cents / 100).toFixed(2)}` : 'N/A'}`);
      console.log(`  Global Indicator: ${avail.global_indicator_price_cents ? `$${(avail.global_indicator_price_cents / 100).toFixed(2)}` : 'N/A'}`);
      console.log(`  Active Listings: ${avail.number_of_active_listings || 0}`);
      console.log(`  Active Offers: ${avail.number_of_active_offers || 0}`);
      return avail;
    } else {
      console.log(`❌ No pricing data available for ${regionName}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching pricing (${regionName}):`, error.message);
    return null;
  }
}

/**
 * Compare pricing between regions
 */
function comparePricing(globalPricing, euPricing) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('PRICING COMPARISON: Global vs EU');
  console.log('='.repeat(80));

  if (!globalPricing || !euPricing) {
    console.log('\n⚠️  Cannot compare - missing pricing data');
    return;
  }

  // Compare lowest asks
  const globalAsk = globalPricing.lowest_listing_price_cents;
  const euAsk = euPricing.lowest_listing_price_cents;

  console.log('\nLowest Ask:');
  console.log(`  Global: ${globalAsk ? `$${(globalAsk / 100).toFixed(2)}` : 'N/A'}`);
  console.log(`  EU:     ${euAsk ? `$${(euAsk / 100).toFixed(2)}` : 'N/A'}`);

  if (globalAsk && euAsk) {
    const diff = euAsk - globalAsk;
    const pctDiff = ((diff / globalAsk) * 100).toFixed(1);
    console.log(`  Difference: $${(diff / 100).toFixed(2)} (${pctDiff}%)`);
  }

  // Compare highest bids
  const globalBid = globalPricing.highest_offer_price_cents;
  const euBid = euPricing.highest_offer_price_cents;

  console.log('\nHighest Bid:');
  console.log(`  Global: ${globalBid ? `$${(globalBid / 100).toFixed(2)}` : 'N/A'}`);
  console.log(`  EU:     ${euBid ? `$${(euBid / 100).toFixed(2)}` : 'N/A'}`);

  if (globalBid && euBid) {
    const diff = euBid - globalBid;
    const pctDiff = ((diff / globalBid) * 100).toFixed(1);
    console.log(`  Difference: $${(diff / 100).toFixed(2)} (${pctDiff}%)`);
  }

  // Compare liquidity
  console.log('\nMarket Liquidity:');
  console.log(`  Global Active Listings: ${globalPricing.number_of_active_listings || 0}`);
  console.log(`  EU Active Listings:     ${euPricing.number_of_active_listings || 0}`);
  console.log(`  Global Active Offers:   ${globalPricing.number_of_active_offers || 0}`);
  console.log(`  EU Active Offers:       ${euPricing.number_of_active_offers || 0}`);
}

/**
 * Main test flow
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           ALIAS EU REGION TESTING (region_id = 2)                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  for (const sku of TEST_SKUS) {
    // 1. Search for the product
    const product = await testCatalogSearch(sku);
    if (!product) {
      console.log(`\n⚠️  Skipping ${sku} - product not found\n`);
      continue;
    }

    // 2. Test with a common size (size 10 for sneakers)
    const testSize = 10;
    console.log(`\nTesting size ${testSize} for ${product.catalog_id}`);

    // 3. Get global pricing (no region filter)
    const globalPricing = await testPricingWithRegion(
      product.catalog_id,
      testSize,
      null,
      'Global'
    );

    // 4. Get EU pricing (region_id = 2)
    const euPricing = await testPricingWithRegion(
      product.catalog_id,
      testSize,
      '2',
      'EU'
    );

    // 5. Compare the results
    comparePricing(globalPricing, euPricing);

    console.log('\n');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✓ EU Region Testing Complete');
  console.log('='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
