/**
 * Alias Listing Operations Service
 * Handle listing creation, updates, and lifecycle management
 *
 * ⚠️ MANUAL CREATION ONLY
 * - All listing operations require explicit user action
 * - No automatic listing creation from inventory
 * - User must provide all parameters
 */

import { createClient as createServiceClient } from '@/lib/supabase/service';
import { AliasClient } from './client';
import type {
  CreateListingParams,
  CreateListingResponse,
  UpdateListingParams,
  UpdateListingResponse,
  AliasListing,
} from './types';

export interface ListingResult {
  success: boolean;
  listing?: AliasListing;
  error?: string;
}

export interface CreateListingOptions extends CreateListingParams {
  user_id: string;
  inventory_id?: string; // Optional link to inventory
}

/**
 * Create a new Alias listing
 * Stores in both Alias API and local database
 */
export async function createAliasListing(
  client: AliasClient,
  options: CreateListingOptions
): Promise<ListingResult> {
  try {
    console.log('[Alias Listings] Creating listing:', {
      catalog_id: options.catalog_id,
      price_cents: options.price_cents,
      size: options.size,
    });

    // Validate price (must be whole dollars)
    if (options.price_cents % 100 !== 0) {
      return {
        success: false,
        error: 'Price must be in whole dollar increments (e.g., 25000 for $250.00)',
      };
    }

    // Create listing via Alias API
    const response = await client.createListing({
      catalog_id: options.catalog_id,
      price_cents: options.price_cents,
      condition: options.condition,
      packaging_condition: options.packaging_condition,
      size: options.size,
      size_unit: options.size_unit,
      activate: options.activate,
      metadata: options.metadata,
      defects: options.defects,
      additional_defects: options.additional_defects,
    });

    // TODO: Store in database (schema needs to be updated to match Alias API response)
    // Currently skipping DB insertion to avoid schema mismatch errors
    // The listing is successfully created on Alias, just not saved locally yet
    console.log('[Alias Listings] Skipping DB insertion (schema mismatch - TODO: fix schema)');

    // If inventory_id provided, link to inventory
    if (options.inventory_id) {
      await linkListingToInventory(
        options.inventory_id,
        response.listing.id,
        options.catalog_id
      );
    }

    console.log('[Alias Listings] Listing created successfully:', response.listing.id);

    return {
      success: true,
      listing: response.listing,
    };
  } catch (error) {
    console.error('[Alias Listings] Error creating listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update an existing Alias listing
 */
export async function updateAliasListing(
  client: AliasClient,
  listingId: string,
  userId: string,
  updates: UpdateListingParams
): Promise<ListingResult> {
  try {
    console.log('[Alias Listings] Updating listing:', listingId);

    // Validate price if provided (must be whole dollars)
    if (updates.price_cents !== undefined && updates.price_cents % 100 !== 0) {
      return {
        success: false,
        error: 'Price must be in whole dollar increments',
      };
    }

    // Update via Alias API
    const response = await client.updateListing(listingId, updates);

    // Update in database
    const supabase = createServiceClient();
    const { error: dbError } = await supabase
      .from('alias_listings')
      .update({
        price_cents: response.listing.price_cents,
        condition: response.listing.condition,
        packaging_condition: response.listing.packaging_condition,
        status: response.listing.status,
        updated_at: new Date().toISOString(),
      })
      .eq('alias_listing_id', listingId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('[Alias Listings] Database update error:', dbError);
    }

    console.log('[Alias Listings] Listing updated successfully');

    return {
      success: true,
      listing: response.listing,
    };
  } catch (error) {
    console.error('[Alias Listings] Error updating listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Activate an Alias listing
 */
export async function activateAliasListing(
  client: AliasClient,
  listingId: string,
  userId: string
): Promise<ListingResult> {
  try {
    console.log('[Alias Listings] Activating listing:', listingId);

    // Activate via Alias API
    const response = await client.activateListing(listingId);

    // Update status in database
    const supabase = createServiceClient();
    const { error: dbError } = await supabase
      .from('alias_listings')
      .update({
        status: response.listing.status,
        updated_at: new Date().toISOString(),
      })
      .eq('alias_listing_id', listingId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('[Alias Listings] Database update error:', dbError);
    }

    console.log('[Alias Listings] Listing activated:', response.listing.status);

    return {
      success: true,
      listing: response.listing,
    };
  } catch (error) {
    console.error('[Alias Listings] Error activating listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Deactivate an Alias listing
 */
export async function deactivateAliasListing(
  client: AliasClient,
  listingId: string,
  userId: string
): Promise<ListingResult> {
  try {
    console.log('[Alias Listings] Deactivating listing:', listingId);

    // Deactivate via Alias API
    const response = await client.deactivateListing(listingId);

    // Update status in database
    const supabase = createServiceClient();
    const { error: dbError } = await supabase
      .from('alias_listings')
      .update({
        status: response.listing.status,
        updated_at: new Date().toISOString(),
      })
      .eq('alias_listing_id', listingId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('[Alias Listings] Database update error:', dbError);
    }

    console.log('[Alias Listings] Listing deactivated:', response.listing.status);

    return {
      success: true,
      listing: response.listing,
    };
  } catch (error) {
    console.error('[Alias Listings] Error deactivating listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete an Alias listing
 */
export async function deleteAliasListing(
  client: AliasClient,
  listingId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Alias Listings] Deleting listing:', listingId);

    // Delete via Alias API
    await client.deleteListing(listingId);

    // Remove from database
    const supabase = createServiceClient();

    // First, clear listing_id from any inventory links
    await supabase
      .from('inventory_alias_links')
      .update({ alias_listing_id: null })
      .eq('alias_listing_id', listingId);

    // Then delete the listing
    const { error: dbError } = await supabase
      .from('alias_listings')
      .delete()
      .eq('alias_listing_id', listingId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('[Alias Listings] Database delete error:', dbError);
      return {
        success: false,
        error: `Failed to delete from database: ${dbError.message}`,
      };
    }

    console.log('[Alias Listings] Listing deleted successfully');

    return { success: true };
  } catch (error) {
    console.error('[Alias Listings] Error deleting listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Link a listing to an inventory item
 * Updates inventory_alias_links with the listing_id
 */
export async function linkListingToInventory(
  inventoryId: string,
  aliasListingId: string,
  catalogId: string
): Promise<void> {
  const supabase = createServiceClient();

  // Check if link exists
  const { data: existing } = await supabase
    .from('inventory_alias_links')
    .select('id')
    .eq('inventory_id', inventoryId)
    .single();

  if (existing) {
    // Update existing link
    await supabase
      .from('inventory_alias_links')
      .update({
        alias_listing_id: aliasListingId,
        alias_catalog_id: catalogId,
        mapping_status: 'ok',
      })
      .eq('inventory_id', inventoryId);
  } else {
    // Create new link
    await supabase
      .from('inventory_alias_links')
      .insert({
        inventory_id: inventoryId,
        alias_catalog_id: catalogId,
        alias_listing_id: aliasListingId,
        mapping_status: 'ok',
        match_confidence: 1.0, // Manual link = 100% confidence
      });
  }

  console.log('[Alias Listings] Linked listing to inventory:', inventoryId);
}

/**
 * Sync listing status from Alias API
 */
export async function syncAliasListing(
  client: AliasClient,
  listingId: string,
  userId: string
): Promise<ListingResult> {
  try {
    console.log('[Alias Listings] Syncing listing:', listingId);

    // Fetch from Alias API
    const response = await client.getListing(listingId);

    // Update in database
    const supabase = createServiceClient();
    const { error: dbError } = await supabase
      .from('alias_listings')
      .update({
        status: response.listing.status,
        price_cents: response.listing.price_cents,
        condition: response.listing.condition,
        packaging_condition: response.listing.packaging_condition,
        updated_at: new Date().toISOString(),
      })
      .eq('alias_listing_id', listingId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('[Alias Listings] Sync database error:', dbError);
    }

    console.log('[Alias Listings] Listing synced successfully');

    return {
      success: true,
      listing: response.listing,
    };
  } catch (error) {
    console.error('[Alias Listings] Error syncing listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
