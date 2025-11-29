#!/usr/bin/env node
/**
 * Test if Alias API accepts numeric enum values
 * Based on user's code snippet: packaging_condition: 1, region_id: 2
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

const catalogId = 'air-jordan-1-retro-low-og-chicago-2025-hq6998-600';
const size = 10;

console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║              TESTING NUMERIC ENUM VALUES                                   ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

// Test different numeric values for product_condition and packaging_condition
const tests = [
  {
    name: 'String enums (current approach)',
    params: {
      catalog_id: catalogId,
      size: size,
      product_condition: 'PRODUCT_CONDITION_NEW',
      packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
      region_id: '2',
    }
  },
  {
    name: 'Numeric enums (product=1, packaging=1)',
    params: {
      catalog_id: catalogId,
      size: size,
      product_condition: '1',
      packaging_condition: '1',
      region_id: '2',
    }
  },
  {
    name: 'Numeric enums (product=2, packaging=2)',
    params: {
      catalog_id: catalogId,
      size: size,
      product_condition: '2',
      packaging_condition: '2',
      region_id: '2',
    }
  },
  {
    name: 'Mixed (string product, numeric packaging=1)',
    params: {
      catalog_id: catalogId,
      size: size,
      product_condition: 'PRODUCT_CONDITION_NEW',
      packaging_condition: '1',
      region_id: '2',
    }
  },
];

for (const test of tests) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`TEST: ${test.name}`);
  console.log('═'.repeat(80));

  const searchParams = new URLSearchParams(test.params);
  const url = `${baseUrl}/pricing_insights/availability?${searchParams}`;

  console.log(`\n🔗 Query: ${searchParams.toString()}`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();

      if (data.availability) {
        const a = data.availability;
        console.log('✅ SUCCESS!');
        console.log(`   Lowest Ask: $${(parseInt(a.lowest_listing_price_cents) / 100).toFixed(2)}`);
        console.log(`   Highest Bid: $${(parseInt(a.highest_offer_price_cents) / 100).toFixed(2)}`);
      } else {
        console.log('⚠️  Response OK but no availability data');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ FAILED');
      console.log(`   Error: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
}

// Also test the code snippet format directly
console.log(`\n\n${'═'.repeat(80)}`);
console.log('TESTING USER\'S CODE SNIPPET FORMAT');
console.log('═'.repeat(80));
console.log('\nFormat: { variant: { packaging_condition: 1, region_id: 2 } }');

const snippetParams = new URLSearchParams({
  catalog_id: catalogId,
  size: size,
  packaging_condition: '1',
  region_id: '2',
});

const snippetUrl = `${baseUrl}/pricing_insights/availability?${snippetParams}`;
console.log(`\n🔗 URL: ${snippetUrl}`);

try {
  const response = await fetch(snippetUrl, {
    headers: {
      Authorization: `Bearer ${ALIAS_PAT}`,
    },
  });

  console.log(`📊 Status: ${response.status} ${response.statusText}`);

  if (response.ok) {
    const data = await response.json();
    console.log('\n📦 Full Response:');
    console.log(JSON.stringify(data, null, 2));
  } else {
    const errorText = await response.text();
    console.log('\n❌ Error:');
    console.log(errorText);
  }
} catch (error) {
  console.log(`\n❌ ERROR: ${error.message}`);
}

console.log('\n' + '═'.repeat(80) + '\n');
