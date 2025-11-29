#!/usr/bin/env node
/**
 * Check the /availabilities endpoint for currency info
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

async function checkAvailabilitiesEndpoint() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         CHECKING /availabilities ENDPOINT FOR CURRENCY INFO                ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const catalogId = 'air-jordan-1-retro-low-og-chicago-2025-hq6998-600';
  const regionId = 2; // EU

  const params = new URLSearchParams({ region_id: regionId.toString() });
  const url = `${baseUrl}/pricing_insights/availabilities/${catalogId}?${params}`;

  console.log(`\n🌐 URL: ${url}`);
  console.log(`📍 Region: EU (${regionId})\n`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
      },
    });

    if (!response.ok) {
      console.log(`❌ Failed: ${response.status}`);
      return;
    }

    const data = await response.json();

    console.log('📦 Full Response (first variant only):');
    if (data.availabilities && data.availabilities.length > 0) {
      console.log(JSON.stringify(data.availabilities[0], null, 2));

      console.log('\n🔍 All fields in first variant:');
      console.log(Object.keys(data.availabilities[0]).join(', '));

      // Check for currency
      const currencyFields = Object.keys(data.availabilities[0]).filter(key =>
        key.toLowerCase().includes('currency') || key.toLowerCase().includes('curr')
      );

      if (currencyFields.length > 0) {
        console.log('\n💰 Currency fields found:');
        currencyFields.forEach(field => {
          console.log(`   ${field}: ${data.availabilities[0][field]}`);
        });
      } else {
        console.log('\n⚠️  No currency field in availabilities response');
      }

      // Check top-level response for currency
      console.log('\n🔍 Top-level response fields:');
      console.log(Object.keys(data).join(', '));

      const topCurrencyFields = Object.keys(data).filter(key =>
        key.toLowerCase().includes('currency') || key.toLowerCase().includes('curr')
      );

      if (topCurrencyFields.length > 0) {
        console.log('\n💰 Top-level currency fields:');
        topCurrencyFields.forEach(field => {
          console.log(`   ${field}: ${data[field]}`);
        });
      }
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  console.log('\n' + '═'.repeat(80) + '\n');
}

checkAvailabilitiesEndpoint();
