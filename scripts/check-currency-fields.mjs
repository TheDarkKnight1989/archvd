#!/usr/bin/env node
/**
 * Check what currency fields the Alias API returns
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

async function checkCurrencyFields() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              CHECKING CURRENCY FIELDS IN API RESPONSE                      ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const regions = [
    { id: 1, code: 'US', expectedCurrency: 'USD' },
    { id: 2, code: 'EU', expectedCurrency: 'EUR' },
    { id: 3, code: 'UK', expectedCurrency: 'GBP' },
  ];

  const catalogId = 'air-jordan-1-retro-low-og-chicago-2025-hq6998-600';
  const size = 10;

  for (const region of regions) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`REGION: ${region.code} (Expected Currency: ${region.expectedCurrency})`);
    console.log('═'.repeat(80));

    const params = new URLSearchParams({
      catalog_id: catalogId,
      size: size.toString(),
      product_condition: 'PRODUCT_CONDITION_NEW',
      packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
      region_id: region.id.toString(),
    });

    const url = `${baseUrl}/pricing_insights/availability?${params}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${ALIAS_PAT}`,
        },
      });

      if (!response.ok) {
        console.log(`❌ Failed: ${response.status}`);
        continue;
      }

      const data = await response.json();

      console.log('\n📦 Full API Response:');
      console.log(JSON.stringify(data, null, 2));

      if (data.availability) {
        console.log('\n🔍 Available fields in "availability":');
        console.log(Object.keys(data.availability).join(', '));

        // Check for currency-related fields
        const currencyFields = Object.keys(data.availability).filter(key =>
          key.toLowerCase().includes('currency')
        );

        if (currencyFields.length > 0) {
          console.log('\n💰 Currency-related fields:');
          currencyFields.forEach(field => {
            console.log(`   ${field}: ${data.availability[field]}`);
          });
        } else {
          console.log('\n⚠️  No explicit currency field found in response');
        }
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(80) + '\n');
}

checkCurrencyFields();
