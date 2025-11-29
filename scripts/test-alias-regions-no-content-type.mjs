#!/usr/bin/env node
/**
 * Test Alias Regions API without Content-Type header
 */

import 'dotenv/config';

const ALIAS_PAT = process.env.ALIAS_PAT;
const baseUrl = 'https://api.alias.org/api/v1';

async function testRegionsEndpoint() {
  console.log('Testing Alias /regions endpoint (without Content-Type header)...\n');

  try {
    const url = `${baseUrl}/regions`;
    console.log(`GET ${url}`);
    console.log(`Authorization: Bearer ${ALIAS_PAT.slice(0, 8)}...\n`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ALIAS_PAT}`,
        // NO Content-Type header for GET requests
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}\n`);

    const responseText = await response.text();
    console.log('Raw Response:');
    console.log(responseText);

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('\n✓ Parsed JSON:');
        console.log(JSON.stringify(data, null, 2));

        if (data.regions) {
          console.log(`\n✓ Found ${data.regions.length} regions:`);
          data.regions.forEach(region => {
            console.log(`  [${region.id}] ${region.name}`);
          });
        }
      } catch (e) {
        console.log('⚠️  Response is not JSON');
      }
    } else {
      console.log('\n❌ Request failed');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRegionsEndpoint();
