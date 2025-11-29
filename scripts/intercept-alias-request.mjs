#!/usr/bin/env node
/**
 * Intercept and log exactly what our API sends to Alias
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

// Recreate exactly what our code does
const STANDARD_ALIAS_PRICING_CONDITIONS = {
  product_condition: 'PRODUCT_CONDITION_NEW',
  packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
};

function getStandardAliasPricingParams(catalogId, size, regionId) {
  const params = {
    catalog_id: catalogId,
    size,
    ...STANDARD_ALIAS_PRICING_CONDITIONS,
  };

  // Only include region_id if explicitly provided
  if (regionId) {
    params.region_id = regionId;
  }

  return params;
}

async function testPricingRequest() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         INTERCEPT ALIAS API REQUEST                                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const catalogId = 'air-jordan-1-retro-high-og-dz5485-612';
  const size = 10;
  const regionId = '2';

  console.log('\n📋 Input Parameters:');
  console.log(`   catalogId: ${catalogId}`);
  console.log(`   size: ${size}`);
  console.log(`   regionId: ${regionId} (type: ${typeof regionId})`);

  // Get the params object
  const params = getStandardAliasPricingParams(catalogId, size, regionId);

  console.log('\n📦 Generated Params Object:');
  console.log(JSON.stringify(params, null, 2));

  // Create URLSearchParams
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    searchParams.append(key, value.toString());
  }

  const queryString = searchParams.toString();
  const url = `${baseUrl}/pricing_insights/availability?${queryString}`;

  console.log('\n🌐 Full URL:');
  console.log(url);

  console.log('\n🔗 Query String:');
  console.log(queryString);

  console.log('\n📨 Making Request...');

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    console.log(`\n✓ Response Status: ${response.status} ${response.statusText}`);

    const data = await response.json();

    if (response.ok && data.availability) {
      console.log('\n✓ SUCCESS! Pricing data received:');
      console.log(`   Lowest Ask: $${(data.availability.lowest_listing_price_cents / 100).toFixed(2)}`);
      console.log(`   Highest Bid: $${(data.availability.highest_offer_price_cents / 100).toFixed(2)}`);
    } else {
      console.log('\n❌ FAILED!');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }

  // Now try WITHOUT region_id to compare
  console.log('\n\n' + '═'.repeat(80));
  console.log('TESTING WITHOUT region_id (for comparison)');
  console.log('═'.repeat(80));

  const paramsWithoutRegion = getStandardAliasPricingParams(catalogId, size, undefined);

  console.log('\n📦 Params Without Region:');
  console.log(JSON.stringify(paramsWithoutRegion, null, 2));

  const searchParamsNoRegion = new URLSearchParams();
  for (const [key, value] of Object.entries(paramsWithoutRegion)) {
    searchParamsNoRegion.append(key, value.toString());
  }

  const urlNoRegion = `${baseUrl}/pricing_insights/availability?${searchParamsNoRegion.toString()}`;

  console.log('\n🌐 URL:');
  console.log(urlNoRegion);

  try {
    const response = await fetch(urlNoRegion, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    console.log(`\n✓ Response Status: ${response.status} ${response.statusText}`);

    const data = await response.json();

    if (response.ok && data.availability) {
      console.log('\n✓ SUCCESS! Pricing data received:');
      console.log(`   Lowest Ask: $${(data.availability.lowest_listing_price_cents / 100).toFixed(2)}`);
      console.log(`   Highest Bid: $${(data.availability.highest_offer_price_cents / 100).toFixed(2)}`);
    } else {
      console.log('\n❌ FAILED!');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }

  console.log('\n' + '═'.repeat(80) + '\n');
}

testPricingRequest();
