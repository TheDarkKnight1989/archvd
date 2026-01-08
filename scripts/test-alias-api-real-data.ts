/**
 * Test Alias V4 API - Real Data Collection
 *
 * Purpose: Call actual Alias API endpoints and save responses
 * This is the REQUIRED first step before designing the schema
 *
 * Pattern: Same as StockX V4 testing
 * 1. Search catalog by SKU
 * 2. Get catalog item details
 * 3. Get pricing insights (all variants)
 * 4. Save all responses to JSON files
 *
 * Run: npx tsx scripts/test-alias-api-real-data.ts
 */

import fs from 'fs/promises';
import path from 'path';

const ALIAS_PAT = process.env.ALIAS_PAT;
const BASE_URL = 'https://api.alias.org/api/v1';

// Test with a well-known SKU
const TEST_SKU = 'DD1391-100'; // Nike Dunk Low Retro White Black (Panda Dunks)

interface AliasApiResponse {
  endpoint: string;
  timestamp: string;
  sku?: string;
  status: number;
  data: any;
  error?: string;
}

const responses: AliasApiResponse[] = [];

async function callAliasAPI(endpoint: string, description: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📡 ${description}`);
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${ALIAS_PAT}`,
      },
    });

    const data = await response.json();

    const result: AliasApiResponse = {
      endpoint,
      timestamp: new Date().toISOString(),
      sku: TEST_SKU,
      status: response.status,
      data,
    };

    if (!response.ok) {
      result.error = `HTTP ${response.status}`;
      console.error(`❌ Error: ${response.status}`);
      console.error(JSON.stringify(data, null, 2));
    } else {
      console.log(`✅ Success (${response.status})`);
      console.log(JSON.stringify(data, null, 2));
    }

    responses.push(result);
    return data;
  } catch (error: any) {
    console.error(`❌ Exception: ${error.message}`);
    responses.push({
      endpoint,
      timestamp: new Date().toISOString(),
      sku: TEST_SKU,
      status: 0,
      data: null,
      error: error.message,
    });
    throw error;
  }
}

async function main() {
  if (!ALIAS_PAT) {
    console.error('❌ Error: ALIAS_PAT environment variable not set');
    console.error('   Set it in .env.local: ALIAS_PAT=your_token_here');
    process.exit(1);
  }

  console.log('\n🚀 Alias V4 API Testing - Real Data Collection');
  console.log(`   SKU: ${TEST_SKU}`);
  console.log(`   Base URL: ${BASE_URL}\n`);

  try {
    // Step 1: Search Catalog by SKU
    const searchResults = await callAliasAPI(
      `/catalog?query=${encodeURIComponent(TEST_SKU)}`,
      'Step 1: Search Catalog by SKU'
    );

    if (!searchResults.catalog_items || searchResults.catalog_items.length === 0) {
      console.error(`\n❌ No results found for SKU: ${TEST_SKU}`);
      console.error('   Try a different SKU or check if product exists on Alias');
      process.exit(1);
    }

    const catalogItem = searchResults.catalog_items[0];
    const catalogId = catalogItem.catalog_id;

    console.log(`\n✅ Found catalog item: ${catalogItem.name}`);
    console.log(`   Catalog ID: ${catalogId}`);
    console.log(`   SKU: ${catalogItem.sku}`);

    // Step 2: Get Catalog Item Details
    await callAliasAPI(
      `/catalog/${catalogId}`,
      'Step 2: Get Catalog Item Details'
    );

    // Step 3: Get Pricing Insights - ALL variants (no filters)
    await callAliasAPI(
      `/pricing_insights/availabilities/${catalogId}`,
      'Step 3: Get Pricing Insights - All Variants (Global)'
    );

    // Step 4: Get Pricing Insights - US Region
    await callAliasAPI(
      `/pricing_insights/availabilities/${catalogId}?region_id=1`,
      'Step 4: Get Pricing Insights - US Region (region_id=1)'
    );

    // Step 5: Get Pricing Insights - Non-Consigned
    await callAliasAPI(
      `/pricing_insights/availabilities/${catalogId}?consigned=false`,
      'Step 5: Get Pricing Insights - Non-Consigned'
    );

    // Step 6: Get Pricing Insights - Consigned
    await callAliasAPI(
      `/pricing_insights/availabilities/${catalogId}?consigned=true`,
      'Step 6: Get Pricing Insights - Consigned'
    );

    // Step 7: Get Recent Sales (if available)
    try {
      await callAliasAPI(
        `/pricing_insights/recent_sales?catalog_id=${catalogId}&consigned=false&limit=10`,
        'Step 7: Get Recent Sales - Non-Consigned (limit 10)'
      );
    } catch (error) {
      console.log('   Note: Recent sales may not be available for this item');
    }

    // Step 8: Get Offer Histogram (for a specific size)
    // Use size 10 as a common test size
    try {
      await callAliasAPI(
        `/pricing_insights/offer_histogram?catalog_id=${catalogId}&size=10&product_condition=PRODUCT_CONDITION_NEW&packaging_condition=PACKAGING_CONDITION_GOOD_CONDITION`,
        'Step 8: Get Offer Histogram - Size 10, New/Good Condition'
      );
    } catch (error) {
      console.log('   Note: Offer histogram may not be available for this item');
    }

    // Save all responses to file
    const outputDir = path.join(process.cwd(), 'api-responses', 'alias_v4_test');
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, `${TEST_SKU.replace(/\s+/g, '-')}_${Date.now()}.json`);
    await fs.writeFile(
      outputFile,
      JSON.stringify({ sku: TEST_SKU, responses }, null, 2)
    );

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ All API calls complete!`);
    console.log(`📁 Responses saved to: ${outputFile}`);
    console.log(`${'='.repeat(80)}\n`);

    // Summary
    console.log('📊 Summary:');
    console.log(`   Total API calls: ${responses.length}`);
    console.log(`   Successful: ${responses.filter(r => r.status === 200).length}`);
    console.log(`   Failed: ${responses.filter(r => r.status !== 200).length}`);

    console.log('\n✅ Next Step: Review the API responses and design the schema');

  } catch (error: any) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
