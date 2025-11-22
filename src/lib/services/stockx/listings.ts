// @ts-nocheck
/**
 * StockX Listings Service - Public API v2
 * Handles all listing operations using StockX Public API v2
 *
 * Key patterns:
 * - All mutation operations (create, update, delete, activate) are ASYNC
 * - Returns operationId for polling
 * - Use currencyCode (not currency)
 * - All endpoints under /v2/selling/listings
 */

import { getStockxClient } from './client'

// ============================================================================
// Types
// ============================================================================

export interface CreateListingRequest {
  productId: string
  variantId: string
  amount: number | string
  currencyCode?: string
  quantity?: number
  expiresAt?: string
}

export interface UpdateListingRequest {
  amount?: number | string
  currencyCode?: string
  expiresAt?: string
}

export interface ListingFilters {
  status?: 'active' | 'inactive' | 'pending' | 'expired'
  page?: number
  limit?: number
}

export interface ListingOperation {
  operationId: string
  status: 'pending' | 'completed' | 'failed'
  result?: any
  error?: string
}

export interface Listing {
  id: string
  productId: string
  variantId: string
  amount: {
    amount: string
    currencyCode: string
  }
  quantity: number
  status: 'active' | 'inactive' | 'pending' | 'expired'
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface ListingWithPayout extends Listing {
  payout?: {
    amount: string
    currencyCode: string
    breakdown: {
      commissionRate: number
      commissionAmount: string
      adjustments: Array<{
        type: string
        amount: string
        description: string
      }>
    }
  }
}

// ============================================================================
// StockX Listings Service
// ============================================================================

export class StockxListingsService {
  /**
   * Create a new ask listing
   * POST /v2/selling/listings
   * Returns operationId for async polling
   */
  static async createListing(
    userId: string,
    request: CreateListingRequest
  ): Promise<ListingOperation> {
    const client = getStockxClient(userId)

    const payload = {
      amount: String(request.amount),  // Must be string per StockX API docs
      variantId: String(request.variantId),
      currencyCode: request.currencyCode || 'GBP',
      expiresAt: request.expiresAt,
      active: true,
      inventoryType: 'STANDARD',
    }

    console.log('[StockX Listings] Creating listing', {
      userId,
      payload: JSON.stringify(payload, null, 2),
      productIdType: typeof request.productId,
      variantIdType: typeof request.variantId,
      amountType: typeof request.amount,
    })

    const response = await client.request('/v2/selling/listings', {
      method: 'POST',
      body: payload,
    })

    return {
      operationId: response.operationId,
      status: response.status || 'pending',
      result: response.result,
    }
  }

  /**
   * Get all listings for the authenticated user
   * GET /v2/selling/listings
   * Supports pagination and filtering
   */
  static async getAllListings(
    userId: string,
    filters: ListingFilters = {}
  ): Promise<{ listings: Listing[]; total: number; page: number; limit: number }> {
    const client = getStockxClient(userId)

    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))

    const queryString = params.toString()
    const endpoint = queryString
      ? `/v2/selling/listings?${queryString}`
      : '/v2/selling/listings'

    console.log('[StockX Listings] Fetching all listings', { userId, filters })

    const response = await client.request(endpoint)

    return {
      listings: response.data || [],
      total: response.pagination?.total || 0,
      page: response.pagination?.page || 1,
      limit: response.pagination?.limit || 20,
    }
  }

  /**
   * Get a single listing by ID with payout breakdown
   * GET /v2/selling/listings/{listingId}
   */
  static async getListingById(
    userId: string,
    listingId: string
  ): Promise<ListingWithPayout> {
    const client = getStockxClient(userId)

    console.log('[StockX Listings] Fetching listing', { userId, listingId })

    const response = await client.request(`/v2/selling/listings/${listingId}`)

    return response.data
  }

  /**
   * Update an existing listing
   * PATCH /v2/selling/listings/{listingId}
   * Returns operationId for async polling
   */
  static async updateListing(
    userId: string,
    listingId: string,
    updates: UpdateListingRequest
  ): Promise<ListingOperation> {
    const client = getStockxClient(userId)

    const payload: any = {}
    if (updates.amount !== undefined) {
      payload.amount = {
        amount: String(updates.amount),
        currencyCode: updates.currencyCode || 'USD',
      }
    }
    if (updates.expiresAt) {
      payload.expiresAt = updates.expiresAt
    }

    console.log('[StockX Listings] Updating listing', { userId, listingId, payload })

    const response = await client.request(`/v2/selling/listings/${listingId}`, {
      method: 'PATCH',
      body: payload,
    })

    return {
      operationId: response.operationId,
      status: response.status || 'pending',
      result: response.result,
    }
  }

  /**
   * Delete (cancel) a listing
   * DELETE /v2/selling/listings/{listingId}
   * Returns operationId for async polling
   */
  static async deleteListing(
    userId: string,
    listingId: string
  ): Promise<ListingOperation> {
    const client = getStockxClient(userId)

    console.log('[StockX Listings] Deleting listing', { userId, listingId })

    const response = await client.request(`/v2/selling/listings/${listingId}`, {
      method: 'DELETE',
    })

    return {
      operationId: response.operationId,
      status: response.status || 'pending',
    }
  }

  /**
   * Activate an inactive listing
   * PUT /v2/selling/listings/{listingId}/activate
   * Returns operationId for async polling
   */
  static async activateListing(
    userId: string,
    listingId: string
  ): Promise<ListingOperation> {
    const client = getStockxClient(userId)

    console.log('[StockX Listings] Activating listing', { userId, listingId })

    const response = await client.request(
      `/v2/selling/listings/${listingId}/activate`,
      {
        method: 'PUT',
      }
    )

    return {
      operationId: response.operationId,
      status: response.status || 'pending',
      result: response.result,
    }
  }

  /**
   * Get status of a specific listing operation
   * GET /v2/selling/listings/{listingId}/operations/{operationId}
   */
  static async getListingOperation(
    userId: string,
    listingId: string,
    operationId: string
  ): Promise<ListingOperation> {
    const client = getStockxClient(userId)

    console.log('[StockX Listings] Fetching operation', {
      userId,
      listingId,
      operationId,
    })

    const response = await client.request(
      `/v2/selling/listings/${listingId}/operations/${operationId}`
    )

    return {
      operationId: response.data.operationId,
      status: response.data.status,
      result: response.data.result,
      error: response.data.error,
    }
  }

  /**
   * Get all operations for a listing
   * GET /v2/selling/listings/{listingId}/operations
   */
  static async getAllListingOperations(
    userId: string,
    listingId: string
  ): Promise<ListingOperation[]> {
    const client = getStockxClient(userId)

    console.log('[StockX Listings] Fetching all operations', { userId, listingId })

    const response = await client.request(
      `/v2/selling/listings/${listingId}/operations`
    )

    return (response.data || []).map((op: any) => ({
      operationId: op.operationId,
      status: op.status,
      result: op.result,
      error: op.error,
    }))
  }

  /**
   * Poll an operation until completion
   * Retries every 1 second for up to 30 seconds
   */
  static async pollOperation(
    userId: string,
    listingId: string,
    operationId: string,
    maxAttempts = 30,
    intervalMs = 1000
  ): Promise<ListingOperation> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const operation = await this.getListingOperation(userId, listingId, operationId)

      if (operation.status === 'completed' || operation.status === 'failed') {
        console.log('[StockX Listings] Operation finished', {
          operationId,
          status: operation.status,
          attempts: attempt + 1,
        })
        return operation
      }

      console.log('[StockX Listings] Operation pending, retrying...', {
        operationId,
        attempt: attempt + 1,
        maxAttempts,
      })

      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error(`Operation ${operationId} timed out after ${maxAttempts} attempts`)
  }
}
