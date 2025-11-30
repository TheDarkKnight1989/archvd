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
  listingId?: string | null
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

    // Log FULL raw response to see what StockX actually returns
    console.log('[StockX Listings] FULL RAW API RESPONSE:', JSON.stringify(response, null, 2))

    // Extract listing ID - StockX returns it at top level even when operation is pending
    const listingId = response.listingId || response.result?.id || null

    console.log('[StockX Listings] Extracted listing ID:', listingId)

    return {
      operationId: response.operationId,
      status: response.operationStatus || response.status || 'pending',
      listingId: listingId,
      result: response.result,
    }
  }

  /**
   * Get all listings for the authenticated user
   * GET /v2/selling/listings
   * Supports pagination and filtering
   *
   * Note: Internal params (page, limit, status) are mapped to StockX API params
   * (pageNumber, pageSize, listingStatuses) for API compliance
   */
  static async getAllListings(
    userId: string,
    filters: ListingFilters = {}
  ): Promise<{ listings: Listing[]; total: number; page: number; limit: number }> {
    const client = getStockxClient(userId)

    const params = new URLSearchParams()
    // Map our internal param names to StockX API param names
    if (filters.status) params.append('listingStatuses', filters.status) // StockX uses listingStatuses (plural, comma-separated)
    if (filters.page) params.append('pageNumber', String(filters.page)) // StockX uses pageNumber
    if (filters.limit) params.append('pageSize', String(filters.limit)) // StockX uses pageSize

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
      payload.amount = String(updates.amount)
      payload.currencyCode = updates.currencyCode || 'GBP'
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
      status: response.operationStatus || response.status || 'pending',
      listingId: response.listingId || listingId, // Return the listing ID
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

    try {
      const response = await client.request(`/v2/selling/listings/${listingId}`, {
        method: 'DELETE',
      })

      // Successful deletion - mark local listing as MISSING
      await this.markListingAsMissing(userId, listingId)

      return {
        operationId: response.operationId,
        status: response.operationStatus || response.status || 'completed',
        listingId: listingId,
      }
    } catch (error: any) {
      // Extract status code from error
      const statusCode = error.statusCode || error.status || error.response?.status

      // Check error message patterns
      const errorMessage = error.message || ''
      const isNotFoundError =
        statusCode === 404 ||
        statusCode === 410 ||
        statusCode === 422 ||
        errorMessage.includes('can not perform this action') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('already completed') ||
        errorMessage.includes('inactive')

      // Handle graceful failures (listing already gone)
      if (isNotFoundError) {
        console.warn('[StockX Listings] Listing already gone on StockX:', {
          listingId,
          statusCode,
          errorMessage: errorMessage.substring(0, 200),
        })

        // Mark as MISSING locally even though StockX returned error
        await this.markListingAsMissing(userId, listingId)

        // Return success with warning
        return {
          operationId: 'ghost-deletion',
          status: 'completed',
          listingId: listingId,
          error: 'Listing not found on StockX (already deleted/sold/expired). Local state updated.',
        }
      }

      // Handle 401 errors (real auth failure - DO NOT mark as missing)
      if (statusCode === 401) {
        console.error('[StockX Listings] Auth error during delete:', {
          listingId,
          statusCode,
          errorMessage: errorMessage.substring(0, 200),
        })
        throw new Error('StockX authentication failed. Please reconnect your account.')
      }

      // Other errors - propagate
      console.error('[StockX Listings] Delete failed with error:', {
        listingId,
        statusCode,
        errorMessage: errorMessage.substring(0, 200),
      })
      throw error
    }
  }

  /**
   * Helper: Mark a listing as MISSING in local database
   * Used when StockX confirms listing no longer exists
   */
  private static async markListingAsMissing(
    userId: string,
    listingId: string
  ): Promise<void> {
    try {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()

      const nowIso = new Date().toISOString()

      // Update via items join to ensure RLS compliance
      const { error } = await supabase
        .from('inventory_market_links')
        .update({
          stockx_listing_status: 'MISSING',
          stockx_last_listing_sync_at: nowIso,
          stockx_listing_payload: null,
        })
        .eq('stockx_listing_id', listingId)

      if (error) {
        console.error('[StockX Listings] Failed to mark listing as MISSING:', {
          listingId,
          error: error.message,
        })
        // Don't throw - deletion already succeeded on StockX
      } else {
        console.log('[StockX Listings] Marked listing as MISSING locally:', {
          listingId,
        })
      }
    } catch (error: any) {
      console.error('[StockX Listings] Exception marking listing as MISSING:', {
        listingId,
        error: error.message,
      })
      // Don't throw - deletion already succeeded on StockX
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
      status: response.operationStatus || response.status || 'pending',
      listingId: response.listingId || listingId,
      result: response.result,
    }
  }

  /**
   * Deactivate an active listing (pause without deleting)
   * POST /v2/selling/listings/{listingId}/deactivate
   * Returns operationId for async polling
   */
  static async deactivateListing(
    userId: string,
    listingId: string
  ): Promise<ListingOperation> {
    const client = getStockxClient(userId)

    console.log('[StockX Listings] Deactivating listing', { userId, listingId })

    const response = await client.request(
      `/v2/selling/listings/${listingId}/deactivate`,
      {
        method: 'POST',
      }
    )

    return {
      operationId: response.operationId,
      status: response.operationStatus || response.status || 'pending',
      listingId: response.listingId || listingId,
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
