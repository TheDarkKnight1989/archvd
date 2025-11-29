/**
 * StockX Operations Polling Service
 * Handles async operation tracking and status updates
 *
 * WHY: StockX V2 API returns operation IDs for mutations.
 * This service polls those operations and updates our database when complete.
 */

import { getStockxClient } from './client'
import { isStockxMockMode } from '@/lib/config/stockx'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

// ============================================================================
// Types
// ============================================================================

export interface StockxOperationStatus {
  operationId: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'partial_success'
  result?: any
  error?: {
    code: string
    message: string
    details?: any
  }
  createdAt?: string
  completedAt?: string
}

export interface PendingJob {
  id: string
  user_id: string
  operation: string
  status: string
  stockx_batch_id: string
  total_items: number
  processed_items: number
  successful_items: number
  failed_items: number
  created_at: string
  updated_at: string
  results: any
}

export interface OperationResult {
  success: boolean
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
  listingData?: any
  error?: {
    code: string
    message: string
  }
}

// ============================================================================
// Status Mapping
// ============================================================================

/**
 * Map StockX operation status to our internal job status
 */
export function mapOperationStatus(stockxStatus: string): string {
  const mapping: Record<string, string> = {
    'queued': 'IN_PROGRESS',
    'processing': 'IN_PROGRESS',
    'completed': 'COMPLETED',
    'failed': 'FAILED',
    'partial_success': 'PARTIAL',
  }

  return mapping[stockxStatus] || 'IN_PROGRESS'
}

/**
 * Determine listing status based on operation and result
 */
export function getListingStatus(operation: string, success: boolean): string | null {
  if (!success) return null

  const statusMap: Record<string, string> = {
    'CREATE': 'ACTIVE',
    'UPDATE': 'ACTIVE',
    'DELETE': 'DELETED',
  }

  return statusMap[operation] || null
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Fetch pending jobs that need polling
 *
 * Criteria:
 * - status = PENDING or IN_PROGRESS
 * - stockx_batch_id is not null
 * - updated_at < now() - 20 seconds (avoid rapid polling)
 * - limit 50 (rate limit protection)
 */
export async function fetchPendingJobs(): Promise<PendingJob[]> {
  // Use service role client to bypass RLS (this is a background/cron job)
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false }
    }
  )

  const twentySecondsAgo = new Date(Date.now() - 20 * 1000).toISOString()

  const { data, error } = await supabase
    .from('stockx_batch_jobs')
    .select('*')
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .not('stockx_batch_id', 'is', null)
    .lt('updated_at', twentySecondsAgo)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    logger.error('[Operations Poller] Failed to fetch pending jobs', {
      message: error.message,
    })
    return []
  }

  return data as PendingJob[]
}

/**
 * Poll a single operation from StockX
 *
 * Note: StockX API requires listingId in the URL path.
 * Uses correct endpoint: /v2/selling/listings/{listingId}/operations/{operationId}
 *
 * For CREATE operations where listingId isn't known yet, this will fail.
 * In those cases, the operation tracking happens in the create listing flow.
 */
export async function pollSingleOperation(
  operationId: string,
  userId: string,
  listingId?: string | null
): Promise<OperationResult> {
  if (isStockxMockMode()) {
    // Mock mode: simulate completed operation
    return {
      success: true,
      status: 'COMPLETED',
      listingData: {
        id: 'mock-listing-id',
        status: 'ACTIVE',
        amount: 150,
      },
    }
  }

  try {
    const client = getStockxClient(userId)

    // StockX API requires listingId in URL - if not available, we can't poll
    if (!listingId) {
      logger.warn('[Operations Poller] Cannot poll operation without listingId', {
        operationId,
      })
      return {
        success: false,
        status: 'IN_PROGRESS',
        error: {
          code: 'missing_listing_id',
          message: 'Cannot poll operation without listing ID (required by StockX API)',
        },
      }
    }

    const response = await client.request<StockxOperationStatus>(
      `/v2/selling/listings/${listingId}/operations/${operationId}`
    )

    const internalStatus = mapOperationStatus(response.status)

    return {
      success: response.status === 'completed' || response.status === 'partial_success',
      status: internalStatus as any,
      listingData: response.result,
      error: response.error,
    }
  } catch (error: any) {
    // Handle specific error codes
    if (error.message?.includes('401')) {
      return {
        success: false,
        status: 'FAILED',
        error: {
          code: 'authentication_failed',
          message: 'StockX authentication failed',
        },
      }
    }

    if (error.message?.includes('429')) {
      // Rate limited - don't mark as failed, will retry
      return {
        success: false,
        status: 'IN_PROGRESS',
        error: {
          code: 'rate_limited',
          message: 'StockX rate limit exceeded',
        },
      }
    }

    if (error.message?.includes('5')) {
      // 5xx error - transient, will retry
      return {
        success: false,
        status: 'IN_PROGRESS',
        error: {
          code: 'server_error',
          message: 'StockX server error',
        },
      }
    }

    // Unknown error
    logger.error('[Operations Poller] Unknown error polling operation', {
      operationId,
      message: error.message,
    })

    return {
      success: false,
      status: 'FAILED',
      error: {
        code: 'unknown_error',
        message: error.message,
      },
    }
  }
}

/**
 * Check if job has timed out (>15 minutes)
 */
export function isJobTimedOut(job: PendingJob): boolean {
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000
  const startedAt = new Date(job.created_at).getTime()
  return startedAt < fifteenMinutesAgo
}

/**
 * Apply operation result to database
 * Updates stockx_batch_jobs, stockx_listings, and stockx_listing_history
 */
export async function applyOperationResult(
  job: PendingJob,
  result: OperationResult
): Promise<void> {
  const supabase = await createClient()

  // 1. Update job status
  const jobUpdate: any = {
    status: result.status,
    updated_at: new Date().toISOString(),
  }

  if (result.status === 'COMPLETED') {
    jobUpdate.completed_at = new Date().toISOString()
    jobUpdate.processed_items = job.total_items
  }

  if (result.status === 'FAILED') {
    jobUpdate.completed_at = new Date().toISOString()
    jobUpdate.failed_items = job.total_items
    jobUpdate.error_message = result.error?.message || 'Unknown error'
  }

  if (result.error?.code === 'rate_limited') {
    // Set retry time for rate limits
    const nextRetry = new Date(Date.now() + 60 * 1000).toISOString()
    jobUpdate.updated_at = nextRetry // Effectively delays next poll
  }

  const { error: jobError } = await supabase
    .from('stockx_batch_jobs')
    .update(jobUpdate)
    .eq('id', job.id)

  if (jobError) {
    logger.error('[Operations Poller] Failed to update job', {
      jobId: job.id,
      error: jobError.message,
    })
  }

  // 2. Update listing if operation completed successfully
  if (result.success && result.listingData) {
    const listingStatus = getListingStatus(job.operation, true)

    if (listingStatus) {
      // Extract listing ID from job results or result
      const listingId =
        job.results?.listingId ||
        result.listingData?.id ||
        result.listingData?.listingId

      if (listingId) {
        const listingUpdate: any = {
          status: listingStatus,
          updated_at: new Date().toISOString(),
        }

        // Update price if available
        if (result.listingData.amount) {
          listingUpdate.amount = result.listingData.amount
        }

        // Update expiry if available
        if (result.listingData.expiresAt) {
          listingUpdate.expires_at = result.listingData.expiresAt
        }

        // For CREATE operation type, upsert into stockx_listings table
        if (job.operation === 'CREATE') {
          const { error: upsertError } = await supabase
            .from('stockx_listings')
            .upsert({
              stockx_listing_id: listingId,
              user_id: job.user_id,
              stockx_product_id: job.results?.productId || result.listingData?.productId,
              stockx_variant_id: job.results?.variantId || result.listingData?.variantId,
              status: listingStatus,
              amount: result.listingData.amount || job.results?.askPrice,
              currency: job.results?.currencyCode || 'USD',
              expires_at: result.listingData.expiresAt,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'stockx_listing_id'
            })

          if (upsertError) {
            logger.error('[Operations Poller] Failed to upsert listing', {
              listingId,
              error: upsertError.message,
            })
          } else {
            logger.info('[Operations Poller] Created/updated stockx_listings record', {
              listingId,
            })
          }

          // Update inventory_market_links with the listing ID
          if (job.results?.inventoryItemId) {
            const { error: linkError } = await supabase
              .from('inventory_market_links')
              .update({
                stockx_listing_id: listingId,
                updated_at: new Date().toISOString(),
              })
              .eq('item_id', job.results.inventoryItemId)

            if (linkError) {
              logger.error('[Operations Poller] Failed to update inventory_market_links', {
                itemId: job.results.inventoryItemId,
                listingId,
                error: linkError.message,
              })
            } else {
              logger.info('[Operations Poller] Updated inventory_market_links with listing ID', {
                itemId: job.results.inventoryItemId,
                listingId,
              })
            }
          }
        } else {
          // For other operation types (UPDATE, DELETE), just update existing record
          const { error: listingError } = await supabase
            .from('stockx_listings')
            .update(listingUpdate)
            .eq('stockx_listing_id', listingId)

          if (listingError) {
            logger.error('[Operations Poller] Failed to update listing', {
              listingId,
              error: listingError.message,
            })
          }
        }

        // 3. Create history entry
        await createHistoryEntry(
          listingId,
          job.operation,
          listingStatus,
          'system',
          {
            operation_id: job.stockx_batch_id,
            job_id: job.id,
          }
        )
      }
    }
  }

  // 4. If job failed, create history entry
  if (result.status === 'FAILED') {
    const listingId = job.results?.listingId

    if (listingId) {
      await createHistoryEntry(
        listingId,
        job.operation,
        'FAILED',
        'system',
        {
          operation_id: job.stockx_batch_id,
          job_id: job.id,
          error: result.error,
        }
      )
    }
  }

  // 5. Handle authentication failures
  if (result.error?.code === 'authentication_failed') {
    // Mark user's StockX connection as broken
    await supabase
      .from('stockx_accounts')
      .update({
        status: 'BROKEN',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', job.user_id)

    logger.warn('[Operations Poller] Marked StockX account as broken', {
      userId: job.user_id,
      jobId: job.id,
    })
  }
}

/**
 * Create history entry for listing status change
 */
async function createHistoryEntry(
  listingId: string,
  action: string,
  newStatus: string,
  changedBy: string,
  metadata?: any
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from('stockx_listing_history').insert({
    stockx_listing_id: listingId,
    action,
    status: newStatus,
    changed_by: changedBy,
    changed_at: new Date().toISOString(),
    metadata: metadata || {},
  })

  if (error) {
    logger.error('[Operations Poller] Failed to create history entry', {
      listingId,
      error: error.message,
    })
  }
}

/**
 * Handle timed out job
 */
export async function handleTimeoutJob(job: PendingJob): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from('stockx_batch_jobs')
    .update({
      status: 'FAILED',
      error_message: 'Operation timed out after 15 minutes',
      completed_at: new Date().toISOString(),
      failed_items: job.total_items,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  // Create history entry for timeout
  const listingId = job.results?.listingId

  if (listingId) {
    await createHistoryEntry(listingId, job.operation, 'TIMEOUT', 'system', {
      operation_id: job.stockx_batch_id,
      job_id: job.id,
      reason: 'timeout',
    })
  }

  logger.warn('[Operations Poller] Job timed out', {
    jobId: job.id,
    operationId: job.stockx_batch_id,
    startedAt: job.created_at,
  })
}

/**
 * Main polling function - processes all pending jobs
 */
export async function pollPendingOperations(): Promise<{
  processed: number
  completed: number
  failed: number
  timedOut: number
  inProgress: number
}> {
  const stats = {
    processed: 0,
    completed: 0,
    failed: 0,
    timedOut: 0,
    inProgress: 0,
  }

  const jobs = await fetchPendingJobs()

  if (jobs.length === 0) {
    return stats
  }

  logger.info('[Operations Poller] Processing pending jobs', {
    count: jobs.length,
  })

  for (const job of jobs) {
    stats.processed++

    // Check for timeout
    if (isJobTimedOut(job)) {
      await handleTimeoutJob(job)
      stats.timedOut++
      continue
    }

    // Poll operation status
    // Extract listingId from job results (required by StockX API)
    const listingId = job.results?.listingId || null
    const result = await pollSingleOperation(job.stockx_batch_id, job.user_id, listingId)

    // Apply result
    await applyOperationResult(job, result)

    // Update stats
    if (result.status === 'COMPLETED') {
      stats.completed++
    } else if (result.status === 'FAILED') {
      stats.failed++
    } else {
      stats.inProgress++
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[POLL] Operation ${job.stockx_batch_id} for user ${job.user_id}: ${result.status}`
      )

      if (result.success) {
        console.log(`[POLL] Operation complete → listing updated`)
      } else if (result.error) {
        console.log(`[POLL] Operation failed → reason: ${result.error.message}`)
      }
    }
  }

  return stats
}
