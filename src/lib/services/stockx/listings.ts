/**
 * StockX Listings Service (V2 API)
 * Handles all listing operations: create, update, delete, activate, deactivate
 * Includes async operation tracking and fee calculation
 */

import { getStockxClient } from './client'
import { isStockxMockMode } from '@/lib/config/stockx'
import { createClient } from '@/lib/supabase/server'
import type { StockxListingEntity, StockxBatchJobEntity } from '@/lib/stockx/types'

// ============================================================================
// Types
// ============================================================================

export interface ListingCreateParams {
  productId: string // StockX product ID
  variantId: string // StockX variant ID
  amount: number // Ask price
  currency: string // USD, GBP, EUR
  quantity?: number // Default: 1
  expiresAt?: string // ISO timestamp
}

export interface ListingUpdateParams {
  listingId: string // StockX listing ID
  amount?: number // New ask price
  expiresAt?: string // New expiry
}

export interface StockxListingResponse {
  id: string // StockX listing ID
  productId: string
  variantId: string
  amount: number
  currency: string
  quantity: number
  status: string // ACTIVE, INACTIVE, MATCHED, COMPLETED, EXPIRED
  expiresAt: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, any>
}

export interface StockxOperationResponse {
  operationId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: any
  error?: string
}

export interface ListingFeeEstimate {
  askPrice: number
  transactionFee: number
  transactionFeeRate: number
  processingFee: number
  processingFeeRate: number
  totalFee: number
  netPayout: number
  sellerLevel: number
  nextLevelSavings?: number
}

// ============================================================================
// Fee Calculator
// ============================================================================

const SELLER_LEVEL_FEES = {
  1: 0.090, // 9.0%
  2: 0.085, // 8.5%
  3: 0.080, // 8.0%
  4: 0.075, // 7.5%
  5: 0.070, // 7.0%
}

const PROCESSING_FEE_RATE = 0.03 // 3.0% constant

export function calculateListingFees(
  askPrice: number,
  sellerLevel: number = 1
): ListingFeeEstimate {
  const transactionFeeRate = SELLER_LEVEL_FEES[sellerLevel as keyof typeof SELLER_LEVEL_FEES] || SELLER_LEVEL_FEES[1]
  const processingFeeRate = PROCESSING_FEE_RATE

  const transactionFee = Math.round(askPrice * transactionFeeRate * 100) / 100
  const processingFee = Math.round(askPrice * processingFeeRate * 100) / 100
  const totalFee = transactionFee + processingFee
  const netPayout = askPrice - totalFee

  // Calculate savings if user levels up
  let nextLevelSavings: number | undefined
  if (sellerLevel < 5) {
    const nextLevelFeeRate = SELLER_LEVEL_FEES[(sellerLevel + 1) as keyof typeof SELLER_LEVEL_FEES]
    const nextLevelTransactionFee = askPrice * nextLevelFeeRate
    nextLevelSavings = transactionFee - nextLevelTransactionFee
  }

  return {
    askPrice,
    transactionFee,
    transactionFeeRate,
    processingFee,
    processingFeeRate,
    totalFee,
    netPayout,
    sellerLevel,
    nextLevelSavings,
  }
}

// ============================================================================
// Mock Mode Helpers
// ============================================================================

function generateMockListingId(): string {
  return `mock-listing-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

function generateMockOperationId(): string {
  return `mock-op-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

function createMockListingResponse(params: ListingCreateParams): StockxListingResponse {
  return {
    id: generateMockListingId(),
    productId: params.productId,
    variantId: params.variantId,
    amount: params.amount,
    currency: params.currency,
    quantity: params.quantity || 1,
    status: 'ACTIVE',
    expiresAt: params.expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Listing Service
// ============================================================================

export class StockxListingsService {
  /**
   * Create a new listing on StockX
   * Returns operation ID for async tracking
   */
  static async createListing(params: ListingCreateParams): Promise<StockxOperationResponse> {
    console.log('[StockX Listings] Creating listing:', params)

    // Mock mode
    if (isStockxMockMode()) {
      console.log('[StockX Listings] Mock mode - simulating create')
      const mockListing = createMockListingResponse(params)
      return {
        operationId: generateMockOperationId(),
        status: 'completed',
        result: mockListing,
      }
    }

    // Real API
    try {
      const client = getStockxClient()
      const response = await client.request<{ operationId: string }>('/v2/listings', {
        method: 'POST',
        body: JSON.stringify({
          productId: params.productId,
          variantId: params.variantId,
          amount: params.amount,
          currency: params.currency,
          quantity: params.quantity || 1,
          expiresAt: params.expiresAt,
        }),
      })

      console.log('[StockX Listings] Create operation started:', response.operationId)

      return {
        operationId: response.operationId,
        status: 'pending',
      }
    } catch (error: any) {
      console.error('[StockX Listings] Create failed:', error)
      throw new Error(`Failed to create listing: ${error.message}`)
    }
  }

  /**
   * Update an existing listing
   * Returns operation ID for async tracking
   */
  static async updateListing(params: ListingUpdateParams): Promise<StockxOperationResponse> {
    console.log('[StockX Listings] Updating listing:', params)

    // Mock mode
    if (isStockxMockMode()) {
      console.log('[StockX Listings] Mock mode - simulating update')
      return {
        operationId: generateMockOperationId(),
        status: 'completed',
        result: { id: params.listingId, ...params },
      }
    }

    // Real API
    try {
      const client = getStockxClient()
      const response = await client.request<{ operationId: string }>(
        `/v2/listings/${params.listingId}`,
        {
          method: 'PUT' as any,
          body: JSON.stringify({
            amount: params.amount,
            expiresAt: params.expiresAt,
          }),
        }
      )

      console.log('[StockX Listings] Update operation started:', response.operationId)

      return {
        operationId: response.operationId,
        status: 'pending',
      }
    } catch (error: any) {
      console.error('[StockX Listings] Update failed:', error)
      throw new Error(`Failed to update listing: ${error.message}`)
    }
  }

  /**
   * Delete a listing from StockX
   * Returns operation ID for async tracking
   */
  static async deleteListing(listingId: string): Promise<StockxOperationResponse> {
    console.log('[StockX Listings] Deleting listing:', listingId)

    // Mock mode
    if (isStockxMockMode()) {
      console.log('[StockX Listings] Mock mode - simulating delete')
      return {
        operationId: generateMockOperationId(),
        status: 'completed',
        result: { id: listingId, status: 'DELETED' },
      }
    }

    // Real API
    try {
      const client = getStockxClient()
      const response = await client.request<{ operationId: string }>(
        `/v2/listings/${listingId}`,
        {
          method: 'DELETE',
        }
      )

      console.log('[StockX Listings] Delete operation started:', response.operationId)

      return {
        operationId: response.operationId,
        status: 'pending',
      }
    } catch (error: any) {
      console.error('[StockX Listings] Delete failed:', error)
      throw new Error(`Failed to delete listing: ${error.message}`)
    }
  }

  /**
   * Activate a listing (make it live)
   * Returns operation ID for async tracking
   */
  static async activateListing(listingId: string): Promise<StockxOperationResponse> {
    console.log('[StockX Listings] Activating listing:', listingId)

    // Mock mode
    if (isStockxMockMode()) {
      console.log('[StockX Listings] Mock mode - simulating activate')
      return {
        operationId: generateMockOperationId(),
        status: 'completed',
        result: { id: listingId, status: 'ACTIVE' },
      }
    }

    // Real API
    try {
      const client = getStockxClient()
      const response = await client.request<{ operationId: string }>(
        `/v2/listings/${listingId}/activate`,
        {
          method: 'POST',
        }
      )

      console.log('[StockX Listings] Activate operation started:', response.operationId)

      return {
        operationId: response.operationId,
        status: 'pending',
      }
    } catch (error: any) {
      console.error('[StockX Listings] Activate failed:', error)
      throw new Error(`Failed to activate listing: ${error.message}`)
    }
  }

  /**
   * Deactivate a listing (pause it)
   * Returns operation ID for async tracking
   */
  static async deactivateListing(listingId: string): Promise<StockxOperationResponse> {
    console.log('[StockX Listings] Deactivating listing:', listingId)

    // Mock mode
    if (isStockxMockMode()) {
      console.log('[StockX Listings] Mock mode - simulating deactivate')
      return {
        operationId: generateMockOperationId(),
        status: 'completed',
        result: { id: listingId, status: 'INACTIVE' },
      }
    }

    // Real API
    try {
      const client = getStockxClient()
      const response = await client.request<{ operationId: string }>(
        `/v2/listings/${listingId}/deactivate`,
        {
          method: 'POST',
        }
      )

      console.log('[StockX Listings] Deactivate operation started:', response.operationId)

      return {
        operationId: response.operationId,
        status: 'pending',
      }
    } catch (error: any) {
      console.error('[StockX Listings] Deactivate failed:', error)
      throw new Error(`Failed to deactivate listing: ${error.message}`)
    }
  }

  /**
   * Get listing by ID from StockX
   */
  static async getListing(listingId: string): Promise<StockxListingResponse | null> {
    console.log('[StockX Listings] Fetching listing:', listingId)

    // Mock mode
    if (isStockxMockMode()) {
      console.log('[StockX Listings] Mock mode - returning mock listing')
      return {
        id: listingId,
        productId: 'mock-product',
        variantId: 'mock-variant',
        amount: 150,
        currency: 'USD',
        quantity: 1,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    // Real API
    try {
      const client = getStockxClient()
      const response = await client.request<StockxListingResponse>(`/v2/listings/${listingId}`)

      return response
    } catch (error: any) {
      if (error.message?.includes('404')) {
        return null
      }
      console.error('[StockX Listings] Get listing failed:', error)
      throw error
    }
  }

  /**
   * Get all listings for current user from StockX
   */
  static async getListings(options?: {
    status?: string[]
    limit?: number
    offset?: number
  }): Promise<StockxListingResponse[]> {
    console.log('[StockX Listings] Fetching listings:', options)

    // Mock mode
    if (isStockxMockMode()) {
      console.log('[StockX Listings] Mock mode - returning empty list')
      return []
    }

    // Real API
    try {
      const client = getStockxClient()
      const params = new URLSearchParams()
      if (options?.status) params.set('status', options.status.join(','))
      if (options?.limit) params.set('limit', options.limit.toString())
      if (options?.offset) params.set('offset', options.offset.toString())

      const url = `/v2/listings${params.toString() ? `?${params.toString()}` : ''}`
      const response = await client.request<{ listings: StockxListingResponse[] }>(url)

      return response.listings || []
    } catch (error) {
      console.error('[StockX Listings] Get listings failed:', error)
      return []
    }
  }

  /**
   * Get operation status by ID
   * Used for polling async operations
   */
  static async getListingOperation(operationId: string): Promise<StockxOperationResponse> {
    console.log('[StockX Listings] Fetching operation:', operationId)

    // Mock mode
    if (isStockxMockMode()) {
      console.log('[StockX Listings] Mock mode - returning completed operation')
      return {
        operationId,
        status: 'completed',
        result: { success: true },
      }
    }

    // Real API
    try {
      const client = getStockxClient()
      const response = await client.request<StockxOperationResponse>(
        `/v2/operations/${operationId}`
      )

      return response
    } catch (error) {
      console.error('[StockX Listings] Get operation failed:', error)
      throw error
    }
  }

  /**
   * Save listing to database
   * Upserts into stockx_listings table
   */
  static async saveListingToDatabase(
    userId: string,
    inventoryItemId: string,
    listing: StockxListingResponse
  ): Promise<void> {
    console.log('[StockX Listings] Saving to database:', listing.id)

    const supabase = await createClient()

    // Get internal product/variant UUIDs
    const { data: product } = await supabase
      .from('stockx_products')
      .select('id')
      .eq('stockx_product_id', listing.productId)
      .single()

    const { data: variant } = await supabase
      .from('stockx_variants')
      .select('id')
      .eq('stockx_variant_id', listing.variantId)
      .single()

    if (!product || !variant) {
      throw new Error('StockX product/variant not found in database')
    }

    // Upsert listing
    const listingEntity: Omit<StockxListingEntity, 'id' | 'created_at' | 'updated_at'> = {
      stockx_listing_id: listing.id,
      user_id: userId,
      product_id: product.id,
      variant_id: variant.id,
      stockx_product_id: listing.productId,
      stockx_variant_id: listing.variantId,
      amount: listing.amount,
      currency_code: listing.currency,
      quantity: listing.quantity,
      expiry_time: listing.expiresAt,
      status: listing.status,
      listing_type: 'ASK', // StockX only supports ask listings
      metadata: {},
      deleted_at: undefined,
    }

    const { error } = await supabase
      .from('stockx_listings')
      .upsert(listingEntity, { onConflict: 'stockx_listing_id' })

    if (error) {
      console.error('[StockX Listings] Database save failed:', error)
      throw error
    }

    // Update inventory_market_links with listing ID
    await supabase
      .from('inventory_market_links')
      .update({ stockx_listing_id: listing.id })
      .eq('item_id', inventoryItemId)

    console.log('[StockX Listings] Saved to database successfully')
  }

  /**
   * Track async operation in database
   * Saves to stockx_batch_jobs for polling
   */
  static async trackOperation(
    userId: string,
    operationType: string,
    operationId: string,
    metadata?: any
  ): Promise<string> {
    console.log('[StockX Listings] Tracking operation:', operationId)

    const supabase = await createClient()

    const job: Omit<StockxBatchJobEntity, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      job_type: operationType,
      status: 'pending',
      total_items: 1,
      processed_items: 0,
      failed_items: 0,
      stockx_operation_id: operationId,
      started_at: new Date().toISOString(),
      completed_at: undefined,
      error_message: undefined,
      metadata: metadata || {},
    }

    const { data, error } = await supabase
      .from('stockx_batch_jobs')
      .insert(job)
      .select('id')
      .single()

    if (error) {
      console.error('[StockX Listings] Failed to track operation:', error)
      throw error
    }

    return data.id
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

export interface ValidationError {
  field: string
  message: string
}

export async function validateListingRequest(
  userId: string,
  inventoryItemId: string,
  askPrice: number
): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  const supabase = await createClient()

  // 1. Check inventory item exists and belongs to user
  const { data: item, error: itemError } = await supabase
    .from('Inventory')
    .select('id, status, sku')
    .eq('id', inventoryItemId)
    .eq('user_id', userId)
    .single()

  if (itemError || !item) {
    errors.push({ field: 'inventoryItemId', message: 'Inventory item not found' })
    return errors
  }

  // 2. Check item not already sold
  if (item.status === 'sold') {
    errors.push({ field: 'status', message: 'Cannot list a sold item' })
  }

  // 3. Check StockX mapping exists
  const { data: mapping } = await supabase
    .from('inventory_market_links')
    .select('stockx_product_id, stockx_variant_id, stockx_listing_id')
    .eq('item_id', inventoryItemId)
    .single()

  if (!mapping || !mapping.stockx_product_id || !mapping.stockx_variant_id) {
    errors.push({ field: 'mapping', message: 'No StockX mapping found for this item' })
    return errors
  }

  // 4. Check for active listing
  if (mapping.stockx_listing_id) {
    const { data: existingListing } = await supabase
      .from('stockx_listings')
      .select('status')
      .eq('stockx_listing_id', mapping.stockx_listing_id)
      .single()

    if (existingListing && existingListing.status === 'ACTIVE') {
      errors.push({
        field: 'listing',
        message: 'Item already has an active listing. Update or deactivate it first.',
      })
    }
  }

  // 5. Validate price is reasonable
  if (askPrice < 1) {
    errors.push({ field: 'askPrice', message: 'Ask price must be at least $1' })
  }

  if (askPrice > 100000) {
    errors.push({ field: 'askPrice', message: 'Ask price cannot exceed $100,000' })
  }

  // 6. Compare with market price (warning if too far off)
  const { data: marketPrice } = await supabase
    .from('stockx_market_latest')
    .select('last_sale_price, lowest_ask')
    .eq('stockx_product_id', mapping.stockx_product_id)
    .eq('stockx_variant_id', mapping.stockx_variant_id)
    .eq('currency_code', 'USD')
    .single()

  if (marketPrice) {
    const referencePrice = marketPrice.last_sale_price || marketPrice.lowest_ask
    if (referencePrice) {
      // Warn if price is > 300% or < 50% of market
      if (askPrice > referencePrice * 3) {
        errors.push({
          field: 'askPrice',
          message: `Price seems high. Market price is ~$${referencePrice}`,
        })
      } else if (askPrice < referencePrice * 0.5) {
        errors.push({
          field: 'askPrice',
          message: `Price seems low. Market price is ~$${referencePrice}`,
        })
      }
    }
  }

  return errors
}
