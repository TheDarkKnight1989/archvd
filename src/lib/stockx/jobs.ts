/**
 * StockX Market Job Producer
 * Creates background jobs for fetching StockX market data via worker
 *
 * DIRECTIVE COMPLIANCE:
 * - App layer NEVER calls StockX API directly
 * - All market data requests go through job queue
 * - Worker processes jobs with V2 services
 * - Results cached in stockx_market_latest view
 */

import { createClient } from '@/lib/supabase/server'
import { nowUtc } from '@/lib/time'

// ============================================================================
// Types
// ============================================================================

export interface MarketJobParams {
  sku: string
  size: string | null
  userId?: string
  priority?: number
}

export interface CreateJobsResult {
  created: number
  skipped: number
  errors: string[]
  jobIds: string[]
}

// ============================================================================
// Job Creation
// ============================================================================

/**
 * Create a single market data job
 *
 * WHY: Queues background fetch for StockX market pricing
 * DIRECTIVE: App layer uses this instead of calling StockX API directly
 *
 * @param params - Job parameters (SKU, size)
 * @returns Job ID or null if skipped/failed
 */
export async function createMarketJob(
  params: MarketJobParams
): Promise<string | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const userId = params.userId || user?.id

  if (!userId) {
    throw new Error('User authentication required to create market job')
  }

  // Check if a pending/processing job already exists for this SKU+size
  const { data: existingJob } = await supabase
    .from('market_jobs')
    .select('id, status')
    .eq('sku', params.sku)
    .eq('size', params.size || '')
    .in('status', ['pending', 'processing'])
    .maybeSingle()

  if (existingJob) {
    console.log(`[Market Jobs] Skipping duplicate job for ${params.sku}:${params.size}`)
    return null
  }

  // Create new job
  const { data: newJob, error } = await supabase
    .from('market_jobs')
    .insert({
      user_id: userId,
      provider: 'stockx',
      sku: params.sku,
      size: params.size,
      status: 'pending',
      priority: params.priority || 100,
      created_at: nowUtc(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Market Jobs] Failed to create job:', error.message)
    throw new Error(`Failed to create market job: ${error.message}`)
  }

  console.log(`[Market Jobs] Created job ${newJob.id} for ${params.sku}:${params.size}`)

  return newJob.id
}

/**
 * Create multiple market data jobs in batch
 *
 * WHY: Efficiently queue many products for background sync
 * DIRECTIVE: App layer batch job creation instead of batch API calls
 *
 * @param jobParams - Array of job parameters
 * @returns Summary of created/skipped jobs
 */
export async function createMarketJobsBatch(
  jobParams: MarketJobParams[]
): Promise<CreateJobsResult> {
  const result: CreateJobsResult = {
    created: 0,
    skipped: 0,
    errors: [],
    jobIds: [],
  }

  if (jobParams.length === 0) {
    return result
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User authentication required to create market jobs')
  }

  // Check for existing pending/processing jobs
  const { data: existingJobs } = await supabase
    .from('market_jobs')
    .select('sku, size')
    .in('status', ['pending', 'processing'])

  const existingJobKeys = new Set(
    existingJobs?.map(j => `${j.sku}:${j.size || ''}`) || []
  )

  // Filter out duplicates and prepare inserts
  const jobsToCreate = jobParams
    .filter(params => {
      const key = `${params.sku}:${params.size || ''}`
      if (existingJobKeys.has(key)) {
        result.skipped++
        return false
      }
      return true
    })
    .map(params => ({
      user_id: params.userId || user.id,
      provider: 'stockx',
      sku: params.sku,
      size: params.size,
      status: 'pending',
      priority: params.priority || 100,
      created_at: nowUtc(),
    }))

  if (jobsToCreate.length === 0) {
    console.log('[Market Jobs] All jobs already queued, skipping batch')
    return result
  }

  // Batch insert
  const { data: createdJobs, error } = await supabase
    .from('market_jobs')
    .insert(jobsToCreate)
    .select('id')

  if (error) {
    console.error('[Market Jobs] Batch insert failed:', error.message)
    result.errors.push(`Batch insert failed: ${error.message}`)
    return result
  }

  result.created = createdJobs?.length || 0
  result.jobIds = createdJobs?.map(j => j.id) || []

  console.log(`[Market Jobs] Created ${result.created} jobs, skipped ${result.skipped} duplicates`)

  return result
}

/**
 * Get job status by ID
 *
 * WHY: Allow app layer to poll for job completion
 * RETURNS: Job status and result data if completed
 */
export async function getJobStatus(jobId: string) {
  const supabase = await createClient()

  const { data: job, error } = await supabase
    .from('market_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error || !job) {
    throw new Error(`Job not found: ${jobId}`)
  }

  return {
    id: job.id,
    status: job.status,
    sku: job.sku,
    size: job.size,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    errorMessage: job.error_message,
  }
}

/**
 * Get all pending jobs for current user
 *
 * WHY: Check queue status, show pending market data fetches
 */
export async function getUserPendingJobs(userId?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const targetUserId = userId || user?.id

  if (!targetUserId) {
    throw new Error('User authentication required')
  }

  const { data: jobs, error } = await supabase
    .from('market_jobs')
    .select('id, status, sku, size, created_at, started_at')
    .eq('user_id', targetUserId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw new Error(`Failed to fetch pending jobs: ${error.message}`)
  }

  return jobs || []
}
