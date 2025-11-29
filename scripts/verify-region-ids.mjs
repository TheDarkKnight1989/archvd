#!/usr/bin/env node
/**
 * Verify Region IDs by Testing Multiple Values
 * Tests region_ids 1-10 to see which ones work and what data they return
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

const TEST_PRODUCT = {
  catalogId: 'air-jordan-1-retro-high-og-dz5485-612',
  size: 10,
};

/**
 * Test a specific region ID
 */
async function testRegionId(regionId) {
  try {
    const params = new URLSearchParams({
      catalog_id: TEST_PRODUCT.catalogId,
      size: TEST_PRODUCT.size.toString(),
      product_condition: 'new',
      packaging_condition: 'good_condition',
      region_id: regionId.toString(),
    });

    const url = `${baseUrl}/pricing_insights/availability?${params}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    if (!response.ok) {
      return {
        regionId,
        status: response.status,
        error: response.statusText,
        works: false,
      };
    }

    const data = await response.json();

    if (data.availability) {
      const a = data.availability;
      return {
        regionId,
        status: 200,
        works: true,
        lowestAsk: a.lowest_listing_price_cents,
        highestBid: a.highest_offer_price_cents,
        lastSold: a.last_sold_listing_price_cents,
        globalIndicator: a.global_indicator_price_cents,
        activeListings: a.number_of_active_listings,
        activeOffers: a.number_of_active_offers,
      };
    } else {
      return {
        regionId,
        status: 200,
        works: true,
        noData: true,
      };
    }
  } catch (error) {
    return {
      regionId,
      error: error.message,
      works: false,
    };
  }
}

/**
 * Main test
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     VERIFY ALIAS REGION IDS                                ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  console.log(`\n📦 Test Product: ${TEST_PRODUCT.catalogId}`);
  console.log(`📏 Test Size: ${TEST_PRODUCT.size}`);

  console.log('\n' + '═'.repeat(80));
  console.log('TESTING REGION IDS 1-10');
  console.log('═'.repeat(80));

  const results = [];

  // Test region IDs 1-10
  for (let regionId = 1; regionId <= 10; regionId++) {
    process.stdout.write(`\nTesting region_id=${regionId}... `);
    const result = await testRegionId(regionId);
    results.push(result);

    if (result.works) {
      if (result.noData) {
        console.log('✓ Works (no pricing data)');
      } else {
        console.log(`✓ Works - Ask: $${(result.lowestAsk / 100).toFixed(2)}, Bid: $${(result.highestBid / 100).toFixed(2)}`);
      }
    } else {
      console.log(`✗ Failed (${result.status} ${result.error})`);
    }
  }

  // Summary table
  console.log('\n\n' + '═'.repeat(80));
  console.log('SUMMARY TABLE');
  console.log('═'.repeat(80));
  console.log('\n' + '-'.repeat(80));
  console.log(
    'ID'.padEnd(6) +
    'Status'.padEnd(12) +
    'Lowest Ask'.padEnd(15) +
    'Highest Bid'.padEnd(15) +
    'Last Sold'.padEnd(15)
  );
  console.log('-'.repeat(80));

  const workingRegions = results.filter(r => r.works && !r.noData);

  workingRegions.forEach(r => {
    const ask = r.lowestAsk ? `$${(r.lowestAsk / 100).toFixed(2)}` : 'N/A';
    const bid = r.highestBid ? `$${(r.highestBid / 100).toFixed(2)}` : 'N/A';
    const sold = r.lastSold ? `$${(r.lastSold / 100).toFixed(2)}` : 'N/A';

    console.log(
      r.regionId.toString().padEnd(6) +
      'Works'.padEnd(12) +
      ask.padEnd(15) +
      bid.padEnd(15) +
      sold.padEnd(15)
    );
  });

  const failedRegions = results.filter(r => !r.works);
  failedRegions.forEach(r => {
    console.log(
      r.regionId.toString().padEnd(6) +
      `Failed (${r.status})`.padEnd(12) +
      'N/A'.padEnd(15) +
      'N/A'.padEnd(15) +
      'N/A'.padEnd(15)
    );
  });

  console.log('-'.repeat(80));

  // Analysis
  console.log('\n' + '═'.repeat(80));
  console.log('PRICE VARIATIONS (trying to identify regions)');
  console.log('═'.repeat(80));

  // Group by unique prices to try to identify regions
  const priceGroups = new Map();
  workingRegions.forEach(r => {
    const key = `${r.lowestAsk}-${r.highestBid}`;
    if (!priceGroups.has(key)) {
      priceGroups.set(key, []);
    }
    priceGroups.get(key).push(r.regionId);
  });

  console.log('\nRegions with same pricing (likely same market):');
  let groupNum = 1;
  for (const [priceKey, regionIds] of priceGroups) {
    const [ask, bid] = priceKey.split('-');
    console.log(
      `\n  Group ${groupNum}: Ask $${(ask / 100).toFixed(2)}, Bid $${(bid / 100).toFixed(2)}`
    );
    console.log(`    Region IDs: ${regionIds.join(', ')}`);
    groupNum++;
  }

  // Common region guesses
  console.log('\n\n' + '═'.repeat(80));
  console.log('REGION ID GUESSES (based on common patterns):');
  console.log('═'.repeat(80));
  console.log('\nCommon region ID patterns:');
  console.log('  1 = US (usually the default)');
  console.log('  2 = EU (your claim - needs verification)');
  console.log('  3 = UK (often separate from EU)');
  console.log('  4 = CA (Canada)');
  console.log('  5 = AU (Australia)');
  console.log('  6 = JP (Japan)');

  console.log('\n⚠️  NOTE: Without the /regions endpoint, we cannot definitively confirm');
  console.log('   which region_id corresponds to which region name.');
  console.log('   The pricing differences suggest different markets, but the');
  console.log('   exact mapping needs official API documentation.');

  console.log('\n' + '═'.repeat(80));
  console.log('✓ Region ID Verification Complete');
  console.log('═'.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
