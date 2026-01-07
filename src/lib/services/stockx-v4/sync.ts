/**
 * Inventory V4 - StockX Sync Layer
 * Core sync functions for fetching and storing StockX data in V4 tables
 *
 * Architecture:
 * - Global catalog (products/variants shared across users)
 * - Cache-first with 24hr TTL
 * - Historical price tracking
 * - Partial failure handling
 *
 * FROZEN ARCHITECTURE - DO NOT MODIFY PATTERNS
 */

import { StockxClient } from '@/lib/services/stockx/client';
import { createClient as createServiceClient } from '@/lib/supabase/service';
import type {
  SyncResult,
  SyncError,
  CatalogSearchResponse,
  ProductDetailsResponse,
  ProductVariantsResponse,
  ProductVariant,
  MarketDataResponse,
  ProductRow,
  VariantRow,
  MarketDataRow,
  PriceHistoryRow,
  FreshMarketOptions,
  MarketData,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const RATE_LIMIT_MS = 1100; // 1.1 seconds between requests (StockX: 1 req/sec)
const SUPPORTED_CURRENCIES = ['GBP', 'EUR', 'USD'] as const; // Multi-region support
const DEFAULT_CURRENCY = 'GBP'; // 🇬🇧 UK PRIMARY REGION (for single-currency calls)
const DEFAULT_TTL_HOURS = 24;

/**
 * BASELINE_MODE: When true, only fetch GBP prices (3x faster sync)
 * EUR/USD should be derived from GBP × fx_rates at render time
 *
 * Set via: STOCKX_BASELINE_MODE=true in .env or as runtime env var
 *
 * Benefits:
 * - 3x fewer API calls (15 calls instead of 45 for a 15-variant product)
 * - Faster daily sync (entire catalog syncs in ~30min instead of ~90min)
 * - Reduced rate limit risk
 *
 * When disabled (full multi-currency mode):
 * - Fetches GBP, EUR, USD prices directly from StockX
 * - More accurate region-specific pricing (StockX adjusts for local market)
 * - Use for initial seeding or when fx-derived prices aren't acceptable
 */
const BASELINE_MODE = process.env.STOCKX_BASELINE_MODE === 'true';

// Currencies to fetch based on mode (log once on first call)
let baselineModeLogged = false;
const getCurrenciesToFetch = (): readonly string[] => {
  if (BASELINE_MODE) {
    if (!baselineModeLogged) {
      console.log('[StockX Sync] BASELINE MODE: Fetching GBP only (EUR/USD via fx_rates)');
      baselineModeLogged = true;
    }
    return ['GBP'];
  }
  return SUPPORTED_CURRENCIES;
};

// ============================================================================
// Utility: Sleep for Rate Limiting
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Utility: Convert STRING Price to NUMERIC
// ============================================================================

/**
 * Convert StockX price string to numeric
 * StockX returns prices as STRINGS in MAJOR UNITS
 * Example: "27" → 27.00 (NOT 2700 pennies)
 */
function parsePrice(priceString: string | null): number | null {
  if (!priceString) return null;
  const parsed = parseFloat(priceString);
  return isNaN(parsed) ? null : parsed;
}

// ============================================================================
// Database: Check if Product Exists by SKU
// ============================================================================

async function getProductBySku(
  sku: string
): Promise<{ productId: string; marketDataUpdatedAt: string } | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('inventory_v4_stockx_products')
    .select('stockx_product_id, updated_at')
    .eq('style_id', sku)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    productId: data.stockx_product_id,
    marketDataUpdatedAt: data.updated_at || new Date(0).toISOString(),
  };
}

// ============================================================================
// Database: UPSERT Product
// ============================================================================

async function upsertProduct(product: ProductRow): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('inventory_v4_stockx_products')
    .upsert(product, {
      onConflict: 'stockx_product_id',
    });

  if (error) {
    throw new Error(`Failed to upsert product: ${error.message}`);
  }
}

// ============================================================================
// Database: UPSERT Variants (Bulk)
// ============================================================================

async function upsertVariants(variants: VariantRow[]): Promise<void> {
  if (variants.length === 0) return;

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('inventory_v4_stockx_variants')
    .upsert(variants, {
      onConflict: 'stockx_variant_id',
    });

  if (error) {
    throw new Error(`Failed to upsert variants: ${error.message}`);
  }
}

// ============================================================================
// Database: UPSERT Market Data
// ============================================================================

async function upsertMarketData(marketData: MarketDataRow): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('inventory_v4_stockx_market_data')
    .upsert(marketData, {
      onConflict: 'stockx_variant_id,currency_code',
    });

  if (error) {
    throw new Error(`Failed to upsert market data: ${error.message}`);
  }
}

// ============================================================================
// Database: UPSERT Price History (one row per variant+currency+day)
// ============================================================================

/**
 * Upsert price history - one row per (variant, currency, day)
 * If re-synced same day, overwrites with latest prices
 * Requires unique index: idx_price_history_daily_unique
 */
async function insertPriceHistory(history: PriceHistoryRow): Promise<void> {
  const supabase = createServiceClient();

  // Get today's date in YYYY-MM-DD format for snapshot_date
  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('inventory_v4_stockx_price_history')
    .upsert(
      {
        ...history,
        snapshot_date: today,
        recorded_at: new Date().toISOString(),
      },
      {
        onConflict: 'stockx_variant_id,currency_code,snapshot_date',
      }
    );

  if (error) {
    throw new Error(`Failed to upsert price history: ${error.message}`);
  }
}

// ============================================================================
// Database: Get Cached Market Data
// ============================================================================

async function getCachedMarketData(
  variantId: string,
  currencyCode: string,
  ttlHours: number
): Promise<MarketDataRow | null> {
  const supabase = createServiceClient();

  const ttlDate = new Date(Date.now() - ttlHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('*')
    .eq('stockx_variant_id', variantId)
    .eq('currency_code', currencyCode)
    .gte('updated_at', ttlDate)
    .single();

  if (error || !data) {
    return null;
  }

  return data as MarketDataRow;
}

// ============================================================================
// Database: Load Variants for Product
// ============================================================================

async function loadVariantsForProduct(productId: string): Promise<VariantRow[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('*')
    .eq('stockx_product_id', productId);

  if (error) {
    throw new Error(`Failed to load variants: ${error.message}`);
  }

  return (data || []) as VariantRow[];
}

// ============================================================================
// API: Catalog Search
// ============================================================================

async function catalogSearch(sku: string): Promise<string> {
  const client = new StockxClient();
  const endpoint = `/v2/catalog/search?query=${encodeURIComponent(sku)}`;

  const response = await client.request<CatalogSearchResponse>(endpoint, {
    method: 'GET',
  });

  if (!response?.products?.[0]?.productId) {
    throw new Error(`Product not found for SKU: ${sku}`);
  }

  return response.products[0].productId;
}

// ============================================================================
// API: Product Details
// ============================================================================

async function fetchProductDetails(productId: string): Promise<ProductRow> {
  const client = new StockxClient();
  const endpoint = `/v2/catalog/products/${productId}`;

  const response = await client.request<ProductDetailsResponse>(endpoint, {
    method: 'GET',
  });

  if (!response) {
    throw new Error(`Failed to fetch product details for ${productId}`);
  }

  // Transform API response to database row
  return {
    stockx_product_id: response.productId,
    brand: response.brand,
    title: response.title,
    style_id: response.styleId,
    product_type: response.productType,
    url_key: response.urlKey,
    colorway: response.productAttributes?.colorway || null,
    gender: response.productAttributes?.gender || null,
    release_date: response.productAttributes?.releaseDate || null,
    retail_price: response.productAttributes?.retailPrice || null,
    is_flex_eligible: response.isFlexEligible || false,
    is_direct_eligible: response.isDirectEligible || false,
  };
}

// ============================================================================
// API: Product Variants
// ============================================================================

async function fetchProductVariants(
  productId: string
): Promise<ProductVariant[]> {
  const client = new StockxClient();
  const endpoint = `/v2/catalog/products/${productId}/variants`;

  const response = await client.request<ProductVariantsResponse>(endpoint, {
    method: 'GET',
  });

  if (!Array.isArray(response)) {
    throw new Error(`Failed to fetch variants for ${productId}`);
  }

  return response;
}

// ============================================================================
// Transform: Variants to Database Rows
// ============================================================================

function transformVariantsToRows(
  productId: string,
  variants: ProductVariant[]
): VariantRow[] {
  return variants.map((v) => ({
    stockx_variant_id: v.variantId,
    stockx_product_id: productId,
    variant_name: v.variantName,
    variant_value: v.variantValue,
    size_chart: v.sizeChart,
    gtins: v.gtins || [],
    is_flex_eligible: v.isFlexEligible || false,
    is_direct_eligible: v.isDirectEligible || false,
  }));
}

// ============================================================================
// API: Market Data
// ============================================================================

async function fetchMarketData(
  productId: string,
  variantId: string,
  currencyCode: string
): Promise<MarketDataResponse> {
  const client = new StockxClient();
  const endpoint = `/v2/catalog/products/${productId}/variants/${variantId}/market-data?currencyCode=${currencyCode}`;

  const response = await client.request<MarketDataResponse>(endpoint, {
    method: 'GET',
  });

  if (!response) {
    throw new Error(`Failed to fetch market data for ${variantId}`);
  }

  return response;
}

// ============================================================================
// Transform: Market Data to Database Row
// ============================================================================

function transformMarketDataToRow(
  response: MarketDataResponse
): MarketDataRow {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_HOURS * 60 * 60 * 1000).toISOString();

  return {
    stockx_variant_id: response.variantId,
    currency_code: response.currencyCode,
    highest_bid: parsePrice(response.highestBidAmount),
    lowest_ask: parsePrice(response.lowestAskAmount),
    flex_lowest_ask: parsePrice(response.flexLowestAskAmount),
    earn_more: parsePrice(response.earnMoreAmount),
    sell_faster: parsePrice(response.sellFasterAmount),
    standard_market_data: response.standardMarketData,
    flex_market_data: response.flexMarketData,
    direct_market_data: response.directMarketData,
    updated_at: now,
    expires_at: expiresAt,
  };
}

// ============================================================================
// Core Function: Get Fresh Market Data (with cache + history)
// ============================================================================

/**
 * Fetch market data with cache-first strategy
 * - Checks cache based on TTL
 * - Fetches from API if stale or forceRefresh
 * - UPSERTS market_data
 * - INSERTS price_history (builds historical data)
 */
export async function getFreshMarketData(
  productId: string,
  variantId: string,
  currencyCode: string = DEFAULT_CURRENCY,
  options: FreshMarketOptions = {}
): Promise<MarketData> {
  const {
    forceRefresh = false,
    ttlHours = DEFAULT_TTL_HOURS,
    appendHistory = true,
  } = options;

  // 1. Check cache (unless forceRefresh)
  if (!forceRefresh) {
    const cached = await getCachedMarketData(variantId, currencyCode, ttlHours);
    if (cached) {
      return { cached: true, data: cached };
    }
  }

  // 2. Fetch from API
  const apiResponse = await fetchMarketData(productId, variantId, currencyCode);
  const marketDataRow = transformMarketDataToRow(apiResponse);

  // 3. UPSERT market_data
  await upsertMarketData(marketDataRow);

  // 4. INSERT price_history (if enabled)
  if (appendHistory) {
    const historyRow: PriceHistoryRow = {
      stockx_variant_id: variantId,
      currency_code: currencyCode,
      highest_bid: marketDataRow.highest_bid,
      lowest_ask: marketDataRow.lowest_ask,
    };
    await insertPriceHistory(historyRow);
  }

  return { cached: false, data: marketDataRow };
}

// ============================================================================
// Database: Auto-Update Style Catalog with StockX Product ID
// ============================================================================

/**
 * Automatically update inventory_v4_style_catalog with StockX product details
 * Called after successful product sync to ensure catalog is always up-to-date
 *
 * Updates:
 * - stockx_product_id (links to inventory_v4_stockx_products)
 * - stockx_url_key (for URL generation)
 * - Optionally: primary_image_url, brand, name if missing
 */
async function updateStyleCatalogWithStockxId(
  sku: string,
  productId: string,
  productRow: ProductRow
): Promise<void> {
  const supabase = createServiceClient();

  // Check if SKU exists in style catalog
  const { data: existing, error: fetchError } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_product_id, primary_image_url, brand, name')
    .eq('style_id', sku)
    .single();

  if (fetchError || !existing) {
    // SKU not in style catalog - that's okay, might be a manual search
    console.log(`[V4 Sync] SKU ${sku} not in style_catalog, skipping catalog update`);
    return;
  }

  // Build update payload - always update stockx_product_id and url_key
  const updatePayload: Record<string, unknown> = {
    stockx_product_id: productId,
    stockx_url_key: productRow.url_key,
  };

  // Fill in missing metadata if not already set
  if (!existing.primary_image_url && productRow.url_key) {
    // StockX image URL pattern
    updatePayload.primary_image_url = `https://images.stockx.com/images/${productRow.url_key}.jpg?fit=fill&bg=FFFFFF&w=700&h=500&fm=webp&auto=compress&trim=color&q=90`;
  }
  if (!existing.brand && productRow.brand) {
    updatePayload.brand = productRow.brand;
  }
  if (!existing.name && productRow.title) {
    updatePayload.name = productRow.title;
  }

  // Update the catalog
  const { error: updateError } = await supabase
    .from('inventory_v4_style_catalog')
    .update(updatePayload)
    .eq('style_id', sku);

  if (updateError) {
    console.error(`[V4 Sync] Failed to update style_catalog for ${sku}:`, updateError.message);
    // Non-critical - don't throw, just log
  } else {
    console.log(`[V4 Sync] Updated style_catalog for ${sku} with stockx_product_id=${productId}`);
  }
}

// ============================================================================
// Main Function: Full Sync Product by SKU
// ============================================================================

/**
 * Full sync: Fetch product, variants, and market data from StockX
 * - First time sync for new products
 * - Handles partial failures (continues if some sizes fail)
 * - Returns detailed SyncResult with counts and errors
 */
export async function fullSyncStockxProductBySku(
  sku: string
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    counts: { variantsSynced: 0, marketDataRefreshed: 0, priceSnapshotsInserted: 0, rateLimited: 0 },
    errors: [],
  };

  let currentStage: SyncError['stage'] = 'catalog_search';

  try {
    // 1. Catalog Search (CRITICAL)
    currentStage = 'catalog_search';
    const productId = await catalogSearch(sku);
    result.productId = productId;

    await sleep(RATE_LIMIT_MS);

    // 2. Product Details (CRITICAL)
    currentStage = 'product_details';
    const productRow = await fetchProductDetails(productId);
    await upsertProduct(productRow);

    // 2b. Auto-update style_catalog with stockx_product_id (if SKU exists in catalog)
    // This ensures the catalog is always up-to-date after a successful product sync
    await updateStyleCatalogWithStockxId(sku, productId, productRow);

    await sleep(RATE_LIMIT_MS);

    // 3. Variants (CRITICAL)
    currentStage = 'variants';
    const variantsResponse = await fetchProductVariants(productId);
    const variantRows = transformVariantsToRows(productId, variantsResponse);
    await upsertVariants(variantRows);

    const totalVariants = variantRows.length;
    result.counts.variantsSynced = totalVariants;

    // Guard: No variants = failure
    if (totalVariants === 0) {
      result.success = false;
      result.errors.push({
        stage: 'variants',
        error: 'Product has no variants',
      });
      return result;
    }

    // 4. Market Data (PARTIAL FAILURES OK)
    // Fetch currencies based on mode: BASELINE (GBP only) or FULL (GBP, EUR, USD)
    // PARALLEL with controlled concurrency (5 concurrent, staggered by RATE_LIMIT_MS)
    let gbpRefreshed = 0; // Track GBP specifically for success criteria
    const BATCH_SIZE = 5;
    const currenciesToFetch = getCurrenciesToFetch();

    for (let i = 0; i < variantRows.length; i += BATCH_SIZE) {
      const batch = variantRows.slice(i, i + BATCH_SIZE);

      // For each currency, fetch all variants in batch
      for (const currency of currenciesToFetch) {
        const batchResults = await Promise.allSettled(
          batch.map(async (variant, idx) => {
            // Stagger starts: 0ms, 1100ms, 2200ms, 3300ms, 4400ms
            await sleep(idx * RATE_LIMIT_MS);

            return getFreshMarketData(
              productId,
              variant.stockx_variant_id,
              currency,
              { forceRefresh: true, appendHistory: currency === 'GBP' }
            );
          })
        );

        // Process results
        batchResults.forEach((promiseResult, idx) => {
          const variant = batch[idx];
          if (promiseResult.status === 'fulfilled') {
            result.counts.marketDataRefreshed++;
            if (currency === 'GBP') {
              gbpRefreshed++;
              result.counts.priceSnapshotsInserted++;
            }
          } else {
            const errMsg = promiseResult.reason?.message ?? String(promiseResult.reason);
            const isRateLimited = errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit');

            if (isRateLimited) {
              result.counts.rateLimited++;
              console.warn(
                `[StockX RATE LIMITED] sku=${result.productId} variant=${variant.stockx_variant_id} size=${variant.variant_value} currency=${currency}`
              );
            }

            result.errors.push({
              variantId: variant.stockx_variant_id,
              size: variant.variant_value,
              stage: 'market_data',
              error: `[${currency}]${isRateLimited ? ' [RATE LIMITED]' : ''} ${errMsg}`,
            });
          }
        });
      }
    }

    // Log summary if any rate limits hit
    if (result.counts.rateLimited > 0) {
      console.warn(
        `[StockX SYNC] Rate limited ${result.counts.rateLimited}/${result.counts.marketDataRefreshed + result.counts.rateLimited} requests for product ${result.productId}`
      );
    }

    // Success criteria: Must sync GBP for at least 50% of variants
    // (GBP is primary currency, EUR/USD are supplementary)
    // Exception: If <4 variants, must sync all GBP
    const minRequired =
      totalVariants < 4 ? totalVariants : Math.ceil(totalVariants * 0.5);

    result.success = gbpRefreshed >= minRequired;
  } catch (err) {
    result.errors.push({
      stage: currentStage,
      error: (err as Error)?.message ?? String(err),
    });
  }

  return result;
}

// ============================================================================
// Function: Refresh Market Data for Existing Product
// ============================================================================

/**
 * Refresh market data for existing product
 * - Product/variants already exist (skip those API calls)
 * - Refresh prices for all variants
 * - Insert price history snapshots
 */
export async function refreshStockxProductByProductId(
  productId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    productId,
    counts: { variantsSynced: 0, marketDataRefreshed: 0, priceSnapshotsInserted: 0, rateLimited: 0 },
    errors: [],
  };

  try {
    // Load variants from database
    const variants = await loadVariantsForProduct(productId);
    result.counts.variantsSynced = variants.length;

    if (variants.length === 0) {
      result.errors.push({
        stage: 'variants',
        error: 'No variants found for product',
      });
      return result;
    }

    // Refresh market data for each variant
    // Fetch currencies based on mode: BASELINE (GBP only) or FULL (GBP, EUR, USD)
    // PARALLEL with controlled concurrency (5 concurrent, staggered by RATE_LIMIT_MS)
    let gbpRefreshed = 0; // Track GBP specifically for success criteria
    const BATCH_SIZE = 5;
    const currenciesToFetch = getCurrenciesToFetch();

    for (let i = 0; i < variants.length; i += BATCH_SIZE) {
      const batch = variants.slice(i, i + BATCH_SIZE);

      // For each currency, fetch all variants in batch
      for (const currency of currenciesToFetch) {
        const batchResults = await Promise.allSettled(
          batch.map(async (variant, idx) => {
            // Stagger starts: 0ms, 1100ms, 2200ms, 3300ms, 4400ms
            await sleep(idx * RATE_LIMIT_MS);

            return getFreshMarketData(
              productId,
              variant.stockx_variant_id,
              currency,
              { forceRefresh: true, appendHistory: currency === 'GBP' }
            );
          })
        );

        // Process results
        batchResults.forEach((promiseResult, idx) => {
          const variant = batch[idx];
          if (promiseResult.status === 'fulfilled') {
            result.counts.marketDataRefreshed++;
            if (currency === 'GBP') {
              gbpRefreshed++;
              result.counts.priceSnapshotsInserted++;
            }
          } else {
            const errMsg = promiseResult.reason?.message ?? String(promiseResult.reason);
            const isRateLimited = errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit');

            if (isRateLimited) {
              result.counts.rateLimited++;
              console.warn(
                `[StockX RATE LIMITED] productId=${productId} variant=${variant.stockx_variant_id} size=${variant.variant_value} currency=${currency}`
              );
            }

            result.errors.push({
              variantId: variant.stockx_variant_id,
              size: variant.variant_value,
              stage: 'market_data',
              error: `[${currency}]${isRateLimited ? ' [RATE LIMITED]' : ''} ${errMsg}`,
            });
          }
        });
      }
    }

    // Log summary if any rate limits hit
    if (result.counts.rateLimited > 0) {
      console.warn(
        `[StockX REFRESH] Rate limited ${result.counts.rateLimited}/${result.counts.marketDataRefreshed + result.counts.rateLimited} requests for product ${productId}`
      );
    }

    // Success criteria: Must sync GBP for at least 50% of variants
    // (GBP is primary currency, EUR/USD are supplementary)
    const minRequired =
      variants.length < 4 ? variants.length : Math.ceil(variants.length * 0.5);
    result.success = gbpRefreshed >= minRequired;
  } catch (err) {
    result.errors.push({
      stage: 'variants',
      error: (err as Error)?.message ?? String(err),
    });
  }

  return result;
}

// ============================================================================
// Smart Wrapper: Sync Product by SKU (decides sync vs refresh)
// ============================================================================

/**
 * Smart wrapper: Sync or refresh based on whether product exists
 * - Checks if product exists by SKU
 * - If not exists: Full sync
 * - If exists: Refresh market data
 */
export async function syncStockxProductBySku(sku: string): Promise<SyncResult> {
  const existing = await getProductBySku(sku);

  if (!existing) {
    // Product doesn't exist - full sync
    return fullSyncStockxProductBySku(sku);
  }

  // Product exists - refresh market data
  return refreshStockxProductByProductId(existing.productId);
}
