/**
 * ARCHVD Inventory V4 - Sync Queue Operations
 *
 * Handles sync queue management for background syncing of new SKUs:
 * - Get sync status for a style
 * - Retry failed sync jobs
 * - Process sync job batches (for cron worker)
 *
 * IMPORTANT: This file is SERVER-ONLY. It uses SUPABASE_SERVICE_ROLE_KEY.
 * Never import this into client-side code.
 */

import 'server-only'

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { syncStockxProductBySku } from '@/lib/services/stockx-v4/sync'
import { syncAliasProductByCatalogId } from '@/lib/services/alias-v4/sync'
import type {
  SyncProvider,
  SyncJobStatus,
  SyncJobV4,
  SyncStatusV4,
  ProviderSyncStatus,
} from './types'

// =============================================================================
// TYPES
// =============================================================================

export interface ProcessBatchResult {
  processed: number
  successful: number
  failed: number
  errors: Array<{ jobId: string; styleId: string; provider: SyncProvider; error: string }>
}

export interface RetrySyncResult {
  styleId: string
  jobsCreated: Array<{ id: string; provider: SyncProvider }>
  errors: string[]
}

interface SyncQueueRow {
  id: string
  style_id: string
  provider: string
  status: string
  attempts: number
  max_attempts: number
  last_attempt_at: string | null
  next_retry_at: string | null
  last_error: string | null
  created_at: string
  completed_at: string | null
}

/** Narrow select for style catalog - only fields we need for sync */
interface StyleCatalogForSync {
  style_id: string
  stockx_url_key: string | null
  stockx_product_id: string | null
  alias_catalog_id: string | null
}

interface ProcessJobResult {
  success: boolean
  errorMessage?: string
}

// =============================================================================
// SUPABASE SINGLETON
// =============================================================================

let supabaseServiceClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient {
  if (supabaseServiceClient) return supabaseServiceClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('[SyncQueue V4] Missing Supabase credentials')
  }

  supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
  return supabaseServiceClient
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default batch size for worker processing */
const DEFAULT_BATCH_SIZE = 10

/** Delay between processing jobs (ms) - rate limiting */
const JOB_PROCESSING_DELAY_MS = 500

// =============================================================================
// HELPERS
// =============================================================================

function rowToSyncJob(row: SyncQueueRow): SyncJobV4 {
  return {
    id: row.id,
    style_id: row.style_id,
    provider: row.provider as SyncProvider,
    status: row.status as SyncJobStatus,
    attempts: row.attempts,
    max_attempts: row.max_attempts,
    last_attempt_at: row.last_attempt_at,
    next_retry_at: row.next_retry_at,
    last_error: row.last_error,
    created_at: row.created_at,
    completed_at: row.completed_at,
  }
}

/**
 * Derive overall status from provider statuses.
 *
 * Logic:
 * - If either is pending/processing → 'syncing'
 * - If both completed → 'ready'
 * - If both not_mapped → 'not_mapped'
 * - If one completed, other is not_mapped/failed → 'partial'
 * - If either failed (and other is not completed) → 'failed'
 * - Fallback → 'partial'
 */
function deriveOverallStatus(
  stockxStatus: ProviderSyncStatus,
  aliasStatus: ProviderSyncStatus
): SyncStatusV4['overall'] {
  // Either syncing
  if (
    stockxStatus === 'pending' ||
    stockxStatus === 'processing' ||
    aliasStatus === 'pending' ||
    aliasStatus === 'processing'
  ) {
    return 'syncing'
  }

  // Both completed
  if (stockxStatus === 'completed' && aliasStatus === 'completed') {
    return 'ready'
  }

  // Both not mapped
  if (stockxStatus === 'not_mapped' && aliasStatus === 'not_mapped') {
    return 'not_mapped'
  }

  // One completed - partial success
  if (stockxStatus === 'completed' || aliasStatus === 'completed') {
    return 'partial'
  }

  // Either failed (and other is not completed) → failed
  if (stockxStatus === 'failed' || aliasStatus === 'failed') {
    return 'failed'
  }

  // Fallback (e.g., both not_mapped but one has mapping without job)
  return 'partial'
}

/**
 * Check if provider data actually exists (not just mapping)
 * Queries the product table directly - doesn't rely on style catalog IDs
 * Uses minimal select for efficiency (just check existence)
 */
async function checkProviderDataExists(
  supabase: SupabaseClient,
  styleId: string,
  provider: SyncProvider,
  style: StyleCatalogForSync
): Promise<boolean> {
  if (provider === 'stockx') {
    // Query StockX products table directly by style_id
    // Don't gate on stockx_product_id - it might not be populated yet
    // Select style_id (cheap) - we only need existence check
    const { data } = await supabase
      .from('inventory_v4_stockx_products')
      .select('style_id')
      .eq('style_id', styleId)
      .maybeSingle()

    return data !== null
  } else {
    // Alias requires catalog_id to query
    if (!style.alias_catalog_id) return false

    // Select alias_catalog_id (cheap) - we only need existence check
    const { data } = await supabase
      .from('inventory_v4_alias_products')
      .select('alias_catalog_id')
      .eq('alias_catalog_id', style.alias_catalog_id)
      .maybeSingle()

    return data !== null
  }
}

// =============================================================================
// GET SYNC STATUS
// =============================================================================

/**
 * Get sync status for a style
 *
 * Returns the current sync status for both StockX and Alias providers,
 * plus an overall status derived from both.
 *
 * Status logic:
 * - If job exists → use job status
 * - If no job but data exists → 'completed'
 * - If no job and mapping exists but no data → 'pending' (needs sync)
 * - If no mapping → 'not_mapped'
 */
export async function getSyncStatusV4(styleId: string): Promise<SyncStatusV4> {
  const supabase = getServiceClient()
  const normalizedSku = styleId.toUpperCase().trim()

  // Fetch all sync jobs for this style (both providers)
  const { data: jobs, error } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*')
    .eq('style_id', normalizedSku)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[SyncQueue V4] Error fetching sync status:', error)
    throw error
  }

  // Fetch style catalog for external ID checks (use maybeSingle - style might not exist)
  const { data: style, error: styleErr } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_product_id, stockx_url_key, alias_catalog_id')
    .eq('style_id', normalizedSku)
    .maybeSingle()

  if (styleErr) {
    console.error('[SyncQueue V4] Error fetching style:', styleErr)
    throw styleErr
  }

  // If style doesn't exist in catalog, it's not mapped to anything
  if (!style) {
    return {
      styleId: normalizedSku,
      stockx: { status: 'not_mapped', lastAttempt: null, error: null },
      alias: { status: 'not_mapped', lastAttempt: null, error: null },
      overall: 'not_mapped',
    }
  }

  // Find most recent job for each provider
  const stockxJob = (jobs || []).find((j) => j.provider === 'stockx')
  const aliasJob = (jobs || []).find((j) => j.provider === 'alias')

  // Determine provider statuses
  let stockxStatus: ProviderSyncStatus
  let aliasStatus: ProviderSyncStatus

  if (stockxJob) {
    // Job exists - use its status
    stockxStatus = stockxJob.status as SyncJobStatus
  } else if (!style?.stockx_url_key) {
    // No mapping
    stockxStatus = 'not_mapped'
  } else {
    // Has mapping but no job - check if data actually exists
    const dataExists = await checkProviderDataExists(supabase, normalizedSku, 'stockx', style)
    stockxStatus = dataExists ? 'completed' : 'pending'
  }

  if (aliasJob) {
    aliasStatus = aliasJob.status as SyncJobStatus
  } else if (!style?.alias_catalog_id) {
    aliasStatus = 'not_mapped'
  } else {
    const dataExists = await checkProviderDataExists(supabase, normalizedSku, 'alias', style)
    aliasStatus = dataExists ? 'completed' : 'pending'
  }

  return {
    styleId: normalizedSku,
    stockx: {
      status: stockxStatus,
      lastAttempt: stockxJob?.last_attempt_at ?? null,
      error: stockxJob?.last_error ?? null,
    },
    alias: {
      status: aliasStatus,
      lastAttempt: aliasJob?.last_attempt_at ?? null,
      error: aliasJob?.last_error ?? null,
    },
    overall: deriveOverallStatus(stockxStatus, aliasStatus),
  }
}

/**
 * Batch get sync status for multiple styles
 *
 * More efficient than calling getSyncStatusV4 for each style.
 * Uses batch queries to check data existence (cheap but accurate).
 */
export async function batchGetSyncStatusV4(
  styleIds: string[]
): Promise<Map<string, SyncStatusV4>> {
  const supabase = getServiceClient()
  const normalizedSkus = Array.from(new Set(styleIds.map((s) => s.toUpperCase().trim())))

  if (normalizedSkus.length === 0) {
    return new Map()
  }

  // Parallel fetch: jobs, styles, and StockX existence checks
  const [jobsResult, stylesResult, stockxExistsResult] = await Promise.all([
    // Fetch all jobs for all styles
    supabase
      .from('inventory_v4_sync_queue')
      .select('*')
      .in('style_id', normalizedSkus)
      .order('created_at', { ascending: false }),

    // Fetch style catalog for external ID checks
    supabase
      .from('inventory_v4_style_catalog')
      .select('style_id, stockx_product_id, stockx_url_key, alias_catalog_id')
      .in('style_id', normalizedSkus),

    // Batch check: which SKUs have StockX data
    supabase
      .from('inventory_v4_stockx_products')
      .select('style_id')
      .in('style_id', normalizedSkus),
  ])

  if (jobsResult.error) {
    console.error('[SyncQueue V4] Error batch fetching sync status:', jobsResult.error)
    throw jobsResult.error
  }
  if (stylesResult.error) {
    console.error('[SyncQueue V4] Error batch fetching styles:', stylesResult.error)
    throw stylesResult.error
  }
  if (stockxExistsResult.error) {
    console.error('[SyncQueue V4] Error checking StockX data existence:', stockxExistsResult.error)
    throw stockxExistsResult.error
  }

  // Build set for quick StockX existence check
  const stockxDataExists = new Set(
    (stockxExistsResult.data || []).map((r) => r.style_id)
  )

  // Derive alias catalog IDs to check from stylesResult (avoid duplicate query)
  // Filter out nulls when building map
  const aliasIdsToCheck: string[] = []
  const aliasIdToStyleId = new Map<string, string>()
  for (const style of stylesResult.data || []) {
    if (style.alias_catalog_id) {
      aliasIdsToCheck.push(style.alias_catalog_id)
      aliasIdToStyleId.set(style.alias_catalog_id, style.style_id)
    }
  }

  let aliasDataExists = new Set<string>()
  if (aliasIdsToCheck.length > 0) {
    const { data: aliasProducts, error: aliasErr } = await supabase
      .from('inventory_v4_alias_products')
      .select('alias_catalog_id')
      .in('alias_catalog_id', aliasIdsToCheck)

    if (aliasErr) {
      console.error('[SyncQueue V4] Error checking Alias data existence:', aliasErr)
      throw aliasErr
    }

    // Map back to style_ids
    aliasDataExists = new Set(
      (aliasProducts || [])
        .map((r) => aliasIdToStyleId.get(r.alias_catalog_id))
        .filter((styleId): styleId is string => styleId !== undefined)
    )
  }

  // Group jobs by style_id
  const jobsByStyle = new Map<string, SyncQueueRow[]>()
  for (const job of jobsResult.data || []) {
    const existing = jobsByStyle.get(job.style_id) || []
    existing.push(job as SyncQueueRow)
    jobsByStyle.set(job.style_id, existing)
  }

  // Create style lookup
  const styleMap = new Map(
    (stylesResult.data || []).map((s) => [s.style_id, s as StyleCatalogForSync])
  )

  // Build result map
  const result = new Map<string, SyncStatusV4>()

  for (const sku of normalizedSkus) {
    const styleJobs = jobsByStyle.get(sku) || []
    const style = styleMap.get(sku)

    const stockxJob = styleJobs.find((j) => j.provider === 'stockx')
    const aliasJob = styleJobs.find((j) => j.provider === 'alias')

    // Determine status with existence checks
    let stockxStatus: ProviderSyncStatus
    if (stockxJob) {
      stockxStatus = stockxJob.status as SyncJobStatus
    } else if (!style?.stockx_url_key) {
      stockxStatus = 'not_mapped'
    } else {
      stockxStatus = stockxDataExists.has(sku) ? 'completed' : 'pending'
    }

    let aliasStatus: ProviderSyncStatus
    if (aliasJob) {
      aliasStatus = aliasJob.status as SyncJobStatus
    } else if (!style?.alias_catalog_id) {
      aliasStatus = 'not_mapped'
    } else {
      aliasStatus = aliasDataExists.has(sku) ? 'completed' : 'pending'
    }

    result.set(sku, {
      styleId: sku,
      stockx: {
        status: stockxStatus,
        lastAttempt: stockxJob?.last_attempt_at ?? null,
        error: stockxJob?.last_error ?? null,
      },
      alias: {
        status: aliasStatus,
        lastAttempt: aliasJob?.last_attempt_at ?? null,
        error: aliasJob?.last_error ?? null,
      },
      overall: deriveOverallStatus(stockxStatus, aliasStatus),
    })
  }

  return result
}

// =============================================================================
// RETRY SYNC
// =============================================================================

/**
 * Retry sync jobs for a style
 *
 * Creates new pending jobs for failed, not_mapped, or pending providers.
 * For StockX: sync can work by SKU search even without stockx_url_key.
 * For Alias: requires alias_catalog_id (no SKU search available).
 */
export async function retrySyncV4(
  styleId: string,
  provider?: SyncProvider
): Promise<RetrySyncResult> {
  const supabase = getServiceClient()
  const normalizedSku = styleId.toUpperCase().trim()

  const result: RetrySyncResult = {
    styleId: normalizedSku,
    jobsCreated: [],
    errors: [],
  }

  // Get current status to determine what needs retry
  const status = await getSyncStatusV4(normalizedSku)

  const providersToRetry: SyncProvider[] = provider
    ? [provider]
    : (['stockx', 'alias'] as const)

  // Fetch style once for external ID checks (maybeSingle - style might not exist yet)
  const { data: style, error: styleErr } = await supabase
    .from('inventory_v4_style_catalog')
    .select('stockx_url_key, alias_catalog_id')
    .eq('style_id', normalizedSku)
    .maybeSingle()

  if (styleErr) {
    result.errors.push(`Failed to fetch style: ${styleErr.message}`)
    return result
  }

  for (const p of providersToRetry) {
    const providerStatus = status[p].status

    // Skip if already syncing or completed
    if (providerStatus === 'processing' || providerStatus === 'completed') {
      continue
    }

    // StockX can sync by SKU even without url_key
    // Alias requires catalog_id
    if (p === 'alias' && !style?.alias_catalog_id) {
      if (providerStatus === 'not_mapped') {
        result.errors.push(`No Alias catalog ID for ${normalizedSku} - cannot sync`)
      }
      continue
    }

    // Use RPC to enqueue job (handles deduplication)
    const { data: jobId, error } = await supabase.rpc('enqueue_sync_job_v4', {
      p_style_id: normalizedSku,
      p_provider: p,
    })

    if (error) {
      result.errors.push(`Failed to enqueue ${p} sync: ${error.message}`)
    } else if (jobId) {
      result.jobsCreated.push({ id: jobId, provider: p })
    }
  }

  return result
}

// =============================================================================
// PROCESS SYNC BATCH (FOR WORKER)
// =============================================================================

/**
 * Fetch pending jobs using FOR UPDATE SKIP LOCKED
 *
 * This is safe for concurrent workers - each worker gets unique jobs.
 * The RPC should filter: status='pending' AND (next_retry_at IS NULL OR next_retry_at <= now())
 */
async function fetchPendingJobs(
  limit: number,
  provider?: SyncProvider
): Promise<SyncJobV4[]> {
  const supabase = getServiceClient()

  const { data, error } = await supabase.rpc('fetch_sync_jobs', {
    _limit: limit,
    _provider: provider ?? null,
  })

  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`)
  }

  return ((data || []) as SyncQueueRow[]).map(rowToSyncJob)
}

/**
 * Get style catalog row for external IDs (narrow select)
 */
async function getStyleCatalogRow(
  styleId: string
): Promise<StyleCatalogForSync | null> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_url_key, stockx_product_id, alias_catalog_id')
    .eq('style_id', styleId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data as StyleCatalogForSync
}

/**
 * Mark job as successful
 */
async function markJobSuccess(jobId: string): Promise<void> {
  const supabase = getServiceClient()

  const { error } = await supabase
    .from('inventory_v4_sync_queue')
    .update({
      status: 'completed',
      last_error: null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) {
    console.warn(`[SyncQueue V4] Warning: Could not mark job ${jobId} as success:`, error)
  }
}

/**
 * Mark job as failed (or reset to pending for retry)
 */
async function markJobFailed(
  jobId: string,
  errorMessage: string,
  currentAttempts: number,
  maxAttempts: number
): Promise<void> {
  const supabase = getServiceClient()

  // If we haven't hit max attempts, reset to pending for retry
  const status = currentAttempts >= maxAttempts ? 'failed' : 'pending'

  // Calculate exponential backoff for retry (2^attempts minutes, capped at 30 min)
  const retryDelayMinutes = Math.min(Math.pow(2, currentAttempts), 30)
  const nextRetryAt =
    status === 'pending'
      ? new Date(Date.now() + retryDelayMinutes * 60 * 1000).toISOString()
      : null

  const { error } = await supabase
    .from('inventory_v4_sync_queue')
    .update({
      status,
      last_error: errorMessage.substring(0, 1000), // Limit error length
      next_retry_at: nextRetryAt,
      completed_at: status === 'failed' ? new Date().toISOString() : null,
    })
    .eq('id', jobId)

  if (error) {
    console.warn(`[SyncQueue V4] Warning: Could not mark job ${jobId} as failed:`, error)
  }
}

/**
 * Backfill style catalog metadata from provider after successful sync
 */
async function backfillStyleMetadata(
  styleId: string,
  provider: SyncProvider
): Promise<void> {
  const supabase = getServiceClient()

  if (provider === 'stockx') {
    // Fetch from StockX products table
    const { data: stockxProduct } = await supabase
      .from('inventory_v4_stockx_products')
      .select('brand, title, colorway')
      .eq('style_id', styleId)
      .maybeSingle()

    if (!stockxProduct) return

    // Get current style
    const { data: currentStyle } = await supabase
      .from('inventory_v4_style_catalog')
      .select('brand, name, colorway')
      .eq('style_id', styleId)
      .single()

    if (!currentStyle) return

    // Only update null fields
    const updates: Record<string, string> = {}
    if (!currentStyle.brand && stockxProduct.brand) updates.brand = stockxProduct.brand
    if (!currentStyle.name && stockxProduct.title) updates.name = stockxProduct.title
    if (!currentStyle.colorway && stockxProduct.colorway) updates.colorway = stockxProduct.colorway

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('inventory_v4_style_catalog')
        .update(updates)
        .eq('style_id', styleId)
    }
  } else if (provider === 'alias') {
    // Fetch from Alias products table
    const { data: style } = await supabase
      .from('inventory_v4_style_catalog')
      .select('alias_catalog_id, brand, name, product_category')
      .eq('style_id', styleId)
      .single()

    if (!style?.alias_catalog_id) return

    const { data: aliasProduct } = await supabase
      .from('inventory_v4_alias_products')
      .select('brand, name, product_category')
      .eq('alias_catalog_id', style.alias_catalog_id)
      .maybeSingle()

    if (!aliasProduct) return

    // Only update null fields
    const updates: Record<string, string> = {}
    if (!style.brand && aliasProduct.brand) updates.brand = aliasProduct.brand
    if (!style.name && aliasProduct.name) updates.name = aliasProduct.name
    if (!style.product_category && aliasProduct.product_category) {
      updates.product_category = aliasProduct.product_category
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('inventory_v4_style_catalog')
        .update(updates)
        .eq('style_id', styleId)
    }
  }
}

/**
 * Process a single sync job
 * Returns success status and error message (if any)
 *
 * Note: Job is already marked as 'processing' with attempts incremented
 * by the atomic fetch_sync_jobs RPC. job.attempts is the NEW value.
 */
async function processJob(job: SyncJobV4): Promise<ProcessJobResult> {
  // job.attempts is already incremented by the RPC
  const currentAttempts = job.attempts

  try {
    // Get style catalog row for external IDs
    const styleRow = await getStyleCatalogRow(job.style_id)

    if (!styleRow) {
      // Mark as failed since we can't process
      await markJobFailed(
        job.id,
        `Style ${job.style_id} not found in catalog`,
        currentAttempts,
        job.max_attempts
      )
      return {
        success: false,
        errorMessage: `Style ${job.style_id} not found in catalog`,
      }
    }

    // Process based on provider
    if (job.provider === 'stockx') {
      // StockX sync can work by SKU even without url_key
      const result = await syncStockxProductBySku(job.style_id)

      if (!result.success) {
        const errorMsg = result.errors.length > 0 ? result.errors[0].error : 'Unknown error'
        throw new Error(errorMsg)
      }

      // Backfill metadata
      await backfillStyleMetadata(job.style_id, 'stockx')
    } else if (job.provider === 'alias') {
      if (!styleRow.alias_catalog_id) {
        throw new Error(`Style ${job.style_id} has no alias_catalog_id`)
      }

      const result = await syncAliasProductByCatalogId(styleRow.alias_catalog_id)

      if (!result.success) {
        const errorMsg = result.errors.length > 0 ? result.errors[0].error : 'Unknown error'
        throw new Error(errorMsg)
      }

      // Backfill metadata
      await backfillStyleMetadata(job.style_id, 'alias')
    } else {
      throw new Error(`Unknown provider: ${job.provider}`)
    }

    // Mark as successful
    await markJobSuccess(job.id)
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Use the currentAttempts we tracked (already incremented by markJobProcessing)
    await markJobFailed(job.id, errorMessage, currentAttempts, job.max_attempts)

    return { success: false, errorMessage }
  }
}

/**
 * Process a batch of sync jobs
 *
 * This is the main entry point for the cron worker.
 * Uses FOR UPDATE SKIP LOCKED for concurrent-safe processing.
 */
export async function processSyncBatchV4(
  limit: number = DEFAULT_BATCH_SIZE,
  provider?: SyncProvider
): Promise<ProcessBatchResult> {
  const result: ProcessBatchResult = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  }

  try {
    // Fetch pending jobs
    const jobs = await fetchPendingJobs(limit, provider)

    if (jobs.length === 0) {
      return result
    }

    // Process each job sequentially
    for (const job of jobs) {
      result.processed++

      const jobResult = await processJob(job)

      if (jobResult.success) {
        result.successful++
      } else {
        result.failed++
        result.errors.push({
          jobId: job.id,
          styleId: job.style_id,
          provider: job.provider,
          error: jobResult.errorMessage || 'Unknown error',
        })
      }

      // Small delay between jobs to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, JOB_PROCESSING_DELAY_MS))
    }

    return result
  } catch (error) {
    console.error('[SyncQueue V4] Batch processing error:', error)
    throw error
  }
}

/**
 * Get queue statistics using efficient grouped query RPC
 */
export async function getQueueStatsV4(): Promise<{
  pending: number
  processing: number
  completed: number
  failed: number
}> {
  const supabase = getServiceClient()

  const { data, error } = await supabase.rpc('queue_stats_v4')

  if (error) {
    throw new Error(`Failed to get queue stats: ${error.message}`)
  }

  // Initialize with zeros
  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  }

  // Fill from RPC results
  for (const row of data || []) {
    const status = row.status as SyncJobStatus
    if (status in stats) {
      stats[status] = Number(row.count)
    }
  }

  return stats
}
