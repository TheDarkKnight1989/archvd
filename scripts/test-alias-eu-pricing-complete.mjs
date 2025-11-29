#!/usr/bin/env node
/**
 * Complete Alias EU Region Pricing Test
 * Tests all pricing-related endpoints with EU region (region_id=2)
 * Since /regions endpoint uses gRPC, we hardcode known region IDs
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

// Known regions (from Alias API documentation)
const KNOWN_REGIONS = [
  { id: 1, name: 'US' },
  { id: 2, name: 'EU' },
  { id: 3, name: 'UK' },
  { id: 4, name: 'CA' },
  { id: 5, name: 'AU' },
];

const TEST_PRODUCT = {
  sku: 'DZ5485-612',
  catalogId: 'air-jordan-1-retro-high-og-dz5485-612',
  productName: 'Air Jordan 1 Retro High OG Chicago Lost & Found',
  size: 10,
};

/**
 * Test listPricingInsights with region filter
 */
async function testListPricingInsights(catalogId, regionId, regionName) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📊 List Pricing Insights - ${regionName} (region_id=${regionId})`);
  console.log('─'.repeat(80));

  try {
    const params = new URLSearchParams({ region_id: regionId.toString() });
    const url = `${baseUrl}/pricing_insights/availabilities/${catalogId}?${params}`;
    console.log(`GET ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    if (!response.ok) {
      console.log(`❌ Failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data.availabilities && data.availabilities.length > 0) {
      console.log(`✓ Found ${data.availabilities.length} size variants`);

      // Filter to NEW condition only
      const newConditionSizes = data.availabilities.filter(
        a => a.product_condition === 'new'
      );

      console.log(`✓ ${newConditionSizes.length} sizes in NEW condition`);

      // Show a few examples
      const sampleSizes = newConditionSizes.slice(0, 3);
      console.log('\nSample sizes:');
      sampleSizes.forEach(size => {
        console.log(`  Size ${size.size}: Ask $${(size.lowest_listing_price_cents / 100).toFixed(2)}, Bid $${(size.highest_offer_price_cents / 100).toFixed(2)}`);
      });

      return data.availabilities;
    } else {
      console.log('❌ No availabilities found');
      return null;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Test getPricingInsights for specific size + region
 */
async function testGetPricingInsights(catalogId, size, regionId, regionName) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📊 Get Pricing Insights - ${regionName} - Size ${size}`);
  console.log('─'.repeat(80));

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
      },
    });

    if (!response.ok) {
      console.log(`❌ Failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data.availability) {
      const a = data.availability;
      console.log('✓ Pricing data:');
      console.log(`  Lowest Ask:        $${a.lowest_listing_price_cents ? (a.lowest_listing_price_cents / 100).toFixed(2) : 'N/A'}`);
      console.log(`  Highest Bid:       $${a.highest_offer_price_cents ? (a.highest_offer_price_cents / 100).toFixed(2) : 'N/A'}`);
      console.log(`  Last Sold:         $${a.last_sold_listing_price_cents ? (a.last_sold_listing_price_cents / 100).toFixed(2) : 'N/A'}`);
      console.log(`  Global Indicator:  $${a.global_indicator_price_cents ? (a.global_indicator_price_cents / 100).toFixed(2) : 'N/A'}`);
      console.log(`  Active Listings:   ${a.number_of_active_listings || 0}`);
      console.log(`  Active Offers:     ${a.number_of_active_offers || 0}`);
      console.log(`  Sales Last 72h:    ${a.number_of_sales_last_72_hours || 0}`);

      return a;
    } else {
      console.log('❌ No availability data');
      return null;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Test offer histogram (bid distribution)
 */
async function testOfferHistogram(catalogId, size, regionId, regionName) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📊 Offer Histogram (Bids) - ${regionName} - Size ${size}`);
  console.log('─'.repeat(80));

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
      },
    });

    if (!response.ok) {
      console.log(`❌ Failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data.histogram && data.histogram.length > 0) {
      console.log(`✓ Histogram has ${data.histogram.length} price buckets`);
      console.log(`  Price range: $${(data.histogram[0].price_cents / 100).toFixed(2)} - $${(data.histogram[data.histogram.length - 1].price_cents / 100).toFixed(2)}`);

      // Show distribution
      const totalOffers = data.histogram.reduce((sum, bucket) => sum + bucket.count, 0);
      console.log(`  Total offers: ${totalOffers}`);

      // Show top 3 buckets
      const top3 = data.histogram
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      console.log('\n  Top 3 bid prices:');
      top3.forEach((bucket, i) => {
        console.log(`    ${i + 1}. $${(bucket.price_cents / 100).toFixed(2)} (${bucket.count} offers)`);
      });

      return data.histogram;
    } else {
      console.log('❌ No histogram data');
      return null;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Test listing histogram (ask distribution)
 */
async function testListingHistogram(catalogId, size, regionId, regionName) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📊 Listing Histogram (Asks) - ${regionName} - Size ${size}`);
  console.log('─'.repeat(80));

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
      },
    });

    if (!response.ok) {
      console.log(`❌ Failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data.histogram && data.histogram.length > 0) {
      console.log(`✓ Histogram has ${data.histogram.length} price buckets`);
      console.log(`  Price range: $${(data.histogram[0].price_cents / 100).toFixed(2)} - $${(data.histogram[data.histogram.length - 1].price_cents / 100).toFixed(2)}`);

      // Show distribution
      const totalListings = data.histogram.reduce((sum, bucket) => sum + bucket.count, 0);
      console.log(`  Total listings: ${totalListings}`);

      // Show top 3 buckets
      const top3 = data.histogram
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      console.log('\n  Top 3 ask prices:');
      top3.forEach((bucket, i) => {
        console.log(`    ${i + 1}. $${(bucket.price_cents / 100).toFixed(2)} (${bucket.count} listings)`);
      });

      return data.histogram;
    } else {
      console.log('❌ No histogram data');
      return null;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Main test flow
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       COMPLETE ALIAS EU REGION PRICING TEST (region_id=2)                ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  console.log(`\n📦 Test Product:`);
  console.log(`   SKU: ${TEST_PRODUCT.sku}`);
  console.log(`   Catalog ID: ${TEST_PRODUCT.catalogId}`);
  console.log(`   Product: ${TEST_PRODUCT.productName}`);
  console.log(`   Test Size: ${TEST_PRODUCT.size}`);

  console.log(`\n🌍 Known Regions:`);
  KNOWN_REGIONS.forEach(region => {
    console.log(`   [${region.id}] ${region.name}`);
  });

  // Focus on EU region (region_id = 2)
  const euRegion = KNOWN_REGIONS.find(r => r.id === 2);

  console.log(`\n\n${'═'.repeat(80)}`);
  console.log(`TESTING ALL PRICING ENDPOINTS WITH EU REGION`);
  console.log('═'.repeat(80));

  // Test 1: List all availabilities for EU
  await testListPricingInsights(
    TEST_PRODUCT.catalogId,
    euRegion.id,
    euRegion.name
  );

  // Test 2: Get specific size pricing for EU
  await testGetPricingInsights(
    TEST_PRODUCT.catalogId,
    TEST_PRODUCT.size,
    euRegion.id,
    euRegion.name
  );

  // Test 3: Get offer histogram for EU
  await testOfferHistogram(
    TEST_PRODUCT.catalogId,
    TEST_PRODUCT.size,
    euRegion.id,
    euRegion.name
  );

  // Test 4: Get listing histogram for EU
  await testListingHistogram(
    TEST_PRODUCT.catalogId,
    TEST_PRODUCT.size,
    euRegion.id,
    euRegion.name
  );

  // Bonus: Compare with US region
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log(`BONUS: COMPARE EU vs US PRICING`);
  console.log('═'.repeat(80));

  const usRegion = KNOWN_REGIONS.find(r => r.id === 1);

  console.log('\n🇺🇸 US Pricing:');
  const usPricing = await testGetPricingInsights(
    TEST_PRODUCT.catalogId,
    TEST_PRODUCT.size,
    usRegion.id,
    usRegion.name
  );

  console.log('\n🇪🇺 EU Pricing:');
  const euPricing = await testGetPricingInsights(
    TEST_PRODUCT.catalogId,
    TEST_PRODUCT.size,
    euRegion.id,
    euRegion.name
  );

  if (usPricing && euPricing) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log('📊 Price Difference (EU vs US):');
    console.log('─'.repeat(80));

    if (usPricing.lowest_listing_price_cents && euPricing.lowest_listing_price_cents) {
      const askDiff = euPricing.lowest_listing_price_cents - usPricing.lowest_listing_price_cents;
      const askPct = ((askDiff / usPricing.lowest_listing_price_cents) * 100).toFixed(1);
      console.log(`  Lowest Ask: $${(askDiff / 100).toFixed(2)} difference (${askPct > 0 ? '+' : ''}${askPct}%)`);
    }

    if (usPricing.highest_offer_price_cents && euPricing.highest_offer_price_cents) {
      const bidDiff = euPricing.highest_offer_price_cents - usPricing.highest_offer_price_cents;
      const bidPct = ((bidDiff / usPricing.highest_offer_price_cents) * 100).toFixed(1);
      console.log(`  Highest Bid: $${(bidDiff / 100).toFixed(2)} difference (${bidPct > 0 ? '+' : ''}${bidPct}%)`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Complete EU Region Pricing Test Finished');
  console.log('═'.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
