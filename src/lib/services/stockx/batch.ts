/**
 * StockX Batch Operations Service
 * Handles bulk create/update/delete of listings using StockX batch APIs
 *
 * API Endpoints:
 * - POST /v2/selling/batch/create-listing - Create multiple listings
 * - GET /v2/selling/batch/create-listing/{batchId} - Get batch status
 * - GET /v2/selling/batch/create-listing/{batchId}/items - Get item results
 */

import { StockxClient, getStockxClient } from './client'
import { withStockxRetry } from './retry'

export interface BatchListingItem {
  productId: string
  variantId: string
  amount: string // Price as string (e.g., "125.00")
  currencyCode: string
  expiresAt?: string // ISO 8601 date
}

export interface BatchCreateRequest {
  listings: BatchListingItem[]
}

export interface BatchStatus {
  batchId: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  totalItems: number
  successCount: number
  failureCount: number
  createdAt: string
  completedAt?: string
}

export interface BatchItemResult {
  productId: string
  variantId: string
  status: 'SUCCESS' | 'FAILURE'
  listingId?: string
  operationId?: string
  error?: {
    code: string
    message: string
  }
}

export class StockxBatchService {
  private client: StockxClient

  constructor(userId?: string) {
    this.client = getStockxClient(userId)
  }

  /**
   * Create multiple listings in a single batch request
   * Returns a batchId for tracking progress
   */
  async createListingsBatch(
    listings: BatchListingItem[]
  ): Promise<{ batchId: string }> {
    if (listings.length === 0) {
      throw new Error('At least one listing is required')
    }

    if (listings.length > 100) {
      throw new Error('Maximum 100 listings per batch')
    }

    const payload: BatchCreateRequest = { listings }

    console.log('[StockX Batch] Creating batch with', listings.length, 'listings')

    const response = await withStockxRetry(
      () =>
        this.client.request<{ batchId: string }>(
          '/v2/selling/batch/create-listing',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        ),
      { label: 'Create listings batch' }
    )

    if (!response.batchId) {
      throw new Error('No batchId returned from batch create')
    }

    console.log('[StockX Batch] Batch created:', response.batchId)

    return response
  }

  /**
   * Get status of a batch operation
   */
  async getBatchStatus(batchId: string): Promise<BatchStatus> {
    console.log('[StockX Batch] Getting status for batch:', batchId)

    const response = await withStockxRetry(
      () =>
        this.client.request<BatchStatus>(
          `/v2/selling/batch/create-listing/${batchId}`,
          { method: 'GET' }
        ),
      { label: `Get batch status: ${batchId}` }
    )

    return response
  }

  /**
   * Get individual item results for a batch
   */
  async getBatchItems(batchId: string): Promise<BatchItemResult[]> {
    console.log('[StockX Batch] Getting items for batch:', batchId)

    const response = await withStockxRetry(
      () =>
        this.client.request<{ items: BatchItemResult[] }>(
          `/v2/selling/batch/create-listing/${batchId}/items`,
          { method: 'GET' }
        ),
      { label: `Get batch items: ${batchId}` }
    )

    return response.items || []
  }

  /**
   * Poll batch until completion or timeout
   * @param batchId - Batch ID to poll
   * @param maxWaitMs - Maximum time to wait (default: 60 seconds)
   * @param pollIntervalMs - Time between polls (default: 2 seconds)
   */
  async waitForBatchCompletion(
    batchId: string,
    maxWaitMs = 60000,
    pollIntervalMs = 2000
  ): Promise<BatchStatus> {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getBatchStatus(batchId)

      if (status.status === 'COMPLETED' || status.status === 'FAILED') {
        console.log('[StockX Batch] Batch completed:', {
          batchId,
          status: status.status,
          successCount: status.successCount,
          failureCount: status.failureCount,
        })
        return status
      }

      console.log('[StockX Batch] Batch still processing:', {
        batchId,
        status: status.status,
        elapsed: Date.now() - startTime,
      })

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    throw new Error(
      `Batch ${batchId} did not complete within ${maxWaitMs}ms`
    )
  }

  /**
   * Create listings and wait for completion
   * Convenience method that combines create + poll + get items
   */
  async createAndWaitForListings(
    listings: BatchListingItem[]
  ): Promise<BatchItemResult[]> {
    // Create batch
    const { batchId } = await this.createListingsBatch(listings)

    // Wait for completion
    const status = await this.waitForBatchCompletion(batchId)

    if (status.status === 'FAILED') {
      throw new Error(`Batch ${batchId} failed`)
    }

    // Get individual item results
    const items = await this.getBatchItems(batchId)

    return items
  }
}

/**
 * Get batch service instance
 */
export function getBatchService(userId?: string): StockxBatchService {
  return new StockxBatchService(userId)
}
