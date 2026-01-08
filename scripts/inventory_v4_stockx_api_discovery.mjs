#!/usr/bin/env node
/**
 * INVENTORY V4 - STOCKX API DISCOVERY
 *
 * Purpose: Call REAL StockX APIs and save COMPLETE raw responses
 * User will review responses to make schema decisions
 *
 * DO NOT transform, filter, or summarize - just capture raw data
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Configuration
// ============================================================================

const TARGET_SKU = 'DD1391-100'; // Nike Dunk Low "Panda" - well-known product
const TARGET_GTIN = '194502878820'; // GTIN for size 10 Panda Dunk (example)
const OUTPUT_DIR = './api-responses/inventory_v4_stockx';
const RATE_LIMIT_DELAY_MS = 1100; // 1.1 seconds between requests (StockX: 1 req/sec)
const CURRENCY_CODE = 'GBP'; // 🇬🇧 UK PRIMARY REGION

// StockX API Configuration (from environment)
const STOCKX_API_BASE_URL = process.env.STOCKX_API_BASE_URL || 'https://api.stockx.com';
const STOCKX_ACCESS_TOKEN = process.env.STOCKX_ACCESS_TOKEN;
const STOCKX_REFRESH_TOKEN = process.env.STOCKX_REFRESH_TOKEN;
const STOCKX_CLIENT_ID = process.env.STOCKX_CLIENT_ID;
const STOCKX_CLIENT_SECRET = process.env.STOCKX_CLIENT_SECRET;
const STOCKX_API_KEY = process.env.STOCKX_API_KEY;

// ============================================================================
// Authentication
// ============================================================================

let cachedAccessToken = STOCKX_ACCESS_TOKEN;
let tokenExpiresAt = 0;

async function refreshAccessToken() {
  if (!STOCKX_REFRESH_TOKEN || !STOCKX_CLIENT_ID || !STOCKX_CLIENT_SECRET) {
    throw new Error(
      'Missing required environment variables: STOCKX_REFRESH_TOKEN, STOCKX_CLIENT_ID, STOCKX_CLIENT_SECRET'
    );
  }

  console.log('🔄 Refreshing StockX access token...');

  const tokenUrl = process.env.STOCKX_OAUTH_TOKEN_URL || 'https://accounts.stockx.com/oauth/token';
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: STOCKX_REFRESH_TOKEN,
      client_id: STOCKX_CLIENT_ID,
      client_secret: STOCKX_CLIENT_SECRET,
      audience: 'gateway.stockx.com',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  const expiresIn = data.expires_in || 3600;
  tokenExpiresAt = Date.now() + (expiresIn * 1000);

  console.log(`✅ Token refreshed (expires in ${expiresIn}s)`);
  return cachedAccessToken;
}

async function getAccessToken() {
  // If we have a cached token and it's not expiring soon, use it
  if (cachedAccessToken && tokenExpiresAt > Date.now() + 60000) {
    return cachedAccessToken;
  }

  // Otherwise, refresh the token
  return await refreshAccessToken();
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function saveResponse(filename, data) {
  const filepath = join(OUTPUT_DIR, filename);
  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Saved: ${filepath}`);
}

function printHeader(title) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

async function makeStockxRequest(endpoint) {
  const token = await getAccessToken();
  const url = `${STOCKX_API_BASE_URL}${endpoint}`;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Add x-api-key if configured (required for v2 API)
  if (STOCKX_API_KEY) {
    headers['x-api-key'] = STOCKX_API_KEY;
  }

  console.log(`📡 Calling: ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
    console.error(`Response: ${responseText}`);
    throw new Error(`StockX API error: ${response.status} ${response.statusText}`);
  }

  return JSON.parse(responseText);
}

// ============================================================================
// Main Discovery Script
// ============================================================================

async function main() {
  console.log('🔍 INVENTORY V4 - STOCKX API DISCOVERY');
  console.log('Target SKU:', TARGET_SKU);
  console.log('Target GTIN:', TARGET_GTIN);
  console.log('Currency Code:', CURRENCY_CODE, '🇬🇧');
  console.log('Output Directory:', OUTPUT_DIR);
  console.log('API Base URL:', STOCKX_API_BASE_URL);
  console.log('');

  // Verify credentials
  if (!STOCKX_REFRESH_TOKEN && !STOCKX_ACCESS_TOKEN) {
    console.error('❌ ERROR: Missing StockX credentials');
    console.error('');
    console.error('Required environment variables:');
    console.error('  STOCKX_ACCESS_TOKEN (or STOCKX_REFRESH_TOKEN for auto-refresh)');
    console.error('  STOCKX_CLIENT_ID (if using refresh token)');
    console.error('  STOCKX_CLIENT_SECRET (if using refresh token)');
    console.error('  STOCKX_API_KEY (optional, for v2 API)');
    console.error('');
    console.error('Set these in .env.local and try again.');
    process.exit(1);
  }

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('📁 Created output directory:', OUTPUT_DIR);
  }

  let productId = null;
  let variantId = null;

  // ==========================================================================
  // API 1: CATALOG SEARCH
  // ==========================================================================
  try {
    printHeader('API 1/5: Catalog Search');
    const endpoint = `/v2/catalog/search?query=${TARGET_SKU}`;

    const searchResponse = await makeStockxRequest(endpoint);

    saveResponse('01_catalog_search.json', {
      request: {
        endpoint,
        params: { query: TARGET_SKU },
        timestamp: new Date().toISOString(),
      },
      response: searchResponse,
    });

    // Extract productId for next API calls
    if (searchResponse?.products?.[0]?.productId) {
      productId = searchResponse.products[0].productId;
      console.log(`🎯 Extracted productId: ${productId}`);
    } else {
      console.error('❌ Could not extract productId from search response');
      console.log('Response structure:', JSON.stringify(searchResponse, null, 2));
      process.exit(1);
    }

    await sleep(RATE_LIMIT_DELAY_MS);
  } catch (error) {
    console.error('❌ API 1 Failed:', error.message);
    process.exit(1);
  }

  // ==========================================================================
  // API 2: PRODUCT DETAILS
  // ==========================================================================
  try {
    printHeader('API 2/5: Product Details');
    const endpoint = `/v2/catalog/products/${productId}`;

    const productResponse = await makeStockxRequest(endpoint);

    saveResponse('02_product_details.json', {
      request: {
        endpoint,
        params: { productId },
        timestamp: new Date().toISOString(),
      },
      response: productResponse,
    });

    await sleep(RATE_LIMIT_DELAY_MS);
  } catch (error) {
    console.error('❌ API 2 Failed:', error.message);
    // Continue anyway - we have productId
  }

  // ==========================================================================
  // API 3: PRODUCT VARIANTS (Get all sizes + variantIds)
  // ==========================================================================
  try {
    printHeader('API 3/5: Product Variants');
    const endpoint = `/v2/catalog/products/${productId}/variants`;

    const variantsResponse = await makeStockxRequest(endpoint);

    saveResponse('03_product_variants.json', {
      request: {
        endpoint,
        params: { productId },
        timestamp: new Date().toISOString(),
      },
      response: variantsResponse,
    });

    // Extract first variantId for market data API
    if (Array.isArray(variantsResponse) && variantsResponse[0]?.variantId) {
      variantId = variantsResponse[0].variantId;
      const size = variantsResponse[0].variantValue || 'unknown';
      console.log(`🎯 Extracted variantId: ${variantId} (size: ${size})`);
    } else {
      console.error('❌ Could not extract variantId from variants response');
    }

    await sleep(RATE_LIMIT_DELAY_MS);
  } catch (error) {
    console.error('❌ API 3 Failed:', error.message);
    // Continue anyway
  }

  // ==========================================================================
  // API 4: VARIANT BY GTIN (Barcode Scanner Support)
  // ==========================================================================
  try {
    printHeader('API 4/5: Variant by GTIN');
    const endpoint = `/v2/catalog/products/variants/gtins/${TARGET_GTIN}`;

    const gtinResponse = await makeStockxRequest(endpoint);

    saveResponse('04_variant_by_gtin.json', {
      request: {
        endpoint,
        params: { gtin: TARGET_GTIN },
        timestamp: new Date().toISOString(),
      },
      response: gtinResponse,
    });

    await sleep(RATE_LIMIT_DELAY_MS);
  } catch (error) {
    console.error('❌ API 4 Failed:', error.message);
    console.log('Note: GTIN lookup may fail if GTIN is invalid for this product');
    // Continue anyway - barcode scanner is secondary workflow
  }

  // ==========================================================================
  // API 5: MARKET DATA
  // ==========================================================================
  if (variantId) {
    try {
      printHeader('API 5/5: Market Data');
      const endpoint = `/v2/catalog/products/${productId}/variants/${variantId}/market-data?currencyCode=${CURRENCY_CODE}`;

      const marketDataResponse = await makeStockxRequest(endpoint);

      saveResponse('05_market_data.json', {
        request: {
          endpoint,
          params: { productId, variantId },
          timestamp: new Date().toISOString(),
        },
        response: marketDataResponse,
      });
    } catch (error) {
      console.error('❌ API 5 Failed:', error.message);
    }
  } else {
    console.error('❌ Skipping API 5: No variantId available');
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  printHeader('✅ API DISCOVERY COMPLETE');
  console.log('');
  console.log('📁 Raw responses saved to:', OUTPUT_DIR);
  console.log('');
  console.log('Files created:');
  console.log('  01_catalog_search.json       - Search by SKU → get productId');
  console.log('  02_product_details.json      - Product info (title, brand, etc.)');
  console.log('  03_product_variants.json     - All sizes + variantIds');
  console.log('  04_variant_by_gtin.json      - Barcode scanner lookup');
  console.log('  05_market_data.json          - Prices (lowestAsk, highestBid, etc.)');
  console.log('');
  console.log('🎯 Key IDs discovered:');
  console.log(`  SKU:        ${TARGET_SKU}`);
  console.log(`  productId:  ${productId || '(not found)'}`);
  console.log(`  variantId:  ${variantId || '(not found)'}`);
  console.log('');
  console.log('📋 Next Steps:');
  console.log('  1. Review raw JSON files in api-responses/inventory_v4_stockx/');
  console.log('  2. Identify all fields available in responses');
  console.log('  3. Decide which fields to include in V4 schema');
  console.log('  4. Design schema based on ACTUAL API data (not assumptions)');
  console.log('');
}

// ============================================================================
// Run
// ============================================================================

main().catch(error => {
  console.error('');
  console.error('❌ FATAL ERROR:', error.message);
  console.error('');
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
  process.exit(1);
});
