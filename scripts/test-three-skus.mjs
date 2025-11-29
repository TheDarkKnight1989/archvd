#!/usr/bin/env node
/**
 * Test 3 specific SKUs across US/EU/UK regions
 * Size: US 10
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

const TEST_SKUS = [
  'hq6998-600',
  'fv5029-010',
  'dm7866-104',
];

const REGIONS = [
  { id: 1, code: 'US', name: 'United States' },
  { id: 2, code: 'EU', name: 'Europe' },
  { id: 3, code: 'UK', name: 'United Kingdom' },
];

const SIZE = 10;

/**
 * Search for catalog ID by SKU
 */
async function searchBySKU(sku) {
  try {
    const params = new URLSearchParams({ query: sku });
    const url = `${baseUrl}/catalog?${params}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: response.statusText };
    }

    const data = await response.json();

    if (data.catalog_items && data.catalog_items.length > 0) {
      const item = data.catalog_items[0];
      return {
        success: true,
        catalogId: item.catalog_id,
        name: item.name,
        brand: item.brand,
        sku: item.sku,
      };
    }

    return { success: false, error: 'Not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get pricing for a specific region
 */
async function getPricing(catalogId, size, regionId) {
  try {
    const params = new URLSearchParams({
      catalog_id: catalogId,
      size: size.toString(),
      product_condition: 'PRODUCT_CONDITION_NEW',
      packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
      region_id: regionId.toString(),
    });

    const url = `${baseUrl}/pricing_insights/availability?${params}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: response.statusText };
    }

    const data = await response.json();

    if (data.availability) {
      const a = data.availability;
      return {
        success: true,
        lowestAsk: parseInt(a.lowest_listing_price_cents) || 0,
        highestBid: parseInt(a.highest_offer_price_cents) || 0,
        lastSold: parseInt(a.last_sold_listing_price_cents) || 0,
        activeListings: a.number_of_active_listings || 0,
        activeOffers: a.number_of_active_offers || 0,
      };
    }

    return { success: true, noData: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              3 SKUs - SIZE US 10 - US/EU/UK PRICING                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  console.log(`\n📏 Test Size: US ${SIZE}`);
  console.log(`🌍 Regions: US (1), EU (2), UK (3)\n`);

  for (const sku of TEST_SKUS) {
    console.log('\n' + '═'.repeat(80));
    console.log(`SKU: ${sku}`);
    console.log('═'.repeat(80));

    // Step 1: Search for the product
    process.stdout.write('\n🔍 Searching catalog... ');
    const searchResult = await searchBySKU(sku);

    if (!searchResult.success) {
      console.log(`❌ ${searchResult.error}`);
      console.log('⚠️  Skipping this SKU\n');
      continue;
    }

    console.log('✓');
    console.log(`\n📦 Product Found:`);
    console.log(`   Name: ${searchResult.name}`);
    console.log(`   Brand: ${searchResult.brand}`);
    console.log(`   Catalog ID: ${searchResult.catalogId}`);

    // Step 2: Get pricing for all regions
    console.log(`\n💰 Pricing Data (Size ${SIZE}):`);
    console.log('-'.repeat(80));

    const regionPricing = [];

    for (const region of REGIONS) {
      process.stdout.write(`   ${region.code}... `);
      const pricing = await getPricing(searchResult.catalogId, SIZE, region.id);

      if (pricing.success && !pricing.noData) {
        const ask = pricing.lowestAsk ? `$${(pricing.lowestAsk / 100).toFixed(2)}` : 'N/A';
        const bid = pricing.highestBid ? `$${(pricing.highestBid / 100).toFixed(2)}` : 'N/A';
        console.log(`Ask: ${ask.padEnd(10)} Bid: ${bid.padEnd(10)}`);
        regionPricing.push({ region: region.code, ...pricing });
      } else if (pricing.noData) {
        console.log('No pricing data');
        regionPricing.push({ region: region.code, noData: true });
      } else {
        console.log(`❌ ${pricing.error}`);
      }
    }

    // Summary table
    console.log('\n📊 Summary Table:');
    console.log('-'.repeat(80));
    console.log(
      'Region'.padEnd(10) +
      'Lowest Ask'.padEnd(15) +
      'Highest Bid'.padEnd(15) +
      'Last Sold'.padEnd(15) +
      'Spread'.padEnd(15)
    );
    console.log('-'.repeat(80));

    regionPricing.filter(p => !p.noData).forEach(p => {
      const ask = p.lowestAsk ? `$${(p.lowestAsk / 100).toFixed(2)}` : 'N/A';
      const bid = p.highestBid ? `$${(p.highestBid / 100).toFixed(2)}` : 'N/A';
      const sold = p.lastSold ? `$${(p.lastSold / 100).toFixed(2)}` : 'N/A';
      const spread = p.lowestAsk && p.highestBid
        ? `$${((p.lowestAsk - p.highestBid) / 100).toFixed(2)}`
        : 'N/A';

      console.log(
        p.region.padEnd(10) +
        ask.padEnd(15) +
        bid.padEnd(15) +
        sold.padEnd(15) +
        spread.padEnd(15)
      );
    });

    console.log('-'.repeat(80));

    // Price comparison vs US
    const usPrice = regionPricing.find(p => p.region === 'US');
    if (usPrice && !usPrice.noData && usPrice.lowestAsk > 0) {
      console.log('\n📈 Price vs US:');

      ['EU', 'UK'].forEach(regionCode => {
        const regionPrice = regionPricing.find(p => p.region === regionCode);
        if (regionPrice && !regionPrice.noData && regionPrice.lowestAsk > 0) {
          const diff = regionPrice.lowestAsk - usPrice.lowestAsk;
          const pct = ((diff / usPrice.lowestAsk) * 100).toFixed(1);
          const sign = diff > 0 ? '+' : '';
          console.log(`   ${regionCode}: ${sign}$${(diff / 100).toFixed(2)} (${sign}${pct}%)`);
        }
      });
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✓ Complete');
  console.log('═'.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
