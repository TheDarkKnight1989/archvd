/**
 * Alias Market Data Sync Service
 * Fetch and store market pricing data from Alias API
 */

import { createClient as createServiceClient } from '@/lib/supabase/service';
import { AliasClient } from './client';
import type { AliasPricingVariant, ProductCondition, PackagingCondition } from './types';
import { ingestAliasAvailabilities, ingestAliasRecentSales } from '../ingestion/alias-mapper';

export interface SyncResult {
  success: boolean;
  catalogId: string;
  size?: number;
  variantsSynced?: number;
  error?: string;
}

export interface BulkSyncResult {
  totalItems: number;
  successCount: number;
  errorCount: number;
  results: SyncResult[];
}

/**
 * LOCKED: Standard Alias pricing parameters
 * Always use NEW + GOOD_CONDITION, no consigned
 * DO NOT add options to override these - they are intentionally locked
 */
export const STANDARD_ALIAS_PRICING_CONDITIONS = {
  product_condition: 'PRODUCT_CONDITION_NEW' as ProductCondition,
  packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION' as PackagingCondition,
  // consigned is OMITTED (not false, not true - simply not included)
} as const;

/**
 * Helper: Get standard pricing params for Alias API
 * LOCKED to NEW + GOOD_CONDITION only
 */
export function getStandardAliasPricingParams(
  catalogId: string,
  size: number,
  regionId?: string
): {
  catalog_id: string;
  size: number;
  product_condition: ProductCondition;
  packaging_condition: PackagingCondition;
  region_id?: string;
} {
  const params: any = {
    catalog_id: catalogId,
    size,
    ...STANDARD_ALIAS_PRICING_CONDITIONS,
  };

  // Only include region_id if explicitly provided (API doesn't accept empty string)
  if (regionId) {
    params.region_id = regionId;
  }

  return params;
}

/**
 * Sync market data for a single catalog item and specific size
 * ALWAYS uses NEW + GOOD_CONDITION - no variant selection
 */
export async function syncAliasMarketDataForInventoryItem(
  client: AliasClient,
  catalogId: string,
  usSize: number,
  options: {
    regionId?: string;
  } = {}
): Promise<SyncResult> {
  try {
    console.log(`[Alias Sync] Syncing ${catalogId} size ${usSize} US (NEW + GOOD_CONDITION)`);

    // Use standard pricing params - LOCKED to NEW + GOOD_CONDITION
    const params = getStandardAliasPricingParams(catalogId, usSize, options.regionId);

    const response = await client.getPricingInsights(params);

    const supabase = createServiceClient();
    const snapshotTime = new Date().toISOString();

    const snapshot = {
      catalog_id: catalogId,
      size: usSize,
      currency: 'USD',
      lowest_ask_cents: response.availability.lowest_listing_price_cents
        ? parseInt(response.availability.lowest_listing_price_cents, 10)
        : null,
      highest_bid_cents: response.availability.highest_offer_price_cents
        ? parseInt(response.availability.highest_offer_price_cents, 10)
        : null,
      last_sold_price_cents: response.availability.last_sold_listing_price_cents
        ? parseInt(response.availability.last_sold_listing_price_cents, 10)
        : null,
      global_indicator_price_cents: response.availability.global_indicator_price_cents
        ? parseInt(response.availability.global_indicator_price_cents, 10)
        : null,
      snapshot_at: snapshotTime,
    };

    // Delete old snapshot for this exact variant and insert new one
    await supabase
      .from('alias_market_snapshots')
      .delete()
      .eq('catalog_id', catalogId)
      .eq('size', usSize)
      .eq('currency', 'USD');

    const { error: insertError } = await supabase
      .from('alias_market_snapshots')
      .insert([snapshot]);

    if (insertError) {
      console.error('[Alias Sync] Database error:', insertError);
      return {
        success: false,
        catalogId,
        size: usSize,
        error: insertError.message,
      };
    }

    console.log(`[Alias Sync] ✓ Synced ${catalogId} size ${usSize}: $${snapshot.lowest_ask_cents ? snapshot.lowest_ask_cents/100 : 0}/$${snapshot.highest_bid_cents ? snapshot.highest_bid_cents/100 : 0}`);

    return {
      success: true,
      catalogId,
      size: usSize,
      variantsSynced: 1,
    };

  } catch (error) {
    console.error('[Alias Sync] Error syncing market data:', error);
    return {
      success: false,
      catalogId,
      size: usSize,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync market data for a specific catalog item and size
 * LOCKED to NEW + GOOD_CONDITION only
 */
export async function syncAliasMarketDataForSize(
  client: AliasClient,
  catalogId: string,
  size: number,
  options: {
    regionId?: string;
  } = {}
): Promise<SyncResult> {
  try {
    console.log(`[Alias Sync] Syncing market data for ${catalogId} size ${size} (NEW + GOOD_CONDITION)`);

    // Use standard pricing params - LOCKED to NEW + GOOD_CONDITION
    const params = getStandardAliasPricingParams(catalogId, size, options.regionId);

    // Fetch pricing for specific variation
    const response = await client.getPricingInsights(params);

    // Prepare snapshot data
    const supabase = createServiceClient();
    const snapshotTime = new Date().toISOString();
    const currency = 'USD';

    const snapshot = {
      catalog_id: catalogId,
      size,
      currency,
      // CORRECT MAPPING (no swap needed):
      // lowest_ask_cents = Market column = lowest_listing_price_cents (what sellers ask)
      // highest_bid_cents = Highest Bid column = highest_offer_price_cents (what buyers bid)
      lowest_ask_cents: response.availability.lowest_listing_price_cents
        ? parseInt(response.availability.lowest_listing_price_cents, 10)
        : null,
      highest_bid_cents: response.availability.highest_offer_price_cents
        ? parseInt(response.availability.highest_offer_price_cents, 10)
        : null,
      last_sold_price_cents: response.availability.last_sold_listing_price_cents
        ? parseInt(response.availability.last_sold_listing_price_cents, 10)
        : null,
      global_indicator_price_cents: response.availability.global_indicator_price_cents
        ? parseInt(response.availability.global_indicator_price_cents, 10)
        : null,
      snapshot_at: snapshotTime,
    };

    // Insert/update snapshot
    const { error: insertError } = await supabase
      .from('alias_market_snapshots')
      .upsert([snapshot], {
        onConflict: 'catalog_id,size,currency,snapshot_at',
      });

    if (insertError) {
      console.error('[Alias Sync] Database error:', insertError);
      return {
        success: false,
        catalogId,
        size,
        error: insertError.message,
      };
    }

    console.log(`[Alias Sync] Synced market data for ${catalogId} size ${size}`);

    return {
      success: true,
      catalogId,
      size,
      variantsSynced: 1,
    };

  } catch (error) {
    console.error('[Alias Sync] Error syncing market data:', error);
    return {
      success: false,
      catalogId,
      size,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync market data for an inventory item using its alias link
 */
export async function syncInventoryAliasData(
  client: AliasClient,
  inventoryId: string
): Promise<SyncResult> {
  try {
    const supabase = createServiceClient();

    // Get the alias link for this inventory item
    const { data: link, error: linkError } = await supabase
      .from('inventory_alias_links')
      .select('alias_catalog_id, inventory_id')
      .eq('inventory_id', inventoryId)
      .single();

    if (linkError || !link) {
      return {
        success: false,
        catalogId: '',
        error: 'No Alias catalog link found for this inventory item',
      };
    }

    // Get inventory item details for size
    const { data: inventory, error: invError } = await supabase
      .from('Inventory')
      .select('size_uk')
      .eq('id', inventoryId)
      .single();

    if (invError || !inventory) {
      return {
        success: false,
        catalogId: link.alias_catalog_id,
        error: 'Inventory item not found',
      };
    }

    const sizeUk = parseFloat(inventory.size_uk);
    if (!sizeUk || isNaN(sizeUk)) {
      return {
        success: false,
        catalogId: link.alias_catalog_id,
        error: 'Invalid size',
      };
    }

    // Convert UK to US size (Alias API uses US sizes)
    const usSize = sizeUk + 1;

    // Sync market data with standard conditions
    const result = await syncAliasMarketDataForInventoryItem(client, link.alias_catalog_id, usSize);

    // Update the link's sync status
    if (result.success) {
      await supabase
        .from('inventory_alias_links')
        .update({
          last_sync_success_at: new Date().toISOString(),
          last_sync_error: null,
        })
        .eq('inventory_id', inventoryId);
    } else {
      await supabase
        .from('inventory_alias_links')
        .update({
          last_sync_error: result.error,
        })
        .eq('inventory_id', inventoryId);
    }

    return result;

  } catch (error) {
    console.error('[Alias Sync] Error syncing inventory:', error);
    return {
      success: false,
      catalogId: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync market data for all items that have Alias catalog links
 * Syncs each inventory item individually with its specific size
 */
export async function syncAllAliasMarketData(
  client: AliasClient,
  options: {
    limit?: number;
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<BulkSyncResult> {
  try {
    const supabase = createServiceClient();

    // Get all inventory items with Alias links, including their sizes
    const query = supabase
      .from('inventory_alias_links')
      .select(`
        inventory_id,
        alias_catalog_id,
        Inventory!inner(size_uk)
      `)
      .not('alias_catalog_id', 'is', null)
      .eq('mapping_status', 'ok');

    if (options.limit) {
      query.limit(options.limit);
    }

    const { data: links, error: linksError } = await query;

    if (linksError || !links || links.length === 0) {
      return {
        totalItems: 0,
        successCount: 0,
        errorCount: 0,
        results: [],
      };
    }

    console.log(`[Alias Sync] Starting bulk sync for ${links.length} inventory items`);

    const results: SyncResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const sizeUk = parseFloat((link.Inventory as any)?.size_uk);

      if (!sizeUk || isNaN(sizeUk)) {
        console.error(`[Alias Sync] Missing or invalid size for inventory ${link.inventory_id}`);
        errorCount++;
        continue;
      }

      // Convert UK to US size (Alias API uses US sizes)
      // Simple conversion: US = UK + 1 for men's shoes
      const usSize = sizeUk + 1;

      // Report progress
      if (options.onProgress) {
        options.onProgress(i + 1, links.length);
      }

      // Sync this specific item
      const result = await syncAliasMarketDataForInventoryItem(
        client,
        link.alias_catalog_id!,
        usSize
      );
      results.push(result);

      if (result.success) {
        successCount++;
        // Update sync timestamp
        await supabase
          .from('inventory_alias_links')
          .update({
            last_sync_success_at: new Date().toISOString(),
            last_sync_error: null,
          })
          .eq('inventory_id', link.inventory_id);
      } else {
        errorCount++;
        // Update error
        await supabase
          .from('inventory_alias_links')
          .update({
            last_sync_error: result.error,
          })
          .eq('inventory_id', link.inventory_id);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`[Alias Sync] Bulk sync complete: ${successCount} success, ${errorCount} errors`);

    return {
      totalItems: links.length,
      successCount,
      errorCount,
      results,
    };

  } catch (error) {
    console.error('[Alias Sync] Error in bulk sync:', error);
    return {
      totalItems: 0,
      successCount: 0,
      errorCount: 1,
      results: [{
        success: false,
        catalogId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      }],
    };
  }
}

// ============================================================================
// MASTER MARKET DATA INGESTION (NEW SYSTEM)
// ============================================================================

export interface MasterMarketDataSyncResult {
  success: boolean;
  catalogId: string;
  sku?: string;
  variantsIngested: number;
  volumeMetricsUpdated: number;
  histogramsIngested?: number;
  error?: string;
}

// ============================================================================
// MULTI-REGION SYNC (Following StockX pattern)
// ============================================================================

export interface MultiRegionSyncResult {
  success: boolean;
  primaryRegion: string;
  primaryResult: MasterMarketDataSyncResult;
  secondaryResults: Record<string, MasterMarketDataSyncResult>;
  totalVariantsIngested: number;
  catalogId: string;
  sku?: string;
}

/**
 * Map user region preference to Alias region ID
 * Alias regions are different marketplaces with different inventory
 *
 * NOTE: Unlike StockX which uses currency codes (USD/GBP/EUR),
 * Alias uses numeric region IDs: 1=US, 2=EU, 3=UK
 */
export function getAliasRegionFromUserRegion(userRegion?: string): string {
  if (!userRegion) return '3'; // Default to UK (region 3)

  const regionUpper = userRegion.toUpperCase();

  // UK region
  if (regionUpper === 'UK' || regionUpper === 'GB' || regionUpper === 'GBP') {
    return '3';
  }

  // EU regions
  if (['EU', 'EUR', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI'].includes(regionUpper)) {
    return '2';
  }

  // US region (default fallback)
  return '1';
}

/**
 * Get secondary regions to sync (all regions except primary)
 * For Alias, we sync: US (1), UK (3), EU (2)
 */
export function getAliasSecondaryRegions(primaryRegion: string): string[] {
  const allRegions = ['1', '2', '3']; // US, EU, UK
  return allRegions.filter(r => r !== primaryRegion);
}

/**
 * Sync Alias market data to master_market_data table (NEW system)
 *
 * This function:
 * 1. Calls listPricingInsights() to get ALL size availabilities
 * 2. Calls getRecentSales() to get volume metrics
 * 3. Ingests both into master_market_data via mappers
 *
 * Feature flag: ALIAS_RECENT_SALES_ENABLED
 * - If true: calls both availabilities + recent_sales
 * - If false: calls availabilities only (volume fields remain NULL)
 *
 * @param client - AliasClient instance
 * @param catalogId - Alias catalog ID
 * @param options - Sync options
 */
export async function syncAliasToMasterMarketData(
  client: AliasClient,
  catalogId: string,
  options: {
    sku?: string;
    regionId?: string;
    includeConsigned?: boolean;
  } = {}
): Promise<MasterMarketDataSyncResult> {
  const { sku, regionId, includeConsigned = true } = options;
  const recentSalesEnabled = process.env.ALIAS_RECENT_SALES_ENABLED === 'true';

  console.log('[Alias Master Sync] Starting sync for catalog:', catalogId, {
    sku,
    regionId,
    includeConsigned,
    recentSalesEnabled,
  });

  try {
    // ========================================================================
    // Step 1: Fetch BOTH consigned and non-consigned availabilities in parallel
    // ========================================================================

    console.log('[Alias Master Sync] Fetching availabilities (both consigned & non-consigned)...');

    const [nonConsignedAvailabilities, consignedAvailabilities] = await Promise.all([
      client.listPricingInsights(catalogId, regionId, false), // Non-consigned
      client.listPricingInsights(catalogId, regionId, true),  // Consigned
    ]);

    console.log('[Alias Master Sync] Found variants:', {
      nonConsigned: nonConsignedAvailabilities?.variants?.length || 0,
      consigned: consignedAvailabilities?.variants?.length || 0,
    });

    if (
      (!nonConsignedAvailabilities?.variants?.length && !consignedAvailabilities?.variants?.length)
    ) {
      console.warn('[Alias Master Sync] No availability data returned from either endpoint');
      return {
        success: true,
        catalogId,
        sku,
        variantsIngested: 0,
        volumeMetricsUpdated: 0,
      };
    }

    // ========================================================================
    // Step 2: Ingest BOTH to master_market_data with different provider_source
    // ========================================================================

    console.log('[Alias Master Sync] Ingesting availabilities...');

    // Get the raw snapshot ID from the last snapshot
    const supabase = createServiceClient();
    const { data: latestSnapshot } = await supabase
      .from('alias_raw_snapshots')
      .select('id')
      .eq('endpoint', 'pricing_availabilities')
      .eq('catalog_id', catalogId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const rawSnapshotId = latestSnapshot?.id || null;
    const snapshotAt = new Date();

    // Fetch product metadata (category, gender) for size validation
    let productGender: string | null = null;
    let productCategory = 'sneakers'; // Default fallback

    const { data: productData } = await supabase
      .from('product_catalog')
      .select('gender, category')
      .eq('alias_catalog_id', catalogId)
      .single();

    if (productData) {
      productGender = productData.gender;
      productCategory = productData.category || 'sneakers';
      console.log('[Alias Master Sync] Product metadata:', {
        gender: productGender || 'NULL (will use unisex)',
        category: productCategory,
      });
    } else {
      console.warn('[Alias Master Sync] Product not found in catalog (using defaults)');
    }

    let totalVariantsIngested = 0;

    // Ingest non-consigned (provider_source = 'alias_availabilities')
    if (nonConsignedAvailabilities?.variants?.length) {
      await ingestAliasAvailabilities(
        rawSnapshotId,
        nonConsignedAvailabilities as any,
        {
          catalogId,
          regionId,
          sku,
          category: productCategory,
          gender: productGender || undefined,
          snapshotAt,
          consignedFilter: false, // Only non-consigned
        }
      );
      totalVariantsIngested += nonConsignedAvailabilities.variants.length;
      console.log('[Alias Master Sync] ✅ Ingested', nonConsignedAvailabilities.variants.length, 'NON-CONSIGNED variants');
    }

    // Ingest consigned (provider_source = 'alias_availabilities_consigned')
    if (consignedAvailabilities?.variants?.length) {
      await ingestAliasAvailabilities(
        rawSnapshotId,
        consignedAvailabilities as any,
        {
          catalogId,
          regionId,
          sku,
          category: productCategory,
          gender: productGender || undefined,
          snapshotAt,
          consignedFilter: true, // Only consigned
        }
      );
      totalVariantsIngested += consignedAvailabilities.variants.length;
      console.log('[Alias Master Sync] ✅ Ingested', consignedAvailabilities.variants.length, 'CONSIGNED variants');
    }

    const variantsIngested = totalVariantsIngested;
    console.log('[Alias Master Sync] ✅ Total ingested:', variantsIngested, 'variants (both consigned & non-consigned)');

    // ========================================================================
    // Step 3: Fetch recent sales (if enabled) - PER SIZE
    // ========================================================================

    let volumeMetricsUpdated = 0;

    if (recentSalesEnabled) {
      console.log('[Alias Master Sync] Fetching recent sales (feature flag enabled)...');

      try {
        // Get unique sizes from BOTH consigned and non-consigned variants
        const allSizes = new Set<number>();

        if (nonConsignedAvailabilities?.variants) {
          for (const variant of nonConsignedAvailabilities.variants) {
            if (
              variant.product_condition === 'PRODUCT_CONDITION_NEW' &&
              variant.packaging_condition === 'PACKAGING_CONDITION_GOOD_CONDITION'
            ) {
              allSizes.add(variant.size);
            }
          }
        }

        if (consignedAvailabilities?.variants) {
          for (const variant of consignedAvailabilities.variants) {
            if (
              variant.product_condition === 'PRODUCT_CONDITION_NEW' &&
              variant.packaging_condition === 'PACKAGING_CONDITION_GOOD_CONDITION'
            ) {
              allSizes.add(variant.size);
            }
          }
        }

        console.log(`[Alias Master Sync] Fetching recent sales for ${allSizes.size} sizes...`);

        // Fetch recent sales for each size
        const allRecentSales: any[] = [];
        let fetchedSizes = 0;

        for (const size of Array.from(allSizes)) {
          try {
            const sizeRecentSales = await client.getRecentSales({
              catalog_id: catalogId,
              size, // ✅ REQUIRED parameter
              limit: 100,
              region_id: regionId,
              product_condition: 'PRODUCT_CONDITION_NEW',
              packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
            });

            if (sizeRecentSales?.recent_sales?.length > 0) {
              allRecentSales.push(...sizeRecentSales.recent_sales);
              fetchedSizes++;
            }
          } catch (sizeError: any) {
            // Non-fatal: some sizes may not have recent sales
            console.warn(`[Alias Master Sync] No recent sales for size ${size}: ${sizeError.message}`);
          }
        }

        if (allRecentSales.length > 0) {
          console.log('[Alias Master Sync] Found', allRecentSales.length, 'recent sales across', fetchedSizes, 'sizes');

          // ========================================================================
          // Step 4: Ingest recent sales to update volume metrics
          // ========================================================================

          console.log('[Alias Master Sync] Updating volume metrics...');

          // Get the raw snapshot ID for recent_sales
          const { data: recentSalesSnapshot } = await supabase
            .from('alias_raw_snapshots')
            .select('id')
            .eq('endpoint', 'recent_sales')
            .eq('catalog_id', catalogId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const recentSalesSnapshotId = recentSalesSnapshot?.id || null;

          await ingestAliasRecentSales(
            recentSalesSnapshotId,
            { recent_sales: allRecentSales },
            {
              catalogId,
              regionId,
              sku,
              snapshotAt,
            }
          );

          volumeMetricsUpdated = fetchedSizes;

          console.log('[AliasRecentSales] ✅ Updated volume metrics for', volumeMetricsUpdated, 'sizes');
        } else {
          console.log('[Alias Master Sync] No recent sales data found for any size');
        }
      } catch (recentSalesError: any) {
        // Don't fail the whole sync if recent_sales fails
        console.warn('[Alias Master Sync] ⚠️ Recent sales failed (non-fatal):', recentSalesError.message);
      }
    } else {
      console.log('[Alias Master Sync] Recent sales DISABLED (ALIAS_RECENT_SALES_ENABLED=false)');
    }

    // ========================================================================
    // Step 4: Fetch offer histograms (bid depth) - PER SIZE
    // ========================================================================

    let histogramsIngested = 0;
    const histogramEnabled = process.env.ALIAS_HISTOGRAMS_ENABLED === 'true';

    if (histogramEnabled) {
      console.log('[Alias Master Sync] Fetching offer histograms (feature flag enabled)...');

      try {
        // Get unique sizes from BOTH consigned and non-consigned variants
        const allSizes = new Set<number>();

        if (nonConsignedAvailabilities?.variants) {
          for (const variant of nonConsignedAvailabilities.variants) {
            if (
              variant.product_condition === 'PRODUCT_CONDITION_NEW' &&
              variant.packaging_condition === 'PACKAGING_CONDITION_GOOD_CONDITION'
            ) {
              allSizes.add(variant.size);
            }
          }
        }

        if (consignedAvailabilities?.variants) {
          for (const variant of consignedAvailabilities.variants) {
            if (
              variant.product_condition === 'PRODUCT_CONDITION_NEW' &&
              variant.packaging_condition === 'PACKAGING_CONDITION_GOOD_CONDITION'
            ) {
              allSizes.add(variant.size);
            }
          }
        }

        console.log(`[Alias Master Sync] Fetching offer histograms for ${allSizes.size} sizes...`);

        // Import histogram ingestion function
        const { ingestAliasOfferHistogram } = await import('../ingestion/alias-histogram-mapper');

        // Fetch histograms for each size
        let fetchedHistograms = 0;

        for (const size of Array.from(allSizes)) {
          try {
            const histogram = await client.getOfferHistogram({
              catalog_id: catalogId,
              size,
              product_condition: 'PRODUCT_CONDITION_NEW',
              packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
              region_id: regionId,
            });

            if (histogram?.offer_histogram?.bins?.length > 0) {
              // Get raw snapshot ID for histogram
              const { data: histogramSnapshot } = await supabase
                .from('alias_raw_snapshots')
                .select('id')
                .eq('endpoint', 'offer_histogram')
                .eq('catalog_id', catalogId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              const histogramSnapshotId = histogramSnapshot?.id || null;

              const result = await ingestAliasOfferHistogram(
                histogramSnapshotId,
                histogram,
                {
                  catalogId,
                  sizeValue: size,
                  sku,
                  regionCode: regionId,
                  consigned: false, // Standard histogram
                  snapshotAt,
                  supabase,
                }
              );

              if (result.success) {
                histogramsIngested += result.binsIngested;
                fetchedHistograms++;
              }
            }
          } catch (histogramError: any) {
            // Non-fatal: some sizes may not have histogram data
            console.warn(`[Alias Master Sync] No histogram for size ${size}: ${histogramError.message}`);
          }
        }

        if (fetchedHistograms > 0) {
          console.log('[Alias Master Sync] ✅ Fetched', fetchedHistograms, 'histograms (', histogramsIngested, 'total bins)');
        } else {
          console.log('[Alias Master Sync] No histogram data found for any size');
        }
      } catch (histogramError: any) {
        // Don't fail the whole sync if histograms fail
        console.warn('[Alias Master Sync] ⚠️ Histograms failed (non-fatal):', histogramError.message);
      }
    } else {
      console.log('[Alias Master Sync] Histograms DISABLED (ALIAS_HISTOGRAMS_ENABLED=false)');
    }

    // ========================================================================
    // Success
    // ========================================================================

    console.log('[Alias Master Sync] ✅ Complete:', {
      catalogId,
      sku,
      variantsIngested,
      volumeMetricsUpdated,
      histogramsIngested,
      recentSalesEnabled,
      histogramEnabled,
    });

    return {
      success: true,
      catalogId,
      sku,
      variantsIngested,
      volumeMetricsUpdated,
      histogramsIngested,
    };

  } catch (error: any) {
    console.error('[Alias Master Sync] Error:', error);
    return {
      success: false,
      catalogId,
      sku,
      variantsIngested: 0,
      volumeMetricsUpdated: 0,
      histogramsIngested: 0,
      error: error.message,
    };
  }
}

// ============================================================================
// MULTI-REGION SYNC FUNCTION (Following StockX pattern)
// ============================================================================

/**
 * Sync Alias product across multiple regions (US, UK, EU)
 * Implements "best-in-class" multi-region strategy like StockX
 *
 * @param client - AliasClient instance
 * @param catalogId - Alias catalog ID
 * @param options - Sync options
 * @returns Multi-region sync result with primary + secondary results
 *
 * @example
 * const result = await syncAliasProductMultiRegion(client, 'cat_123', {
 *   sku: 'DZ5485-410',
 *   userRegion: 'UK',
 *   syncSecondaryRegions: true
 * });
 */
export async function syncAliasProductMultiRegion(
  client: AliasClient,
  catalogId: string,
  options: {
    sku?: string;
    userRegion?: string;
    syncSecondaryRegions?: boolean;
  } = {}
): Promise<MultiRegionSyncResult> {
  const { sku, userRegion, syncSecondaryRegions = true } = options;

  // Step 1: Determine primary region from user preference
  const primaryRegion = getAliasRegionFromUserRegion(userRegion);

  console.log('[Alias Multi-Region] Starting sync for catalog:', catalogId, {
    sku,
    userRegion,
    primaryRegion,
    syncSecondaryRegions,
  });

  try {
    // ========================================================================
    // STEP 1: Sync PRIMARY region FIRST (blocking)
    // ========================================================================

    console.log(`[Alias Multi-Region] Syncing PRIMARY region (${primaryRegion})...`);

    const primaryResult = await syncAliasToMasterMarketData(client, catalogId, {
      sku,
      regionId: primaryRegion,
      includeConsigned: true,
    });

    if (!primaryResult.success) {
      console.error('[Alias Multi-Region] ❌ Primary region sync failed:', primaryResult.error);
      return {
        success: false,
        primaryRegion,
        primaryResult,
        secondaryResults: {},
        totalVariantsIngested: primaryResult.variantsIngested || 0,
        catalogId,
        sku,
      };
    }

    console.log(`[Alias Multi-Region] ✅ Primary region (${primaryRegion}) synced:`, {
      variants: primaryResult.variantsIngested,
      volumeMetrics: primaryResult.volumeMetricsUpdated,
      histograms: primaryResult.histogramsIngested || 0,
    });

    let totalVariantsIngested = primaryResult.variantsIngested || 0;

    // ========================================================================
    // STEP 1.5: Enrich product metadata (non-blocking, best effort)
    // ========================================================================

    console.log('[Alias Multi-Region] Enriching product metadata...');
    try {
      const metadataResult = await enrichAliasProductMetadata(client, catalogId);
      if (metadataResult.success) {
        console.log(`[Alias Multi-Region] ✅ Product metadata enriched: ${metadataResult.fieldsUpdated} fields`);
      } else {
        console.warn('[Alias Multi-Region] ⚠️ Metadata enrichment failed (non-fatal):', metadataResult.error);
      }
    } catch (error: any) {
      console.warn('[Alias Multi-Region] ⚠️ Metadata enrichment error (non-fatal):', error.message);
    }

    // ========================================================================
    // STEP 2: Sync SECONDARY regions in background (non-blocking)
    // ========================================================================

    const secondaryResults: Record<string, MasterMarketDataSyncResult> = {};

    if (syncSecondaryRegions) {
      const secondaryRegions = getAliasSecondaryRegions(primaryRegion);

      console.log(`[Alias Multi-Region] Syncing ${secondaryRegions.length} secondary regions:`, secondaryRegions);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Sync each secondary region
      for (const region of secondaryRegions) {
        try {
          console.log(`[Alias Multi-Region] Syncing secondary region (${region})...`);

          const result = await syncAliasToMasterMarketData(client, catalogId, {
            sku,
            regionId: region,
            includeConsigned: true,
          });

          secondaryResults[region] = result;
          totalVariantsIngested += result.variantsIngested || 0;

          if (result.success) {
            console.log(`[Alias Multi-Region] ✅ Secondary region (${region}) synced:`, {
              variants: result.variantsIngested,
              volumeMetrics: result.volumeMetricsUpdated,
              histograms: result.histogramsIngested || 0,
            });
          } else {
            console.warn(`[Alias Multi-Region] ⚠️ Secondary region (${region}) failed:`, result.error);
          }

          // Delay between regions to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error: any) {
          console.error(`[Alias Multi-Region] ❌ Secondary region (${region}) error:`, error.message);
          secondaryResults[region] = {
            success: false,
            catalogId,
            sku,
            variantsIngested: 0,
            volumeMetricsUpdated: 0,
            histogramsIngested: 0,
            error: error.message,
          };
        }
      }
    } else {
      console.log('[Alias Multi-Region] Secondary regions sync DISABLED');
    }

    // ========================================================================
    // STEP 3: Return complete result
    // ========================================================================

    console.log('[Alias Multi-Region] ✅ Multi-region sync complete:', {
      catalogId,
      sku,
      primaryRegion,
      totalVariantsIngested,
      secondaryRegionCount: Object.keys(secondaryResults).length,
    });

    return {
      success: true,
      primaryRegion,
      primaryResult,
      secondaryResults,
      totalVariantsIngested,
      catalogId,
      sku,
    };

  } catch (error: any) {
    console.error('[Alias Multi-Region] Unexpected error:', error);
    return {
      success: false,
      primaryRegion,
      primaryResult: {
        success: false,
        catalogId,
        sku,
        variantsIngested: 0,
        volumeMetricsUpdated: 0,
        histogramsIngested: 0,
        error: error.message,
      },
      secondaryResults: {},
      totalVariantsIngested: 0,
      catalogId,
      sku,
    };
  }
}

// ============================================================================
// METADATA ENRICHMENT (Following StockX pattern)
// ============================================================================

export interface ProductMetadataResult {
  success: boolean;
  fieldsUpdated: number;
  error?: string;
}

/**
 * Enrich product_catalog with metadata from Alias API
 * Extracts: colorway, retail_price, release_date, image_url, category, gender
 *
 * @param client - AliasClient instance
 * @param catalogId - Alias catalog ID
 * @returns Metadata enrichment result
 *
 * @example
 * const result = await enrichAliasProductMetadata(client, 'cat_123');
 * // Returns: { success: true, fieldsUpdated: 5 }
 */
export async function enrichAliasProductMetadata(
  client: AliasClient,
  catalogId: string
): Promise<ProductMetadataResult> {
  console.log('[Alias Metadata] Enriching product:', catalogId);

  try {
    const supabase = createServiceClient();

    // ========================================================================
    // Step 1: Fetch full product details from Alias
    // ========================================================================

    console.log('[Alias Metadata] Fetching product details from Alias API...');

    let catalogItem;
    try {
      catalogItem = await client.getCatalogItem(catalogId);
    } catch (error: any) {
      console.error('[Alias Metadata] ⚠️ Alias API failed:', error.message);
      return {
        success: false,
        fieldsUpdated: 0,
        error: `Alias API error: ${error.message}`,
      };
    }

    if (!catalogItem) {
      console.warn('[Alias Metadata] ⚠️ No catalog item returned from Alias');
      return {
        success: false,
        fieldsUpdated: 0,
        error: 'Catalog item not found',
      };
    }

    console.log('[Alias Metadata] ✅ Catalog item fetched:', catalogItem.name);

    // ========================================================================
    // Step 2: Extract metadata fields
    // ========================================================================

    const metadata: Record<string, any> = {};
    let fieldsUpdated = 0;

    // Colorway
    if (catalogItem.colorway) {
      metadata.colorway = catalogItem.colorway;
      fieldsUpdated++;
    }

    // Retail Price (convert from cents string to pennies integer)
    if (catalogItem.retail_price_cents) {
      const retailPriceCents = parseInt(catalogItem.retail_price_cents, 10);
      if (!isNaN(retailPriceCents)) {
        // Convert USD cents to GBP pennies at approximate rate (1 USD = 0.79 GBP)
        // Store as pennies (e.g., $180 = 18000 cents → £142.20 = 14220 pennies)
        // TODO: Use real FX rates from database
        const retailPricePennies = Math.round(retailPriceCents * 0.79);
        metadata.retail_price = retailPricePennies;
        fieldsUpdated++;
      }
    }

    // Release Date
    if (catalogItem.release_date) {
      metadata.release_date = catalogItem.release_date;
      fieldsUpdated++;
    }

    // Category (map Alias category to our category)
    if (catalogItem.product_category_v2) {
      metadata.category = catalogItem.product_category_v2; // 'shoes', 'apparel', etc.
      fieldsUpdated++;
    } else if (catalogItem.product_type) {
      metadata.category = catalogItem.product_type; // 'sneakers', etc.
      fieldsUpdated++;
    }

    // Gender
    if (catalogItem.gender) {
      metadata.gender = catalogItem.gender; // 'men', 'women', 'unisex', etc.
      fieldsUpdated++;
    }

    // Image URL
    if (catalogItem.main_picture_url) {
      metadata.image_url = catalogItem.main_picture_url;
      fieldsUpdated++;
    }

    // Min/Max Listing Price (price bounds for validation)
    if (catalogItem.minimum_listing_price_cents) {
      const minPriceCents = parseInt(catalogItem.minimum_listing_price_cents, 10);
      if (!isNaN(minPriceCents)) {
        // Convert USD cents to GBP pennies (approximate rate)
        const minPricePennies = Math.round(minPriceCents * 0.79);
        metadata.min_listing_price = minPricePennies;
        fieldsUpdated++;
      }
    }

    if (catalogItem.maximum_listing_price_cents) {
      const maxPriceCents = parseInt(catalogItem.maximum_listing_price_cents, 10);
      if (!isNaN(maxPriceCents)) {
        // Convert USD cents to GBP pennies (approximate rate)
        const maxPricePennies = Math.round(maxPriceCents * 0.79);
        metadata.max_listing_price = maxPricePennies;
        fieldsUpdated++;
      }
    }

    console.log('[Alias Metadata] Extracted', fieldsUpdated, 'metadata fields');

    // ========================================================================
    // Step 3: Update product_catalog
    // ========================================================================

    if (fieldsUpdated > 0) {
      console.log('[Alias Metadata] Updating product_catalog...');

      // Find the product by alias_catalog_id
      const { data: existingProduct } = await supabase
        .from('product_catalog')
        .select('id')
        .eq('alias_catalog_id', catalogId)
        .single();

      if (!existingProduct) {
        console.warn('[Alias Metadata] ⚠️ Product not found in catalog (alias_catalog_id:', catalogId, ')');
        return {
          success: false,
          fieldsUpdated: 0,
          error: 'Product not found in catalog',
        };
      }

      const { error: updateError } = await supabase
        .from('product_catalog')
        .update(metadata)
        .eq('alias_catalog_id', catalogId);

      if (updateError) {
        console.error('[Alias Metadata] ❌ Update failed:', updateError.message);
        return {
          success: false,
          fieldsUpdated: 0,
          error: `Database update failed: ${updateError.message}`,
        };
      }

      console.log('[Alias Metadata] ✅ Updated product_catalog with', fieldsUpdated, 'fields');
    } else {
      console.log('[Alias Metadata] ⚠️ No metadata fields to update');
    }

    return {
      success: true,
      fieldsUpdated,
    };

  } catch (error: any) {
    console.error('[Alias Metadata] Unexpected error:', error);
    return {
      success: false,
      fieldsUpdated: 0,
      error: error.message,
    };
  }
}
