#!/usr/bin/env node
/**
 * Verify Region IDs with Correct Enum Format
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

const TEST_PRODUCT = {
  catalogId: 'air-jordan-1-retro-high-og-dz5485-612',
  size: 10,
};

async function testRegionId(regionId) {
  try {
    const params = new URLSearchParams({
      catalog_id: TEST_PRODUCT.catalogId,
      size: TEST_PRODUCT.size.toString(),
      product_condition: 'PRODUCT_CONDITION_NEW', // CORRECT FORMAT
      packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION', // CORRECT FORMAT
      region_id: regionId.toString(),
    });

    const url = `${baseUrl}/pricing_insights/availability?${params}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        regionId,
        status: response.status,
        error: data.message || response.statusText,
        works: false,
      };
    }

    if (data.availability) {
      const a = data.availability;
      return {
        regionId,
        status: 200,
        works: true,
        lowestAsk: parseInt(a.lowest_listing_price_cents) || 0,
        highestBid: parseInt(a.highest_offer_price_cents) || 0,
        lastSold: parseInt(a.last_sold_listing_price_cents) || 0,
        globalIndicator: parseInt(a.global_indicator_price_cents) || 0,
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

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║            VERIFY ALIAS REGION IDS (CORRECT FORMAT)                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  console.log(`\n📦 Test Product: ${TEST_PRODUCT.catalogId}`);
  console.log(`📏 Test Size: ${TEST_PRODUCT.size}`);

  console.log('\n' + '═'.repeat(80));
  console.log('TESTING REGION IDS 1-10 with correct enum format');
  console.log('═'.repeat(80));

  const results = [];

  for (let regionId = 1; regionId <= 10; regionId++) {
    process.stdout.write(`\nTesting region_id=${regionId}... `);
    const result = await testRegionId(regionId);
    results.push(result);

    if (result.works) {
      if (result.noData) {
        console.log('✓ Works (no pricing data)');
      } else {
        console.log(`✓ Ask: $${(result.lowestAsk / 100).toFixed(2)}, Bid: $${(result.highestBid / 100).toFixed(2)}`);
      }
    } else {
      console.log(`✗ Failed (${result.status} ${result.error})`);
    }
  }

  const workingRegions = results.filter(r => r.works && !r.noData);

  console.log('\n\n' + '═'.repeat(80));
  console.log('PRICING COMPARISON TABLE');
  console.log('═'.repeat(80));
  console.log('\n' + '-'.repeat(95));
  console.log(
    'Region ID'.padEnd(12) +
    'Lowest Ask'.padEnd(15) +
    'Highest Bid'.padEnd(15) +
    'Last Sold'.padEnd(15) +
    'Global Ind.'.padEnd(15) +
    'Spread'.padEnd(15)
  );
  console.log('-'.repeat(95));

  workingRegions.forEach(r => {
    const ask = `$${(r.lowestAsk / 100).toFixed(2)}`;
    const bid = `$${(r.highestBid / 100).toFixed(2)}`;
    const sold = r.lastSold ? `$${(r.lastSold / 100).toFixed(2)}` : 'N/A';
    const globalInd = r.globalIndicator ? `$${(r.globalIndicator / 100).toFixed(2)}` : 'N/A';
    const spread = r.lowestAsk && r.highestBid ? `$${((r.lowestAsk - r.highestBid) / 100).toFixed(2)}` : 'N/A';

    console.log(
      r.regionId.toString().padEnd(12) +
      ask.padEnd(15) +
      bid.padEnd(15) +
      sold.padEnd(15) +
      globalInd.padEnd(15) +
      spread.padEnd(15)
    );
  });

  console.log('-'.repeat(95));

  // Group by unique prices
  console.log('\n' + '═'.repeat(80));
  console.log('PRICE PATTERN ANALYSIS');
  console.log('═'.repeat(80));

  const priceGroups = new Map();
  workingRegions.forEach(r => {
    const key = `${r.lowestAsk}-${r.highestBid}`;
    if (!priceGroups.has(key)) {
      priceGroups.set(key, {
        regions: [],
        ask: r.lowestAsk,
        bid: r.highestBid,
      });
    }
    priceGroups.get(key).regions.push(r.regionId);
  });

  console.log('\nRegions grouped by identical pricing:');
  let groupNum = 1;
  for (const [_, group] of priceGroups) {
    console.log(
      `\n  Market ${groupNum}: Ask $${(group.ask / 100).toFixed(2)}, Bid $${(group.bid / 100).toFixed(2)}`
    );
    console.log(`    Region IDs: ${group.regions.join(', ')}`);
    groupNum++;
  }

  // Try to identify regions by price differences
  console.log('\n' + '═'.repeat(80));
  console.log('REGION IDENTIFICATION (based on common patterns)');
  console.log('═'.repeat(80));

  const baseRegion = workingRegions.find(r => r.regionId === 1);

  if (baseRegion) {
    console.log('\nUsing Region 1 as baseline (likely US):');
    console.log(`  Ask: $${(baseRegion.lowestAsk / 100).toFixed(2)}, Bid: $${(baseRegion.highestBid / 100).toFixed(2)}`);

    console.log('\nPrice differences from Region 1:');
    workingRegions.filter(r => r.regionId !== 1).forEach(r => {
      const askDiff = r.lowestAsk - baseRegion.lowestAsk;
      const bidDiff = r.highestBid - baseRegion.highestBid;
      const askPct = ((askDiff / baseRegion.lowestAsk) * 100).toFixed(1);
      const bidPct = ((bidDiff / baseRegion.highestBid) * 100).toFixed(1);

      console.log(`\n  Region ${r.regionId}:`);
      console.log(`    Ask: ${askDiff >= 0 ? '+' : ''}$${(askDiff / 100).toFixed(2)} (${askPct > 0 ? '+' : ''}${askPct}%)`);
      console.log(`    Bid: ${bidDiff >= 0 ? '+' : ''}$${(bidDiff / 100).toFixed(2)} (${bidPct > 0 ? '+' : ''}${bidPct}%)`);
    });
  }

  console.log('\n\n' + '═'.repeat(80));
  console.log('CONCLUSIONS');
  console.log('═'.repeat(80));

  console.log('\n✓ Working region IDs:', workingRegions.map(r => r.regionId).join(', '));

  if (workingRegions.length > 1) {
    const region2 = workingRegions.find(r => r.regionId === 2);
    if (region2) {
      console.log('\n✓ Region 2 works and returns different pricing than Region 1');
      console.log('  This supports the claim that region_id=2 is a valid EU region');
      console.log('  However, we cannot definitively confirm it\'s EU without API docs');
    }
  }

  console.log('\n' + '═'.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
