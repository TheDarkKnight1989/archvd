/**
 * GOAT Listings Service
 * Handles seller listing creation, updates, and management
 */

import type { GoatClient } from './client';
import type {
  GoatListing,
  GoatCreateListingParams,
  GoatUpdateListingParams,
  GoatBulkPriceUpdate,
} from './types';

export class GoatListingsService {
  constructor(private client: GoatClient) {}

  // ==========================================================================
  // Listing CRUD Operations
  // ==========================================================================

  /**
   * Get all active listings for the authenticated seller
   *
   * @example
   * const listings = await listingsService.getAll();
   * console.log(`You have ${listings.length} active listings`);
   */
  async getAll(params?: {
    status?: 'active' | 'sold' | 'cancelled' | 'expired';
    page?: number;
    limit?: number;
  }): Promise<GoatListing[]> {
    const queryParams: Record<string, any> = {
      page: params?.page || 1,
      limit: params?.limit || 100,
    };

    if (params?.status) {
      queryParams.status = params.status;
    }

    const response = await this.client.get<{ listings: GoatListing[] }>(
      '/listings',
      queryParams
    );

    return response.listings || [];
  }

  /**
   * Get a specific listing by ID
   */
  async getById(listingId: string): Promise<GoatListing> {
    return this.client.get<GoatListing>(`/listings/${listingId}`);
  }

  /**
   * Create a new listing
   *
   * @example
   * const listing = await listingsService.create({
   *   productId: '12345',
   *   size: 'UK9',
   *   price: 250,
   *   currency: 'GBP',
   *   condition: 'new',
   *   boxCondition: 'good_condition',
   *   quantity: 1
   * });
   * console.log(`Listed with ID: ${listing.id}`);
   */
  async create(params: GoatCreateListingParams): Promise<GoatListing> {
    const payload: Record<string, any> = {
      product_id: params.productId,
      size: params.size,
      price: params.price,
      currency: params.currency || 'GBP',
      condition: params.condition || 'new',
      quantity: params.quantity || 1,
    };

    if (params.boxCondition) {
      payload.box_condition = params.boxCondition;
    }

    if (params.defects && params.defects.length > 0) {
      payload.defects = params.defects;
    }

    if (params.expirationDays) {
      payload.expiration_days = params.expirationDays;
    }

    return this.client.post<GoatListing>('/listings', payload);
  }

  /**
   * Update an existing listing
   *
   * @example
   * await listingsService.update('listing-123', {
   *   price: 225, // Price drop
   * });
   */
  async update(
    listingId: string,
    params: GoatUpdateListingParams
  ): Promise<GoatListing> {
    const payload: Record<string, any> = {};

    if (params.price !== undefined) payload.price = params.price;
    if (params.quantity !== undefined) payload.quantity = params.quantity;
    if (params.condition) payload.condition = params.condition;
    if (params.boxCondition) payload.box_condition = params.boxCondition;

    return this.client.patch<GoatListing>(`/listings/${listingId}`, payload);
  }

  /**
   * Update price for a single listing
   * Convenience method for common operation
   */
  async updatePrice(listingId: string, newPrice: number): Promise<GoatListing> {
    return this.update(listingId, { price: newPrice });
  }

  /**
   * Cancel (delete) a listing
   *
   * @example
   * await listingsService.cancel('listing-123');
   */
  async cancel(listingId: string): Promise<void> {
    await this.client.delete(`/listings/${listingId}`);
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Bulk update prices for multiple listings
   * Much more efficient than updating one-by-one
   *
   * @example
   * await listingsService.bulkUpdatePrices([
   *   { listingId: 'listing-1', newPrice: 200 },
   *   { listingId: 'listing-2', newPrice: 150 },
   * ]);
   */
  async bulkUpdatePrices(updates: GoatBulkPriceUpdate[]): Promise<void> {
    const payload = {
      updates: updates.map((u) => ({
        listing_id: u.listingId,
        price: u.newPrice,
      })),
    };

    await this.client.patch('/listings/bulk', payload);
  }

  /**
   * Bulk create multiple listings
   *
   * @example
   * const listings = await listingsService.bulkCreate([
   *   { productId: '123', size: 'UK9', price: 200 },
   *   { productId: '456', size: 'UK10', price: 250 },
   * ]);
   */
  async bulkCreate(
    params: GoatCreateListingParams[]
  ): Promise<GoatListing[]> {
    const payload = {
      listings: params.map((p) => ({
        product_id: p.productId,
        size: p.size,
        price: p.price,
        currency: p.currency || 'GBP',
        condition: p.condition || 'new',
        quantity: p.quantity || 1,
        box_condition: p.boxCondition,
        defects: p.defects,
        expiration_days: p.expirationDays,
      })),
    };

    const response = await this.client.post<{ listings: GoatListing[] }>(
      '/listings/bulk',
      payload
    );

    return response.listings || [];
  }

  /**
   * Bulk cancel multiple listings
   */
  async bulkCancel(listingIds: string[]): Promise<void> {
    const payload = { listing_ids: listingIds };
    await this.client.post('/listings/bulk_cancel', payload);
  }

  // ==========================================================================
  // Vacation Mode & Status Management
  // ==========================================================================

  /**
   * Enable vacation mode (pauses all listings)
   *
   * @example
   * await listingsService.setVacationMode(true);
   * console.log('All listings paused');
   */
  async setVacationMode(enabled: boolean): Promise<void> {
    await this.client.post('/seller/vacation_mode', { enabled });
  }

  /**
   * Check if vacation mode is currently enabled
   */
  async isVacationModeEnabled(): Promise<boolean> {
    const response = await this.client.get<{ enabled: boolean }>(
      '/seller/vacation_mode'
    );
    return response.enabled;
  }

  // ==========================================================================
  // Filtering & Querying
  // ==========================================================================

  /**
   * Get all listings for a specific product
   */
  async getByProduct(productId: string): Promise<GoatListing[]> {
    const allListings = await this.getAll();
    return allListings.filter((l) => l.productId === productId);
  }

  /**
   * Get all listings for a specific SKU
   */
  async getBySku(sku: string): Promise<GoatListing[]> {
    const allListings = await this.getAll();
    return allListings.filter((l) => l.sku === sku);
  }

  /**
   * Get all listings for a specific size
   */
  async getBySize(size: string): Promise<GoatListing[]> {
    const allListings = await this.getAll();
    return allListings.filter((l) => l.size === size);
  }

  /**
   * Get sold listings (completed sales)
   */
  async getSold(params?: { page?: number; limit?: number }): Promise<GoatListing[]> {
    return this.getAll({ status: 'sold', ...params });
  }

  /**
   * Get expired listings
   */
  async getExpired(): Promise<GoatListing[]> {
    return this.getAll({ status: 'expired' });
  }

  // ==========================================================================
  // Analytics & Insights
  // ==========================================================================

  /**
   * Get total value of all active listings
   */
  async getTotalInventoryValue(): Promise<number> {
    const activeListings = await this.getAll({ status: 'active' });
    return activeListings.reduce((sum, listing) => sum + listing.price * listing.quantity, 0);
  }

  /**
   * Get count of active listings
   */
  async getActiveCount(): Promise<number> {
    const activeListings = await this.getAll({ status: 'active' });
    return activeListings.length;
  }

  /**
   * Get listings grouped by status
   */
  async getStatusBreakdown(): Promise<Record<string, number>> {
    const allListings = await this.getAll();
    const breakdown: Record<string, number> = {};

    allListings.forEach((listing) => {
      breakdown[listing.status] = (breakdown[listing.status] || 0) + 1;
    });

    return breakdown;
  }

  /**
   * Find underpriced listings (your ask > market lowest ask)
   * Requires products service to fetch market data
   */
  async findOverpricedListings(
    productsService: any, // GoatProductsService
    threshold: number = 5 // percentage above market
  ): Promise<Array<{ listing: GoatListing; marketAsk: number; yourAsk: number; diff: number }>> {
    const activeListings = await this.getAll({ status: 'active' });
    const overpriced: Array<any> = [];

    for (const listing of activeListings) {
      const marketAsk = await productsService.getLowestAsk(listing.productId, listing.size);

      if (marketAsk && listing.price > marketAsk) {
        const diffPct = ((listing.price - marketAsk) / marketAsk) * 100;

        if (diffPct > threshold) {
          overpriced.push({
            listing,
            marketAsk,
            yourAsk: listing.price,
            diff: diffPct,
          });
        }
      }
    }

    return overpriced.sort((a, b) => b.diff - a.diff);
  }

  /**
   * Find stale listings (listed for more than X days)
   */
  async findStaleListings(daysThreshold: number = 30): Promise<GoatListing[]> {
    const activeListings = await this.getAll({ status: 'active' });
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

    return activeListings.filter((listing) => {
      const listedDate = new Date(listing.listedAt);
      return listedDate < cutoffDate;
    });
  }

  // ==========================================================================
  // Sync Helpers (for ArchVD integration)
  // ==========================================================================

  /**
   * Sync GOAT listings to local Inventory table
   * Returns mapping of GOAT listing ID → inventory data
   */
  async exportToInventory(): Promise<Array<{
    goat_listing_id: string;
    sku: string;
    size: string;
    purchase_price: number;
    goat_price: number;
    goat_status: string;
    goat_listed_at: string;
  }>> {
    const listings = await this.getAll();

    return listings.map((listing) => ({
      goat_listing_id: listing.id,
      sku: listing.sku,
      size: listing.size,
      purchase_price: 0, // Unknown from GOAT, user must fill in
      goat_price: listing.price,
      goat_status: listing.status,
      goat_listed_at: listing.listedAt,
    }));
  }

  /**
   * Create GOAT listing from ArchVD inventory item
   * Helper for one-click listing flow
   */
  async createFromInventoryItem(inventoryItem: {
    sku: string;
    size_uk: string;
    brand: string;
    model: string;
    // ... other fields
  }, listPrice: number): Promise<GoatListing> {
    // First, find the GOAT product by SKU
    // This would use ProductsService.getBySku()
    // Then create the listing

    throw new Error('Not implemented: Use ProductsService to find product ID first');
  }
}
