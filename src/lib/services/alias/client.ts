/**
 * Alias API Client
 * Handles all communication with the Alias API using PAT authentication
 */

import {
  AliasAPIError,
  AliasAuthenticationError,
  AliasCatalogNotFoundError,
  AliasListingError,
  AliasPricingError,
} from './errors';
import type {
  SearchCatalogResponse,
  GetCatalogItemResponse,
  ListPricingInsightsResponse,
  GetPricingInsightsResponse,
  OfferHistogramResponse,
  ListingHistogramResponse,
  CreateListingParams,
  CreateListingResponse,
  GetListingResponse,
  UpdateListingParams,
  UpdateListingResponse,
  ListListingsResponse,
  DeleteListingResponse,
  CreateBatchListingsParams,
  CreateBatchListingsResponse,
  GetBatchOperationResponse,
  ListOrdersResponse,
  GetOrderResponse,
  ListPayoutsResponse,
  GetPayoutResponse,
  TestResponse,
  ListRegionsResponse,
  PaginationParams,
  ProductCondition,
  PackagingCondition,
} from './types';

export class AliasClient {
  private readonly baseURL = 'https://api.alias.org/api/v1';
  private readonly pat: string;

  constructor(pat: string) {
    if (!pat || pat.trim() === '') {
      throw new AliasAuthenticationError('Personal Access Token (PAT) is required');
    }
    this.pat = pat;
  }

  // ============================================================================
  // CORE REQUEST METHOD
  // ============================================================================

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.pat}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      // Log raw response for debugging
      const responseText = await response.text();
      console.error('[Alias Client] Error response:', {
        endpoint,
        url,
        status: response.status,
        statusText: response.statusText,
        body: responseText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      // Try to parse as JSON
      let apiError: any = undefined;
      try {
        apiError = JSON.parse(responseText);
      } catch {
        // Not JSON, use raw text
      }

      throw new AliasAPIError(
        apiError?.message || `Alias API error: ${response.status} ${response.statusText}`,
        response.status,
        apiError,
        response,
        endpoint,
        responseText
      );
    }

    // Handle empty responses (e.g., DELETE operations)
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // TEST ENDPOINT
  // ============================================================================

  /**
   * Test endpoint to verify PAT is valid
   */
  async test(): Promise<TestResponse> {
    return this.request<TestResponse>('/test');
  }

  /**
   * List all available regions
   * @returns List of regions with their IDs and names
   */
  async listRegions(): Promise<ListRegionsResponse> {
    return this.request<ListRegionsResponse>('/regions');
  }

  // ============================================================================
  // CATALOG ENDPOINTS
  // ============================================================================

  /**
   * Search the catalog for items
   * @param query - Search term (e.g., 'Nike', 'Air Max Plus Baltic Blue', '555088 063')
   * @param pagination - Pagination parameters
   */
  async searchCatalog(
    query: string,
    pagination?: PaginationParams
  ): Promise<SearchCatalogResponse> {
    const params = new URLSearchParams({ query });
    if (pagination?.limit) {
      params.append('limit', pagination.limit.toString());
    }
    if (pagination?.pagination_token) {
      params.append('pagination_token', pagination.pagination_token);
    }

    return this.request<SearchCatalogResponse>(`/catalog?${params}`);
  }

  /**
   * Get a specific catalog item by ID
   * @param catalogId - Catalog ID (e.g., 'air-jordan-5-retro-grape-2025-hq7978-100')
   */
  async getCatalogItem(catalogId: string): Promise<GetCatalogItemResponse> {
    try {
      return await this.request<GetCatalogItemResponse>(`/catalog/${catalogId}`);
    } catch (error) {
      if (error instanceof AliasAPIError && error.isNotFoundError()) {
        throw new AliasCatalogNotFoundError(catalogId);
      }
      throw error;
    }
  }

  // ============================================================================
  // PRICING INSIGHTS ENDPOINTS
  // ============================================================================

  /**
   * Get pricing insights for all variations of a catalog item
   * @param catalogId - Catalog ID
   * @param regionId - Optional region ID (empty = global)
   * @param consigned - Optional consigned filter
   */
  async listPricingInsights(
    catalogId: string,
    regionId?: string,
    consigned?: boolean
  ): Promise<ListPricingInsightsResponse> {
    const params = new URLSearchParams();
    if (regionId !== undefined) params.append('region_id', regionId);
    if (consigned !== undefined) params.append('consigned', consigned.toString());

    const query = params.toString();
    const endpoint = `/pricing_insights/availabilities/${catalogId}${query ? `?${query}` : ''}`;

    try {
      return await this.request<ListPricingInsightsResponse>(endpoint);
    } catch (error) {
      if (error instanceof AliasAPIError) {
        throw new AliasPricingError(error.message, error.statusCode, error.apiError);
      }
      throw error;
    }
  }

  /**
   * Get pricing insights for a specific variation
   * @param params - Pricing parameters
   */
  async getPricingInsights(params: {
    catalog_id: string;
    size: number;
    product_condition: ProductCondition;
    packaging_condition: PackagingCondition;
    consigned?: boolean;
    region_id?: string;
  }): Promise<GetPricingInsightsResponse> {
    const searchParams = new URLSearchParams({
      catalog_id: params.catalog_id,
      size: params.size.toString(),
      product_condition: params.product_condition,
      packaging_condition: params.packaging_condition,
    });

    if (params.consigned !== undefined) {
      searchParams.append('consigned', params.consigned.toString());
    }
    if (params.region_id !== undefined) {
      searchParams.append('region_id', params.region_id);
    }

    try {
      return await this.request<GetPricingInsightsResponse>(
        `/pricing_insights/availability?${searchParams}`
      );
    } catch (error) {
      if (error instanceof AliasAPIError) {
        throw new AliasPricingError(error.message, error.statusCode, error.apiError);
      }
      throw error;
    }
  }

  /**
   * Get offer price distribution (histogram)
   */
  async getOfferHistogram(params: {
    catalog_id: string;
    size: number;
    product_condition: ProductCondition;
    packaging_condition: PackagingCondition;
    consigned?: boolean;
    region_id?: string;
  }): Promise<OfferHistogramResponse> {
    const searchParams = new URLSearchParams({
      catalog_id: params.catalog_id,
      size: params.size.toString(),
      product_condition: params.product_condition,
      packaging_condition: params.packaging_condition,
    });

    if (params.consigned !== undefined) {
      searchParams.append('consigned', params.consigned.toString());
    }
    if (params.region_id !== undefined) {
      searchParams.append('region_id', params.region_id);
    }

    return this.request<OfferHistogramResponse>(
      `/pricing_insights/offer_histogram?${searchParams}`
    );
  }

  /**
   * Get listing price distribution (histogram)
   */
  async getListingHistogram(params: {
    catalog_id: string;
    size: number;
    product_condition: ProductCondition;
    packaging_condition: PackagingCondition;
    consigned?: boolean;
    region_id?: string;
  }): Promise<ListingHistogramResponse> {
    const searchParams = new URLSearchParams({
      catalog_id: params.catalog_id,
      size: params.size.toString(),
      product_condition: params.product_condition,
      packaging_condition: params.packaging_condition,
    });

    if (params.consigned !== undefined) {
      searchParams.append('consigned', params.consigned.toString());
    }
    if (params.region_id !== undefined) {
      searchParams.append('region_id', params.region_id);
    }

    return this.request<ListingHistogramResponse>(
      `/pricing_insights/listing_histogram?${searchParams}`
    );
  }

  // ============================================================================
  // LISTING ENDPOINTS
  // ============================================================================

  /**
   * Create a single listing
   */
  async createListing(params: CreateListingParams): Promise<CreateListingResponse> {
    const body: any = {
      catalog_id: params.catalog_id,
      price_cents: params.price_cents,
      condition: params.condition,
      packaging_condition: params.packaging_condition,
      size: params.size,
      size_unit: params.size_unit,
    };

    if (params.activate !== undefined) {
      body.activate = params.activate;
    }
    if (params.defects && params.defects.length > 0) {
      body.defects = params.defects;
    }
    if (params.additional_defects) {
      body.additional_defects = params.additional_defects;
    }
    if (params.metadata) {
      body.metadata = params.metadata;
    }

    console.log('[Alias Client] Creating listing with JSON body:', JSON.stringify(body, null, 2));

    try {
      return await this.request<CreateListingResponse>('/listings', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof AliasAPIError) {
        throw new AliasListingError(error.message, error.statusCode, error.apiError);
      }
      throw error;
    }
  }

  /**
   * Get a single listing by ID
   */
  async getListing(listingId: string): Promise<GetListingResponse> {
    return this.request<GetListingResponse>(`/listings/${listingId}`);
  }

  /**
   * Update a listing
   */
  async updateListing(
    listingId: string,
    params: UpdateListingParams
  ): Promise<UpdateListingResponse> {
    const searchParams = new URLSearchParams();

    if (params.price_cents !== undefined) {
      searchParams.append('price_cents', params.price_cents.toString());
    }
    if (params.condition !== undefined) {
      searchParams.append('condition', params.condition);
    }
    if (params.packaging_condition !== undefined) {
      searchParams.append('packaging_condition', params.packaging_condition);
    }
    if (params.defects && params.defects.length > 0) {
      params.defects.forEach(defect => searchParams.append('defects', defect));
    }
    if (params.additional_defects !== undefined) {
      searchParams.append('additional_defects', params.additional_defects);
    }
    if (params.metadata) {
      searchParams.append('metadata', JSON.stringify(params.metadata));
    }

    try {
      return await this.request<UpdateListingResponse>(`/listings/${listingId}`, {
        method: 'PATCH',
        body: searchParams.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      if (error instanceof AliasAPIError) {
        throw new AliasListingError(error.message, error.statusCode, error.apiError);
      }
      throw error;
    }
  }

  /**
   * Delete a listing
   */
  async deleteListing(listingId: string): Promise<DeleteListingResponse> {
    return this.request<DeleteListingResponse>(`/listings/${listingId}`, {
      method: 'DELETE',
    });
  }

  /**
   * List all listings
   */
  async listListings(pagination?: PaginationParams): Promise<ListListingsResponse> {
    const params = new URLSearchParams();
    if (pagination?.limit) {
      params.append('limit', pagination.limit.toString());
    }
    if (pagination?.pagination_token) {
      params.append('pagination_token', pagination.pagination_token);
    }

    const query = params.toString();
    return this.request<ListListingsResponse>(`/listings${query ? `?${query}` : ''}`);
  }

  /**
   * Activate a listing
   */
  async activateListing(listingId: string): Promise<UpdateListingResponse> {
    return this.request<UpdateListingResponse>(`/listings/${listingId}/activate`, {
      method: 'POST',
    });
  }

  /**
   * Deactivate a listing
   */
  async deactivateListing(listingId: string): Promise<UpdateListingResponse> {
    return this.request<UpdateListingResponse>(`/listings/${listingId}/deactivate`, {
      method: 'POST',
    });
  }

  // ============================================================================
  // BATCH OPERATIONS ENDPOINTS
  // ============================================================================

  /**
   * Create multiple listings in a batch
   */
  async createBatchListings(
    params: CreateBatchListingsParams
  ): Promise<CreateBatchListingsResponse> {
    return this.request<CreateBatchListingsResponse>('/listings/batch', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Get status of a batch operation
   */
  async getBatchOperation(batchId: string): Promise<GetBatchOperationResponse> {
    return this.request<GetBatchOperationResponse>(`/batch_operations/${batchId}`);
  }

  // ============================================================================
  // ORDER ENDPOINTS
  // ============================================================================

  /**
   * List orders
   */
  async listOrders(pagination?: PaginationParams): Promise<ListOrdersResponse> {
    const params = new URLSearchParams();
    if (pagination?.limit) {
      params.append('limit', pagination.limit.toString());
    }
    if (pagination?.pagination_token) {
      params.append('pagination_token', pagination.pagination_token);
    }

    const query = params.toString();
    return this.request<ListOrdersResponse>(`/orders${query ? `?${query}` : ''}`);
  }

  /**
   * Get a specific order
   */
  async getOrder(orderId: string): Promise<GetOrderResponse> {
    return this.request<GetOrderResponse>(`/orders/${orderId}`);
  }

  // ============================================================================
  // PAYOUT ENDPOINTS
  // ============================================================================

  /**
   * List payouts
   */
  async listPayouts(pagination?: PaginationParams): Promise<ListPayoutsResponse> {
    const params = new URLSearchParams();
    if (pagination?.limit) {
      params.append('limit', pagination.limit.toString());
    }
    if (pagination?.pagination_token) {
      params.append('pagination_token', pagination.pagination_token);
    }

    const query = params.toString();
    return this.request<ListPayoutsResponse>(`/payouts${query ? `?${query}` : ''}`);
  }

  /**
   * Get a specific payout
   */
  async getPayout(payoutId: string): Promise<GetPayoutResponse> {
    return this.request<GetPayoutResponse>(`/payouts/${payoutId}`);
  }
}

/**
 * Get the server-side Alias PAT token
 * TEMPORARY: Phase 1 uses a single PAT from env for all requests
 * Phase 2 will use per-user tokens from alias_credentials
 */
function getServerAliasToken(): string {
  const token = process.env.ALIAS_PAT;

  if (!token) {
    console.error('[Alias] Missing ALIAS_PAT environment variable');
    throw new Error('Alias API token is not configured');
  }

  // TEMP: log first few characters so we can confirm it's consistent across routes
  console.log('[Alias] Using ALIAS_PAT (first 8 chars):', token.slice(0, 8));

  return token;
}

/**
 * Create an AliasClient instance from environment variable
 * Uses the standardized token helper to ensure consistency
 */
export function createAliasClient(): AliasClient {
  const pat = getServerAliasToken();
  return new AliasClient(pat);
}
