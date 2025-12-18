/**
 * Inventory V4 - Alias Sync Layer
 * Core sync functions for fetching and storing Alias data in V4 tables
 *
 * Architecture:
 * - Global catalog (products/variants shared across users)
 * - Multi-region support (UK → EU → US priority)
 * - Cache-first with 24hr TTL
 * - Historical price tracking
 * - Partial failure handling
 * - Adaptive rate limiting (monitor 429s)
 *
 * FOLLOWS STOCKX V4 PATTERN - DO NOT MODIFY ARCHITECTURE
 */

import { createClient as createServiceClient } from '@/lib/supabase/service';
import type {
  SyncResult,
  SyncError,
  AliasCatalogResponse,
  AliasAvailabilitiesResponse,
  AliasRecentSalesResponse,
  AliasProductRow,
  AliasVariantRow,
  AliasVariantWithId,
  AliasMarketDataRow,
  AliasPriceHistoryRow,
  AliasSalesHistoryRow,
  AliasAllowedSize,
  FreshMarketOptions,
  SyncOptions,
  MarketData,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const RATE_LIMIT_MS = 1000; // Start at 60 req/min (conservative)
const DEFAULT_REGIONS = ['3', '2', '1']; // UK → EU → US priority
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_TTL_HOURS = 24;
const ALIAS_BASE_URL = 'https://api.alias.org/api/v1';

// Retry config for 503/5xx errors
const RETRY_MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1000; // 1s base
const RETRY_MAX_DELAY_MS = 16000; // 16s max
const RETRY_JITTER_FACTOR = 0.2; // ±20% jitter

// ============================================================================
// Rate Limiting State (Adaptive)
// ============================================================================

let currentRateLimitMs = RATE_LIMIT_MS;
let consecutive429s = 0;

// ============================================================================
// Environment Variables
// ============================================================================

const ALIAS_PAT = process.env.ALIAS_PAT;
const ALIAS_RECENT_SALES_ENABLED = process.env.ALIAS_RECENT_SALES_ENABLED === 'true';

if (!ALIAS_PAT) {
  console.warn('⚠️  ALIAS_PAT not set - Alias sync will fail');
}

// ============================================================================
// Utility: Sleep for Rate Limiting
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Utility: Exponential Backoff with Jitter
// ============================================================================

function getRetryDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const baseDelay = Math.min(
    RETRY_BASE_DELAY_MS * Math.pow(2, attempt),
    RETRY_MAX_DELAY_MS
  );
  // Add jitter: ±20%
  const jitter = baseDelay * RETRY_JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.round(baseDelay + jitter);
}

function isRetryableError(status: number): boolean {
  // Retry on 503 (Service Unavailable), 502 (Bad Gateway), 504 (Gateway Timeout)
  return status === 503 || status === 502 || status === 504;
}

// ============================================================================
// Utility: Convert STRING Cents to NUMERIC Major Units
// ============================================================================

/**
 * Convert Alias price string (cents) to numeric (major units)
 * Alias returns prices as STRINGS in CENTS
 * Example: "14500" → 145.00 (NOT £14500)
 */
function convertCentsToMajor(centsString: string | null | undefined): number | null {
  if (!centsString || centsString === '0') return null;
  const parsed = parseFloat(centsString);
  if (isNaN(parsed)) return null;
  return parsed / 100; // Convert cents to major units
}

/**
 * Convert cents string to integer (for retail prices stored as cents)
 */
function convertCentsToInt(centsString: string | null | undefined): number | null {
  if (!centsString || centsString === '0') return null;
  const parsed = parseInt(centsString, 10);
  return isNaN(parsed) ? null : parsed;
}

// ============================================================================
// Utility: Parse Size to Numeric
// ============================================================================

function parseSizeToNumeric(sizeString: string): number {
  const parsed = parseFloat(sizeString);
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================================================
// API: Fetch from Alias with Adaptive Rate Limiting + 503 Retry
// ============================================================================

async function fetchAlias<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${ALIAS_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${ALIAS_PAT}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        // Handle rate limiting (429)
        if (response.status === 429) {
          consecutive429s++;
          currentRateLimitMs = Math.min(currentRateLimitMs * 1.5, 5000);
          console.warn(
            `⚠️  Rate limited (429). Slowing to ${(60000 / currentRateLimitMs).toFixed(1)} req/min`
          );
          await sleep(currentRateLimitMs * 2);
          // Don't count 429 as retry attempt - just slow down
          attempt--;
          continue;
        }

        // Handle retryable 5xx errors (503, 502, 504)
        if (isRetryableError(response.status)) {
          const delay = getRetryDelay(attempt);
          console.warn(
            `⚠️  Alias API ${response.status} (attempt ${attempt + 1}/${RETRY_MAX_ATTEMPTS}). Retrying in ${delay}ms...`
          );
          lastError = new Error(`Alias API error: ${response.status} ${response.statusText}`);
          await sleep(delay);
          continue;
        }

        // Non-retryable error
        throw new Error(`Alias API error: ${response.status} ${response.statusText}`);
      }

      // Success
      consecutive429s = 0;
      return response.json();
    } catch (error) {
      // Network error - treat as retryable
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const delay = getRetryDelay(attempt);
        console.warn(
          `⚠️  Network error (attempt ${attempt + 1}/${RETRY_MAX_ATTEMPTS}). Retrying in ${delay}ms...`
        );
        lastError = error;
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }

  // All retries exhausted
  throw lastError || new Error(`Alias API failed after ${RETRY_MAX_ATTEMPTS} attempts`);
}

// ============================================================================
// Database: Check if Product Exists by Catalog ID
// ============================================================================

async function getProductByCatalogId(
  catalogId: string
): Promise<{ catalogId: string; updatedAt: string } | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, updated_at')
    .eq('alias_catalog_id', catalogId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    catalogId: data.alias_catalog_id,
    updatedAt: data.updated_at || new Date(0).toISOString(),
  };
}

// ============================================================================
// Database: UPSERT Product
// ============================================================================

async function upsertProduct(product: AliasProductRow): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('inventory_v4_alias_products')
    .upsert(product, {
      onConflict: 'alias_catalog_id',
    });

  if (error) {
    throw new Error(`Failed to upsert product: ${error.message}`);
  }
}

// ============================================================================
// Database: UPSERT Variants (Bulk)
// ============================================================================

async function upsertVariants(variants: AliasVariantRow[]): Promise<AliasVariantWithId[]> {
  if (variants.length === 0) return [];

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('inventory_v4_alias_variants')
    .upsert(variants, {
      onConflict: 'alias_catalog_id,size_value,consigned,region_id',
    })
    .select('*');

  if (error) {
    throw new Error(`Failed to upsert variants: ${error.message}`);
  }

  return (data || []) as AliasVariantWithId[];
}

// ============================================================================
// Database: UPSERT Market Data
// ============================================================================

async function upsertMarketData(marketData: AliasMarketDataRow): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('inventory_v4_alias_market_data')
    .upsert(marketData, {
      onConflict: 'alias_variant_id',
    });

  if (error) {
    throw new Error(`Failed to upsert market data: ${error.message}`);
  }
}

// ============================================================================
// Database: INSERT Price History
// ============================================================================

async function insertPriceHistory(history: AliasPriceHistoryRow): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('inventory_v4_alias_price_history')
    .insert(history);

  if (error) {
    throw new Error(`Failed to insert price history: ${error.message}`);
  }
}

// ============================================================================
// Database: INSERT Sales History (Bulk) - Idempotent via UPSERT + ignoreDuplicates
// ============================================================================

async function insertSalesHistory(sales: AliasSalesHistoryRow[]): Promise<void> {
  if (sales.length === 0) return;

  const supabase = createServiceClient();

  // Use upsert with ignoreDuplicates to achieve ON CONFLICT DO NOTHING behavior.
  // Natural key: (alias_catalog_id, size_value, price, purchased_at)
  // Requires UNIQUE constraint on these columns to work correctly.
  const { error } = await supabase
    .from('inventory_v4_alias_sales_history')
    .upsert(sales, {
      onConflict: 'alias_catalog_id,size_value,price,purchased_at',
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(`Failed to insert sales history: ${error.message}`);
  }
}

// ============================================================================
// Database: UPDATE Market Data Sales Volume
// ============================================================================

async function updateMarketDataSalesVolume(
  variantId: string,
  sales72h: number,
  sales30d: number
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('inventory_v4_alias_market_data')
    .update({
      sales_last_72h: sales72h,
      sales_last_30d: sales30d,
      updated_at: new Date().toISOString(),
    })
    .eq('alias_variant_id', variantId);

  if (error) {
    throw new Error(`Failed to update sales volume: ${error.message}`);
  }
}

// ============================================================================
// Helper: Calculate Sales Volume from Recent Sales Response
// ============================================================================

function calculateSalesVolume(
  recentSales: AliasRecentSalesResponse['recent_sales'],
  consignedFilter?: boolean
): { sales72h: number; sales30d: number } {
  const now = Date.now();
  const MS_72H = 72 * 60 * 60 * 1000;
  const MS_30D = 30 * 24 * 60 * 60 * 1000;

  let sales72h = 0;
  let sales30d = 0;

  for (const sale of recentSales) {
    // Filter by consigned state if specified
    if (consignedFilter !== undefined && sale.consigned !== consignedFilter) {
      continue;
    }

    const saleTime = new Date(sale.purchased_at).getTime();
    const ageMs = now - saleTime;

    if (ageMs <= MS_72H) {
      sales72h++;
      sales30d++;
    } else if (ageMs <= MS_30D) {
      sales30d++;
    }
  }

  return { sales72h, sales30d };
}

// ============================================================================
// Database: Get Cached Market Data
// ============================================================================

async function getCachedMarketData(
  variantId: string,
  ttlHours: number
): Promise<AliasMarketDataRow | null> {
  const supabase = createServiceClient();

  const ttlDate = new Date(Date.now() - ttlHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('*')
    .eq('alias_variant_id', variantId)
    .gte('updated_at', ttlDate)
    .single();

  if (error || !data) {
    return null;
  }

  return data as AliasMarketDataRow;
}

// ============================================================================
// Database: Load Variants for Product
// ============================================================================

async function loadVariantsForProduct(catalogId: string): Promise<AliasVariantWithId[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('inventory_v4_alias_variants')
    .select('*')
    .eq('alias_catalog_id', catalogId);

  if (error) {
    throw new Error(`Failed to load variants: ${error.message}`);
  }

  return (data || []) as AliasVariantWithId[];
}

// ============================================================================
// API: Fetch Catalog
// ============================================================================

async function fetchCatalog(catalogId: string): Promise<AliasCatalogResponse> {
  const response = await fetchAlias<AliasCatalogResponse>(`/catalog/${catalogId}`);

  if (!response?.catalog_item?.catalog_id) {
    throw new Error(`Invalid catalog response for ${catalogId}`);
  }

  return response;
}

// ============================================================================
// API: Fetch Availabilities for Region (with optional consigned filter)
// ============================================================================

async function fetchAvailabilities(
  catalogId: string,
  regionId: string,
  consigned?: boolean
): Promise<AliasAvailabilitiesResponse> {
  const params: Record<string, string> = { region_id: regionId };

  // Add consigned parameter if specified
  if (consigned !== undefined) {
    params.consigned = String(consigned);
  }

  const response = await fetchAlias<AliasAvailabilitiesResponse>(
    `/pricing_insights/availabilities/${catalogId}`,
    params
  );

  return response;
}

// ============================================================================
// API: Fetch Recent Sales (Optional)
// ============================================================================

async function fetchRecentSales(
  catalogId: string,
  size: string,
  regionId: string
): Promise<AliasRecentSalesResponse> {
  if (!ALIAS_RECENT_SALES_ENABLED) {
    return { recent_sales: [] };
  }

  // Note: catalog_id is a query parameter, not path parameter
  // Filter to NEW condition + GOOD packaging to match our market data
  const response = await fetchAlias<AliasRecentSalesResponse>(
    `/pricing_insights/recent_sales`,
    {
      catalog_id: catalogId,
      size,
      region_id: regionId,
      product_condition: 'PRODUCT_CONDITION_NEW',
      packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
      limit: '200', // Max allowed when all filters provided
    }
  );

  return response;
}

// ============================================================================
// Transform: Catalog to Product Row
// ============================================================================

function transformCatalogToRow(response: AliasCatalogResponse): AliasProductRow {
  const item = response.catalog_item;

  return {
    alias_catalog_id: item.catalog_id,
    brand: item.brand,
    name: item.name,
    nickname: item.nickname || null,
    sku: item.sku,
    colorway: item.colorway || null,
    gender: item.gender || null,
    product_category: item.product_category,
    product_type: item.product_type,
    release_date: item.release_date || null,
    retail_price_cents: convertCentsToInt(item.retail_price_cents),
    size_unit: item.size_unit,
    allowed_sizes: item.allowed_sizes || [],
    minimum_listing_price_cents: convertCentsToInt(item.minimum_listing_price_cents),
    maximum_listing_price_cents: convertCentsToInt(item.maximum_listing_price_cents),
    main_picture_url: item.main_picture_url || null,
    requested_pictures: item.requested_pictures || [],
    requires_listing_pictures: item.requires_listing_pictures || false,
    resellable: item.resellable !== false,
  };
}

// ============================================================================
// Transform: Availabilities to Variant Rows
// ============================================================================

/**
 * Transform API availabilities to variant rows
 *
 * IMPORTANT: Only syncs sizes that are in the product's allowed_sizes.
 * This prevents storing invalid sizes (e.g., 0.5, 1, 40) that the platform
 * says don't exist for this product but may appear in legacy API data.
 *
 * @param allowedSizes - Set of valid size values from product.allowed_sizes
 */
function transformAvailabilitiesToVariantRows(
  catalogId: string,
  regionId: string,
  sizeUnit: string,
  variants: AliasAvailabilitiesResponse['variants'],
  allowedSizes: Set<number>
): AliasVariantRow[] {
  // Count NEW + GOOD_CONDITION variants before allowed_sizes filter
  const newGoodVariants = variants.filter(
    (v) =>
      v.product_condition === 'PRODUCT_CONDITION_NEW' &&
      v.packaging_condition === 'PACKAGING_CONDITION_GOOD_CONDITION'
  );

  // Filter to NEW + GOOD_CONDITION only, AND size must be in allowed_sizes
  const filtered = newGoodVariants.filter((v) => {
    const sizeValue = parseSizeToNumeric(v.size);
    return allowedSizes.has(sizeValue);
  });

  // Log size filtering stats
  const droppedCount = newGoodVariants.length - filtered.length;
  if (droppedCount > 0) {
    const droppedSizes = newGoodVariants
      .filter((v) => !allowedSizes.has(parseSizeToNumeric(v.size)))
      .map((v) => v.size);
    console.log(
      `  [Alias Size Filter] region=${regionId}: kept ${filtered.length}/${newGoodVariants.length}, dropped ${droppedCount} invalid sizes: ${droppedSizes.slice(0, 10).join(', ')}${droppedSizes.length > 10 ? '...' : ''}`
    );
  }

  return filtered.map((v) => ({
    alias_catalog_id: catalogId,
    size_value: parseSizeToNumeric(v.size),
    size_display: v.size,
    size_unit: sizeUnit,
    consigned: v.consigned || false,
    region_id: regionId,
  }));
}

// ============================================================================
// Transform: Availabilities to Market Data Rows
// ============================================================================

/**
 * Check if a variant has ANY actionable market data (at least one non-null price)
 * This filters out sizes with no market activity (e.g., infant sizes with "0" for all prices)
 */
function hasActionableMarketData(availability: {
  lowest_listing_price_cents?: string;
  highest_offer_price_cents?: string;
  last_sold_listing_price_cents?: string;
} | undefined): boolean {
  if (!availability) return false;

  // Check if at least ONE price is non-zero
  const ask = availability.lowest_listing_price_cents;
  const bid = availability.highest_offer_price_cents;
  const last = availability.last_sold_listing_price_cents;

  return (
    (ask !== undefined && ask !== null && ask !== '0') ||
    (bid !== undefined && bid !== null && bid !== '0') ||
    (last !== undefined && last !== null && last !== '0')
  );
}

/**
 * Transform API availabilities to market data rows
 *
 * IMPORTANT: Only creates rows for variants with ACTIONABLE market data
 * (at least one of: ask, bid, or last sale). This filters out infant/toddler
 * sizes and other variants with no market activity.
 *
 * @param allowedSizes - Set of valid size values (same filter as variants)
 */
function transformAvailabilitiesToMarketData(
  variantMap: Map<string, string>, // key: size_consigned_region → variant_id
  apiVariants: AliasAvailabilitiesResponse['variants'],
  regionId: string,
  allowedSizes: Set<number>
): AliasMarketDataRow[] {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_HOURS * 60 * 60 * 1000).toISOString();

  // Filter to:
  // 1. NEW + GOOD_CONDITION only
  // 2. Size must be in allowed_sizes
  // 3. Must have at least ONE actionable price (ask, bid, or last sale)
  const filtered = apiVariants.filter((v) => {
    const sizeValue = parseSizeToNumeric(v.size);
    return (
      v.product_condition === 'PRODUCT_CONDITION_NEW' &&
      v.packaging_condition === 'PACKAGING_CONDITION_GOOD_CONDITION' &&
      allowedSizes.has(sizeValue) &&
      hasActionableMarketData(v.availability)
    );
  });

  return filtered
    .map((v) => {
      const key = `${parseSizeToNumeric(v.size)}_${v.consigned || false}_${regionId}`;
      const variantId = variantMap.get(key);

      if (!variantId) {
        // This shouldn't happen now since we filter by allowed_sizes
        // but keep the guard just in case
        return null;
      }

      return {
        alias_variant_id: variantId,
        lowest_ask: convertCentsToMajor(v.availability?.lowest_listing_price_cents),
        highest_bid: convertCentsToMajor(v.availability?.highest_offer_price_cents),
        last_sale_price: convertCentsToMajor(v.availability?.last_sold_listing_price_cents),
        global_indicator_price: convertCentsToMajor(v.availability?.global_indicator_price_cents),
        currency_code: DEFAULT_CURRENCY,
        ask_count: null, // Not available in Alias API
        bid_count: null, // Not available in Alias API
        sales_last_72h: null, // Populated separately via recent_sales
        sales_last_30d: null, // Populated separately via recent_sales
        total_sales_volume: null,
        updated_at: now,
        expires_at: expiresAt,
      };
    })
    .filter(Boolean) as AliasMarketDataRow[];
}

// ============================================================================
// Transform: Recent Sales to Sales History Rows
// ============================================================================

function transformRecentSalesToRows(
  catalogId: string,
  regionId: string,
  sales: AliasRecentSalesResponse['recent_sales']
): AliasSalesHistoryRow[] {
  return sales.map((s) => ({
    alias_catalog_id: catalogId,
    size_value: parseSizeToNumeric(s.size),
    price: convertCentsToMajor(s.price_cents) || 0,
    purchased_at: s.purchased_at,
    consigned: s.consigned || false,
    region_id: regionId,
    currency_code: DEFAULT_CURRENCY,
  }));
}

// ============================================================================
// Core Function: Get Fresh Market Data (with cache + history)
// ============================================================================

/**
 * Fetch market data with cache-first strategy
 * NOTE: For Alias, we fetch market data in bulk via availabilities endpoint
 * This function is mainly for compatibility with StockX pattern
 */
export async function getFreshMarketDataForVariant(
  catalogId: string,
  variantId: string,
  size: string,
  regionId: string,
  consigned: boolean,
  options: FreshMarketOptions = {}
): Promise<MarketData> {
  const {
    forceRefresh = false,
    ttlHours = DEFAULT_TTL_HOURS,
    appendHistory = true,
  } = options;

  // 1. Check cache (unless forceRefresh)
  if (!forceRefresh) {
    const cached = await getCachedMarketData(variantId, ttlHours);
    if (cached) {
      return { cached: true, data: cached };
    }
  }

  // 2. Fetch from API
  // NOTE: Alias doesn't have per-variant endpoints, so we fetch all availabilities
  const availabilities = await fetchAvailabilities(catalogId, regionId, consigned);

  // Find the variant in the response
  const variant = availabilities.variants.find(
    (v) =>
      v.size === size &&
      (v.consigned || false) === consigned &&
      v.product_condition === 'PRODUCT_CONDITION_NEW' &&
      v.packaging_condition === 'PACKAGING_CONDITION_GOOD_CONDITION'
  );

  if (!variant?.availability) {
    throw new Error(`No availability data for size ${size}, consigned=${consigned}, region=${regionId}`);
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const marketDataRow: AliasMarketDataRow = {
    alias_variant_id: variantId,
    lowest_ask: convertCentsToMajor(variant.availability.lowest_listing_price_cents),
    highest_bid: convertCentsToMajor(variant.availability.highest_offer_price_cents),
    last_sale_price: convertCentsToMajor(variant.availability.last_sold_listing_price_cents),
    global_indicator_price: convertCentsToMajor(variant.availability.global_indicator_price_cents),
    currency_code: DEFAULT_CURRENCY,
    ask_count: null,
    bid_count: null,
    sales_last_72h: null,
    sales_last_30d: null,
    total_sales_volume: null,
    updated_at: now,
    expires_at: expiresAt,
  };

  // 3. UPSERT market_data
  await upsertMarketData(marketDataRow);

  // 4. INSERT price_history (if enabled)
  if (appendHistory) {
    const historyRow: AliasPriceHistoryRow = {
      alias_variant_id: variantId,
      currency_code: DEFAULT_CURRENCY,
      lowest_ask: marketDataRow.lowest_ask,
      highest_bid: marketDataRow.highest_bid,
      last_sale_price: marketDataRow.last_sale_price,
      global_indicator_price: marketDataRow.global_indicator_price,
    };
    await insertPriceHistory(historyRow);
  }

  return { cached: false, data: marketDataRow };
}

// ============================================================================
// Database: Auto-Update Style Catalog with Alias Catalog ID
// ============================================================================

/**
 * Automatically update inventory_v4_style_catalog with Alias product details
 * Called after successful product sync to ensure catalog is always up-to-date
 *
 * Updates:
 * - alias_catalog_id (links to inventory_v4_alias_products)
 * - Optionally: primary_image_url, brand, name if missing
 */
async function updateStyleCatalogWithAliasId(
  sku: string,
  catalogId: string,
  productRow: AliasProductRow
): Promise<void> {
  const supabase = createServiceClient();

  // Check if SKU exists in style catalog
  const { data: existing, error: fetchError } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, alias_catalog_id, primary_image_url, brand, name')
    .eq('style_id', sku)
    .single();

  if (fetchError || !existing) {
    // SKU not in style catalog - that's okay, might be a manual search
    console.log(`[V4 Alias Sync] SKU ${sku} not in style_catalog, skipping catalog update`);
    return;
  }

  // Build update payload - always update alias_catalog_id
  const updatePayload: Record<string, unknown> = {
    alias_catalog_id: catalogId,
  };

  // Fill in missing metadata if not already set
  if (!existing.primary_image_url && productRow.main_picture_url) {
    updatePayload.primary_image_url = productRow.main_picture_url;
  }
  if (!existing.brand && productRow.brand) {
    updatePayload.brand = productRow.brand;
  }
  if (!existing.name && productRow.name) {
    updatePayload.name = productRow.name;
  }

  // Update the catalog
  const { error: updateError } = await supabase
    .from('inventory_v4_style_catalog')
    .update(updatePayload)
    .eq('style_id', sku);

  if (updateError) {
    console.error(`[V4 Alias Sync] Failed to update style_catalog for ${sku}:`, updateError.message);
    // Non-critical - don't throw, just log
  } else {
    console.log(`[V4 Alias Sync] Updated style_catalog for ${sku} with alias_catalog_id=${catalogId}`);
  }
}

// ============================================================================
// Main Function: Full Sync Product by Catalog ID
// ============================================================================

/**
 * Full sync: Fetch product, variants (multi-region), and market data from Alias
 * - First time sync for new products
 * - Multi-region support (UK → EU → US)
 * - Handles partial failures (continues if some regions fail)
 * - Returns detailed SyncResult with counts and errors
 */
export async function fullSyncAliasProductByCatalogId(
  catalogId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const {
    regions = DEFAULT_REGIONS,
    forceRefresh = true,
    fetchSales = ALIAS_RECENT_SALES_ENABLED, // Auto-enable when env var is set
  } = options;

  const result: SyncResult = {
    success: false,
    catalogId,
    counts: {
      variantsSynced: 0,
      marketDataRefreshed: 0,
      priceSnapshotsInserted: 0,
      salesRecordsInserted: 0,
    },
    errors: [],
  };

  let currentStage: SyncError['stage'] = 'catalog_fetch';

  try {
    // ========================================================================
    // 1. Fetch Catalog (CRITICAL)
    // ========================================================================
    currentStage = 'catalog_fetch';
    const catalogResponse = await fetchCatalog(catalogId);
    const productRow = transformCatalogToRow(catalogResponse);
    await upsertProduct(productRow);

    // 1b. Auto-update style_catalog with alias_catalog_id (if SKU exists in catalog)
    // This ensures the catalog is always up-to-date after a successful product sync
    if (productRow.sku) {
      await updateStyleCatalogWithAliasId(productRow.sku, catalogId, productRow);
    }

    await sleep(currentRateLimitMs);

    // ========================================================================
    // 2. Fetch Availabilities for Each Region × Consigned State (CRITICAL)
    // ========================================================================
    // NOTE: Must fetch BOTH consigned=false and consigned=true separately
    // API requires explicit consigned parameter to get both types
    currentStage = 'availabilities';
    const allVariantRows: AliasVariantRow[] = [];
    const allApiVariants: Array<{ regionId: string; variants: AliasAvailabilitiesResponse['variants'] }> = [];

    // Build allowed sizes Set from product's allowed_sizes
    // This filters out invalid sizes (e.g., 0.5, 1, 40) that shouldn't exist for this product
    const allowedSizes = new Set<number>(
      (productRow.allowed_sizes || []).map((s: AliasAllowedSize) => s.value)
    );

    for (const regionId of regions) {
      try {
        // Fetch BOTH consigned states in parallel for this region
        const [nonConsignedData, consignedData] = await Promise.all([
          fetchAvailabilities(catalogId, regionId, false), // Non-consigned
          fetchAvailabilities(catalogId, regionId, true),  // Consigned
        ]);

        // Transform non-consigned variants (filtered by allowed_sizes)
        const nonConsignedRows = transformAvailabilitiesToVariantRows(
          catalogId,
          regionId,
          productRow.size_unit,
          nonConsignedData.variants,
          allowedSizes
        );

        // Transform consigned variants (filtered by allowed_sizes)
        const consignedRows = transformAvailabilitiesToVariantRows(
          catalogId,
          regionId,
          productRow.size_unit,
          consignedData.variants,
          allowedSizes
        );

        allVariantRows.push(...nonConsignedRows, ...consignedRows);
        allApiVariants.push(
          { regionId, variants: nonConsignedData.variants },
          { regionId, variants: consignedData.variants }
        );

        await sleep(currentRateLimitMs);
      } catch (err) {
        result.errors.push({
          region: regionId,
          stage: 'availabilities',
          error: (err as Error)?.message ?? String(err),
        });
      }
    }

    // ========================================================================
    // 3. UPSERT Variants (CRITICAL)
    // ========================================================================
    currentStage = 'variants';
    if (allVariantRows.length === 0) {
      result.success = false;
      result.errors.push({
        stage: 'variants',
        error: 'No variants found across all regions',
      });
      return result;
    }

    const insertedVariants = await upsertVariants(allVariantRows);
    result.counts.variantsSynced = insertedVariants.length;

    // ========================================================================
    // 4. Create Variant Lookup Map
    // ========================================================================
    // Map: size_consigned_region → variant_id
    const variantMap = new Map<string, string>(
      insertedVariants.map((v) => [
        `${v.size_value}_${v.consigned}_${v.region_id}`,
        v.id,
      ])
    );

    // ========================================================================
    // 5. UPSERT Market Data (PARTIAL FAILURES OK)
    // ========================================================================
    currentStage = 'market_data';
    for (const { regionId, variants } of allApiVariants) {
      try {
        const marketDataRows = transformAvailabilitiesToMarketData(
          variantMap,
          variants,
          regionId,
          allowedSizes
        );

        for (const row of marketDataRows) {
          try {
            await upsertMarketData(row);
            result.counts.marketDataRefreshed++;

            // Insert price history snapshot
            const historyRow: AliasPriceHistoryRow = {
              alias_variant_id: row.alias_variant_id,
              currency_code: row.currency_code,
              lowest_ask: row.lowest_ask,
              highest_bid: row.highest_bid,
              last_sale_price: row.last_sale_price,
              global_indicator_price: row.global_indicator_price,
            };
            await insertPriceHistory(historyRow);
            result.counts.priceSnapshotsInserted++;
          } catch (err) {
            result.errors.push({
              variantId: row.alias_variant_id,
              region: regionId,
              stage: 'market_data',
              error: (err as Error)?.message ?? String(err),
            });
          }
        }
      } catch (err) {
        result.errors.push({
          region: regionId,
          stage: 'market_data',
          error: (err as Error)?.message ?? String(err),
        });
      }
    }

    // ========================================================================
    // 6. Fetch Sales Volume (OPTIONAL - per-size API calls)
    // ========================================================================
    if (fetchSales && ALIAS_RECENT_SALES_ENABLED) {
      currentStage = 'sales_history';

      // Get unique size × region combinations from variants
      const sizeRegionPairs = new Set<string>();
      for (const v of insertedVariants) {
        // Use size_display for API call (string like "10", "10.5")
        sizeRegionPairs.add(`${v.size_display}|${v.region_id}`);
      }

      // Fetch recent_sales for each unique size × region
      for (const pair of sizeRegionPairs) {
        const [size, regionId] = pair.split('|');
        try {
          const salesResponse = await fetchRecentSales(catalogId, size, regionId);
          await sleep(currentRateLimitMs); // Rate limit between calls

          if (salesResponse.recent_sales.length > 0) {
            // Calculate volume for non-consigned
            const nonConsignedVolume = calculateSalesVolume(salesResponse.recent_sales, false);
            // Calculate volume for consigned
            const consignedVolume = calculateSalesVolume(salesResponse.recent_sales, true);

            // Store sales history records
            const salesRows = transformRecentSalesToRows(catalogId, regionId, salesResponse.recent_sales);
            if (salesRows.length > 0) {
              try {
                await insertSalesHistory(salesRows);
                result.counts.salesRecordsInserted += salesRows.length;
              } catch {
                // Duplicate insert is fine - just skip
              }
            }

            // Update market_data for all matching variants
            for (const v of insertedVariants) {
              if (v.size_display === size && v.region_id === regionId) {
                const volume = v.consigned ? consignedVolume : nonConsignedVolume;
                try {
                  await updateMarketDataSalesVolume(v.id, volume.sales72h, volume.sales30d);
                } catch (err) {
                  result.errors.push({
                    variantId: v.id,
                    size,
                    region: regionId,
                    stage: 'sales_history',
                    error: (err as Error)?.message ?? String(err),
                  });
                }
              }
            }
          }
        } catch (err) {
          result.errors.push({
            size,
            region: regionId,
            stage: 'sales_history',
            error: (err as Error)?.message ?? String(err),
          });
        }
      }
    }

    // ========================================================================
    // 7. Success Criteria
    // ========================================================================
    // Must sync at least 50% of market data
    // Exception: If <4 variants, must sync all
    const totalVariants = insertedVariants.length;
    const minRequired = totalVariants < 4 ? totalVariants : Math.ceil(totalVariants * 0.5);

    result.success = result.counts.marketDataRefreshed >= minRequired;
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
 * - Product/variants already exist (skip catalog fetch)
 * - Refresh prices for all variants across all regions
 * - Insert price history snapshots
 */
export async function refreshAliasProductByCatalogId(
  catalogId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const {
    regions = DEFAULT_REGIONS,
    fetchSales = ALIAS_RECENT_SALES_ENABLED, // Auto-enable when env var is set
  } = options;

  const result: SyncResult = {
    success: false,
    catalogId,
    counts: {
      variantsSynced: 0,
      marketDataRefreshed: 0,
      priceSnapshotsInserted: 0,
      salesRecordsInserted: 0,
    },
    errors: [],
  };

  try {
    // ========================================================================
    // 1. Load Product and Variants from Database
    // ========================================================================
    const supabase = createServiceClient();
    const { data: product } = await supabase
      .from('inventory_v4_alias_products')
      .select('allowed_sizes')
      .eq('alias_catalog_id', catalogId)
      .single();

    const variants = await loadVariantsForProduct(catalogId);
    result.counts.variantsSynced = variants.length;

    if (variants.length === 0) {
      result.errors.push({
        stage: 'variants',
        error: 'No variants found for product',
      });
      return result;
    }

    // Build allowed sizes Set from product's allowed_sizes
    const allowedSizes = new Set<number>(
      (product?.allowed_sizes || []).map((s: AliasAllowedSize) => s.value)
    );

    // ========================================================================
    // 2. Create Variant Lookup Map
    // ========================================================================
    const variantMap = new Map<string, string>(
      variants.map((v) => [
        `${v.size_value}_${v.consigned}_${v.region_id}`,
        v.id,
      ])
    );

    // ========================================================================
    // 3. Fetch Availabilities for Each Region × Consigned State
    // ========================================================================
    for (const regionId of regions) {
      try {
        // Fetch BOTH consigned states in parallel for this region
        const [nonConsignedData, consignedData] = await Promise.all([
          fetchAvailabilities(catalogId, regionId, false), // Non-consigned
          fetchAvailabilities(catalogId, regionId, true),  // Consigned
        ]);

        // Combine both responses for this region
        const allApiVariants = [
          ...nonConsignedData.variants,
          ...consignedData.variants,
        ];

        // Transform to market data rows for this region (filtered by allowed_sizes)
        const marketDataRows = transformAvailabilitiesToMarketData(
          variantMap,
          allApiVariants,
          regionId,
          allowedSizes
        );

        // UPSERT market data + INSERT price history
        for (const row of marketDataRows) {
          try {
            await upsertMarketData(row);
            result.counts.marketDataRefreshed++;

            const historyRow: AliasPriceHistoryRow = {
              alias_variant_id: row.alias_variant_id,
              currency_code: row.currency_code,
              lowest_ask: row.lowest_ask,
              highest_bid: row.highest_bid,
              last_sale_price: row.last_sale_price,
              global_indicator_price: row.global_indicator_price,
            };
            await insertPriceHistory(historyRow);
            result.counts.priceSnapshotsInserted++;
          } catch (err) {
            result.errors.push({
              variantId: row.alias_variant_id,
              region: regionId,
              stage: 'market_data',
              error: (err as Error)?.message ?? String(err),
            });
          }
        }

        await sleep(currentRateLimitMs);
      } catch (err) {
        result.errors.push({
          region: regionId,
          stage: 'availabilities',
          error: (err as Error)?.message ?? String(err),
        });
      }
    }

    // ========================================================================
    // 4. Fetch Sales Volume (OPTIONAL - per-size API calls)
    // ========================================================================
    if (fetchSales && ALIAS_RECENT_SALES_ENABLED) {
      // Get unique size × region combinations from variants
      const sizeRegionPairs = new Set<string>();
      for (const v of variants) {
        sizeRegionPairs.add(`${v.size_display}|${v.region_id}`);
      }

      // Fetch recent_sales for each unique size × region
      for (const pair of sizeRegionPairs) {
        const [size, regionId] = pair.split('|');
        try {
          const salesResponse = await fetchRecentSales(catalogId, size, regionId);
          await sleep(currentRateLimitMs);

          if (salesResponse.recent_sales.length > 0) {
            // Calculate volume for non-consigned
            const nonConsignedVolume = calculateSalesVolume(salesResponse.recent_sales, false);
            // Calculate volume for consigned
            const consignedVolume = calculateSalesVolume(salesResponse.recent_sales, true);

            // Store sales history records
            const salesRows = transformRecentSalesToRows(catalogId, regionId, salesResponse.recent_sales);
            if (salesRows.length > 0) {
              try {
                await insertSalesHistory(salesRows);
                result.counts.salesRecordsInserted += salesRows.length;
              } catch {
                // Duplicate insert is fine - just skip
              }
            }

            // Update market_data for all matching variants
            for (const v of variants) {
              if (v.size_display === size && v.region_id === regionId) {
                const volume = v.consigned ? consignedVolume : nonConsignedVolume;
                try {
                  await updateMarketDataSalesVolume(v.id, volume.sales72h, volume.sales30d);
                } catch (err) {
                  result.errors.push({
                    variantId: v.id,
                    size,
                    region: regionId,
                    stage: 'sales_history',
                    error: (err as Error)?.message ?? String(err),
                  });
                }
              }
            }
          }
        } catch (err) {
          result.errors.push({
            size,
            region: regionId,
            stage: 'sales_history',
            error: (err as Error)?.message ?? String(err),
          });
        }
      }
    }

    // ========================================================================
    // 5. Success Criteria
    // ========================================================================
    const minRequired = variants.length < 4 ? variants.length : Math.ceil(variants.length * 0.5);
    result.success = result.counts.marketDataRefreshed >= minRequired;
  } catch (err) {
    result.errors.push({
      stage: 'variants',
      error: (err as Error)?.message ?? String(err),
    });
  }

  return result;
}

// ============================================================================
// Smart Wrapper: Sync Product by Catalog ID (decides sync vs refresh)
// ============================================================================

/**
 * Smart wrapper: Sync or refresh based on whether product exists
 * - Checks if product exists by catalog_id
 * - If not exists: Full sync
 * - If exists: Refresh market data
 */
export async function syncAliasProductByCatalogId(
  catalogId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const existing = await getProductByCatalogId(catalogId);

  if (!existing) {
    // Product doesn't exist - full sync
    return fullSyncAliasProductByCatalogId(catalogId, options);
  }

  // Product exists - refresh market data
  return refreshAliasProductByCatalogId(catalogId, options);
}
