/**
 * Alias (GOAT) Integration Facade
 * Wraps GOAT service client with feature flag checks and structured logging
 */

import {
  isAliasEnabled,
  isAliasFullyConfigured,
  getAliasApiBaseUrl,
  getAliasOAuthCredentials,
  getMaskedClientId,
} from '@/lib/config/alias';
import { logger } from '@/lib/logger';
import {
  GoatClient,
  GoatProductsService,
  GoatListingsService,
  type GoatProduct,
  type GoatSearchParams,
  type GoatSearchResult,
  type GoatListing,
  type GoatBuyBarData,
} from '@/lib/services/goat';

// ============================================================================
// Error Types
// ============================================================================

export class AliasNotEnabledException extends Error {
  constructor() {
    super('Alias integration is not enabled');
    this.name = 'AliasNotEnabledException';
  }
}

export class AliasNotConfiguredException extends Error {
  constructor(message: string = 'Alias integration is not fully configured') {
    super(message);
    this.name = 'AliasNotConfiguredException';
  }
}

// ============================================================================
// Service Facade
// ============================================================================

export class AliasService {
  private client: GoatClient | null = null;
  private productsService: GoatProductsService | null = null;
  private listingsService: GoatListingsService | null = null;

  constructor(accessToken?: string) {
    // Check feature flag
    if (!isAliasEnabled()) {
      logger.warn('[Alias] Service instantiated but feature is disabled');
      return;
    }

    // Initialize client if token provided
    if (accessToken) {
      try {
        const apiBaseUrl = getAliasApiBaseUrl();
        this.client = new GoatClient({
          apiUrl: apiBaseUrl,
          accessToken,
          timeout: 30000,
          retries: 3,
        });

        this.productsService = new GoatProductsService(this.client);
        this.listingsService = new GoatListingsService(this.client);

        logger.info('[Alias] Service initialized', {
          apiBaseUrl,
          hasToken: true,
        });
      } catch (error) {
        logger.error('[Alias] Service initialization failed', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        throw error;
      }
    }
  }

  // ==========================================================================
  // Feature Flag Checks
  // ==========================================================================

  /**
   * Ensure Alias is enabled, throw if not
   */
  private ensureEnabled(): void {
    if (!isAliasEnabled()) {
      throw new AliasNotEnabledException();
    }
  }

  /**
   * Ensure client is initialized, throw if not
   */
  private ensureClient(): void {
    this.ensureEnabled();

    if (!this.client || !this.productsService || !this.listingsService) {
      throw new AliasNotConfiguredException('Alias client not initialized');
    }
  }

  /**
   * Check if service is ready to use
   */
  isReady(): boolean {
    return !!(isAliasEnabled() && this.client && this.productsService && this.listingsService);
  }

  // ==========================================================================
  // Product Operations
  // ==========================================================================

  /**
   * Search products with structured logging
   */
  async searchProducts(params: GoatSearchParams): Promise<GoatSearchResult> {
    this.ensureClient();

    const startTime = Date.now();

    try {
      logger.info('[Alias] Searching products', {
        query: params.query,
        brand: params.brand,
        limit: params.limit,
      });

      const results = await this.productsService!.search(params);

      const duration = Date.now() - startTime;
      logger.info('[Alias] Product search completed', {
        query: params.query,
        resultsCount: results.results.length,
        totalResults: results.total,
        duration,
      });

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[Alias] Product search failed', {
        query: params.query,
        error: error instanceof Error ? error.message : 'Unknown',
        duration,
      });
      throw error;
    }
  }

  /**
   * Get product by slug
   */
  async getProductBySlug(slug: string): Promise<GoatProduct> {
    this.ensureClient();

    const startTime = Date.now();

    try {
      logger.info('[Alias] Fetching product by slug', { slug });

      const product = await this.productsService!.getBySlug(slug);

      const duration = Date.now() - startTime;
      logger.info('[Alias] Product fetched', {
        slug,
        sku: product.sku,
        brand: product.brand,
        duration,
      });

      return product;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[Alias] Product fetch failed', {
        slug,
        error: error instanceof Error ? error.message : 'Unknown',
        duration,
      });
      throw error;
    }
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string): Promise<GoatProduct | null> {
    this.ensureClient();

    const startTime = Date.now();

    try {
      logger.info('[Alias] Fetching product by SKU', { sku });

      const product = await this.productsService!.getBySku(sku);

      const duration = Date.now() - startTime;
      if (product) {
        logger.info('[Alias] Product found by SKU', {
          sku,
          productId: product.id,
          duration,
        });
      } else {
        logger.warn('[Alias] Product not found by SKU', { sku, duration });
      }

      return product;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[Alias] Product SKU lookup failed', {
        sku,
        error: error instanceof Error ? error.message : 'Unknown',
        duration,
      });
      throw error;
    }
  }

  /**
   * Get buy bar data (pricing) for product
   */
  async getBuyBarData(productTemplateId: string, countryCode: string = 'GB'): Promise<GoatBuyBarData> {
    this.ensureClient();

    const startTime = Date.now();

    try {
      logger.info('[Alias] Fetching buy bar data', {
        productTemplateId,
        countryCode,
      });

      const buyBarData = await this.productsService!.getBuyBarData(productTemplateId, countryCode);

      const duration = Date.now() - startTime;
      logger.info('[Alias] Buy bar data fetched', {
        productTemplateId,
        variantCount: buyBarData.variants.length,
        currency: buyBarData.currency,
        duration,
      });

      return buyBarData;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[Alias] Buy bar data fetch failed', {
        productTemplateId,
        error: error instanceof Error ? error.message : 'Unknown',
        duration,
      });
      throw error;
    }
  }

  // ==========================================================================
  // Listings Operations (Read-only for Phase 1)
  // ==========================================================================

  /**
   * Get all listings for authenticated seller
   */
  async getListings(params?: {
    status?: 'active' | 'sold' | 'cancelled' | 'expired';
    page?: number;
    limit?: number;
  }): Promise<GoatListing[]> {
    this.ensureClient();

    const startTime = Date.now();

    try {
      logger.info('[Alias] Fetching listings', {
        status: params?.status,
        page: params?.page,
        limit: params?.limit,
      });

      const listings = await this.listingsService!.getAll(params);

      const duration = Date.now() - startTime;
      logger.info('[Alias] Listings fetched', {
        count: listings.length,
        status: params?.status,
        duration,
      });

      return listings;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[Alias] Listings fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown',
        duration,
      });
      throw error;
    }
  }

  /**
   * Get listing by ID
   */
  async getListingById(listingId: string): Promise<GoatListing> {
    this.ensureClient();

    const startTime = Date.now();

    try {
      logger.info('[Alias] Fetching listing by ID', { listingId });

      const listing = await this.listingsService!.getById(listingId);

      const duration = Date.now() - startTime;
      logger.info('[Alias] Listing fetched', {
        listingId,
        sku: listing.sku,
        status: listing.status,
        duration,
      });

      return listing;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[Alias] Listing fetch failed', {
        listingId,
        error: error instanceof Error ? error.message : 'Unknown',
        duration,
      });
      throw error;
    }
  }

  /**
   * Get status breakdown (active, sold, cancelled counts)
   */
  async getListingsStatusBreakdown(): Promise<Record<string, number>> {
    this.ensureClient();

    const startTime = Date.now();

    try {
      logger.info('[Alias] Fetching listings status breakdown');

      const breakdown = await this.listingsService!.getStatusBreakdown();

      const duration = Date.now() - startTime;
      logger.info('[Alias] Status breakdown fetched', {
        breakdown,
        duration,
      });

      return breakdown;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[Alias] Status breakdown fetch failed', {
        error: error instanceof Error ? error.message : 'Unknown',
        duration,
      });
      throw error;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create Alias service with global credentials (for system operations)
 * Returns null if Alias is not enabled or not configured
 */
export function createAliasService(): AliasService | null {
  if (!isAliasEnabled()) {
    logger.info('[Alias] Service creation skipped - feature disabled');
    return null;
  }

  if (!isAliasFullyConfigured()) {
    logger.warn('[Alias] Service creation skipped - not fully configured');
    return null;
  }

  try {
    // For system operations, we'd need a system-level access token
    // For now, return service without token (will fail on actual calls)
    // TODO: Implement system OAuth flow
    logger.warn('[Alias] Creating service without token - TODO: implement system OAuth');
    return new AliasService();
  } catch (error) {
    logger.error('[Alias] Service creation failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

/**
 * Create Alias service for a specific user (from database token)
 * @param userId User ID to load token for
 * @returns Alias service or null if not connected
 */
export async function createUserAliasService(userId: string): Promise<AliasService | null> {
  if (!isAliasEnabled()) {
    logger.info('[Alias] User service creation skipped - feature disabled', { userId });
    return null;
  }

  try {
    // TODO: Fetch user's access token from alias_accounts table
    // const supabase = await createClient();
    // const { data: account } = await supabase
    //   .from('alias_accounts')
    //   .select('access_token, token_expires_at, status')
    //   .eq('user_id', userId)
    //   .eq('status', 'active')
    //   .single();
    //
    // if (!account) {
    //   logger.info('[Alias] User has no connected account', { userId });
    //   return null;
    // }
    //
    // // Check if token expired
    // if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
    //   logger.warn('[Alias] User token expired', { userId });
    //   // TODO: Attempt refresh
    //   return null;
    // }
    //
    // return new AliasService(account.access_token);

    logger.warn('[Alias] User service creation not implemented - TODO', { userId });
    return null;
  } catch (error) {
    logger.error('[Alias] User service creation failed', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

/**
 * Check if user has Alias connected
 */
export async function isUserAliasConnected(userId: string): Promise<boolean> {
  if (!isAliasEnabled()) {
    return false;
  }

  try {
    // TODO: Query alias_accounts table
    // const supabase = await createClient();
    // const { data } = await supabase
    //   .from('alias_accounts')
    //   .select('id')
    //   .eq('user_id', userId)
    //   .eq('status', 'active')
    //   .single();
    //
    // return !!data;

    return false; // TODO
  } catch (error) {
    logger.error('[Alias] User connection check failed', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}
