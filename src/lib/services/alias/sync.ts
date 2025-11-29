/**
 * Alias Market Data Sync Service
 * Fetch and store market pricing data from Alias API
 */

import { createClient as createServiceClient } from '@/lib/supabase/service';
import { AliasClient } from './client';
import type { AliasPricingVariant, ProductCondition, PackagingCondition } from './types';

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
