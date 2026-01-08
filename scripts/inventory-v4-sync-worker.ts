#!/usr/bin/env node

/**
 * Inventory V4 - Sync Queue Worker
 * Processes queued sync jobs for StockX and Alias products
 *
 * RESILIENT: Never crashes on individual job failures - always exits 0 unless fatal boot error.
 *
 * Features:
 *   - Multi-provider support (StockX, Alias)
 *   - True concurrent worker safety via Postgres function with FOR UPDATE SKIP LOCKED
 *   - Safe to run multiple workers in parallel
 *   - Automatic retry with max attempts
 *   - Error logging and tracking
 *   - Configurable batch size
 *   - Watch mode for continuous processing
 *   - Drain mode: run until queue is empty, then exit 0
 *
 * Usage:
 *   npx tsx scripts/inventory-v4-sync-worker.ts                  # Process 10 jobs once
 *   npx tsx scripts/inventory-v4-sync-worker.ts --batch=20       # Process 20 jobs once
 *   npx tsx scripts/inventory-v4-sync-worker.ts --drain          # Run until queue empty
 *   npx tsx scripts/inventory-v4-sync-worker.ts --watch          # Continuous mode (never exits)
 *   npx tsx scripts/inventory-v4-sync-worker.ts --provider=stockx  # Only StockX jobs
 *   npx tsx scripts/inventory-v4-sync-worker.ts --drain --provider=alias  # Drain only alias jobs
 */

import { createClient } from '@supabase/supabase-js'
import { syncStockxProductBySku } from '@/lib/services/stockx-v4/sync'
import { syncAliasProductByCatalogId } from '@/lib/services/alias-v4/sync'

// ============================================================================
// TYPES
// ============================================================================

interface SyncJob {
  id: number
  style_id: string
  provider: 'stockx' | 'alias'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  max_attempts: number
  last_error: string | null
  created_at: string
  completed_at: string | null
}

interface StyleCatalogRow {
  style_id: string
  stockx_url_key: string | null
  alias_catalog_id: string | null
  brand: string | null
  name: string | null
  colorway: string | null
}

interface WorkerStats {
  processed: number
  successful: number
  failed: number
  skipped: number
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const args = process.argv.slice(2)

const BATCH_SIZE = parseInt(args.find((a) => a.startsWith('--batch='))?.split('=')[1] || '10', 10)
const WATCH_MODE = args.includes('--watch')
const DRAIN_MODE = args.includes('--drain') // Drain mode: run until queue is empty, then exit 0
const WATCH_DELAY = parseInt(args.find((a) => a.startsWith('--delay='))?.split('=')[1] || '10000', 10)
const PROVIDER_FILTER = args.find((a) => a.startsWith('--provider='))?.split('=')[1] as 'stockx' | 'alias' | undefined

// Environment validation
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Missing environment variables')
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ============================================================================
// WORKER FUNCTIONS
// ============================================================================

/**
 * Fetch and lock pending jobs from the queue
 * Uses Postgres function with FOR UPDATE SKIP LOCKED for safe concurrent processing
 * Multiple workers can run in parallel without conflicts
 */
async function fetchPendingJobs(limit: number, provider?: 'stockx' | 'alias'): Promise<SyncJob[]> {
  const { data, error } = await supabase.rpc('fetch_sync_jobs', {
    _limit: limit,
    _provider: provider ?? null,
  })

  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`)
  }

  return (data || []) as SyncJob[]
}

/**
 * Get style catalog row for a job
 */
async function getStyleCatalogRow(styleId: string): Promise<StyleCatalogRow | null> {
  const { data, error } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_url_key, alias_catalog_id, brand, name, colorway')
    .eq('style_id', styleId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(`Failed to fetch style catalog: ${error.message}`)
  }

  return data as StyleCatalogRow
}

/**
 * Backfill style catalog metadata from StockX after successful sync
 * Only overwrites null fields so manual edits win
 */
async function backfillStyleMetadataFromStockX(styleId: string): Promise<void> {
  const { data: stockxProduct } = await supabase
    .from('inventory_v4_stockx_products')
    .select('brand, title, colorway, style_id')
    .eq('style_id', styleId)
    .maybeSingle()

  if (!stockxProduct) {
    return // No StockX product found, skip backfill
  }

  // Only update fields that are currently null
  const { data: currentStyle } = await supabase
    .from('inventory_v4_style_catalog')
    .select('brand, name, colorway')
    .eq('style_id', styleId)
    .single()

  if (!currentStyle) {
    return
  }

  const updates: Record<string, string> = {}

  if (!currentStyle.brand && stockxProduct.brand) {
    updates.brand = stockxProduct.brand
  }
  if (!currentStyle.name && stockxProduct.title) {
    updates.name = stockxProduct.title
  }
  if (!currentStyle.colorway && stockxProduct.colorway) {
    updates.colorway = stockxProduct.colorway
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('inventory_v4_style_catalog')
      .update(updates)
      .eq('style_id', styleId)

    if (error) {
      console.warn(`     ⚠️  Could not backfill metadata from StockX: ${error.message}`)
    } else {
      console.log(`     📝 Backfilled metadata: ${Object.keys(updates).join(', ')}`)
    }
  }
}

/**
 * Backfill style catalog metadata from Alias after successful sync
 * Only overwrites null fields so manual edits win
 */
async function backfillStyleMetadataFromAlias(styleId: string): Promise<void> {
  // For Alias, we need to find by alias_catalog_id through the style catalog
  const { data: style } = await supabase
    .from('inventory_v4_style_catalog')
    .select('alias_catalog_id, brand, name, product_category')
    .eq('style_id', styleId)
    .single()

  if (!style?.alias_catalog_id) {
    return
  }

  const { data: aliasProduct } = await supabase
    .from('inventory_v4_alias_products')
    .select('brand, name, product_category')
    .eq('alias_catalog_id', style.alias_catalog_id)
    .maybeSingle()

  if (!aliasProduct) {
    return // No Alias product found, skip backfill
  }

  const updates: Record<string, string> = {}

  if (!style.brand && aliasProduct.brand) {
    updates.brand = aliasProduct.brand
  }
  if (!style.name && aliasProduct.name) {
    updates.name = aliasProduct.name
  }
  if (!style.product_category && aliasProduct.product_category) {
    updates.product_category = aliasProduct.product_category
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('inventory_v4_style_catalog')
      .update(updates)
      .eq('style_id', styleId)

    if (error) {
      console.warn(`     ⚠️  Could not backfill metadata from Alias: ${error.message}`)
    } else {
      console.log(`     📝 Backfilled metadata: ${Object.keys(updates).join(', ')}`)
    }
  }
}

/**
 * Mark job as processing and increment attempt counter
 */
async function markJobProcessing(jobId: number, currentAttempts: number): Promise<void> {
  const { error } = await supabase
    .from('inventory_v4_sync_queue')
    .update({
      status: 'processing',
      attempts: currentAttempts + 1,
    })
    .eq('id', jobId)

  if (error) {
    console.error(`  ⚠️  Warning: Could not mark job ${jobId} as processing: ${error.message}`)
  }
}

/**
 * Mark job as successful
 */
async function markJobSuccess(jobId: number): Promise<void> {
  const { error } = await supabase
    .from('inventory_v4_sync_queue')
    .update({
      status: 'completed',
      last_error: null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) {
    console.error(`  ⚠️  Warning: Could not mark job ${jobId} as success: ${error.message}`)
  }
}

/**
 * Mark job as failed
 */
async function markJobFailed(jobId: number, errorMessage: string, attempts: number, maxAttempts: number): Promise<void> {
  // If we haven't hit max attempts yet, reset to pending for retry with exponential backoff
  const status = attempts >= maxAttempts ? 'failed' : 'pending'

  // Exponential backoff: 1min, 2min, 4min, 8min...
  const backoffMs = Math.min(60000 * Math.pow(2, attempts - 1), 3600000) // Max 1 hour
  const nextRetryAt = status === 'pending' ? new Date(Date.now() + backoffMs).toISOString() : null

  const { error } = await supabase
    .from('inventory_v4_sync_queue')
    .update({
      status,
      last_error: errorMessage.substring(0, 1000), // Limit error message length
      completed_at: status === 'failed' ? new Date().toISOString() : null,
      next_retry_at: nextRetryAt,
    })
    .eq('id', jobId)

  if (error) {
    console.error(`  ⚠️  Warning: Could not mark job ${jobId} as failed: ${error.message}`)
  }
}

/**
 * Process a single sync job
 */
async function processJob(job: SyncJob): Promise<boolean> {
  const jobLabel = `[Job ${job.id}] ${job.provider.toUpperCase()} - ${job.style_id}`

  try {
    // Fetch style catalog row
    console.log(`  📋 ${jobLabel}`)
    const styleRow = await getStyleCatalogRow(job.style_id)

    if (!styleRow) {
      throw new Error(`Style ${job.style_id} not found in catalog`)
    }

    // Mark as processing and increment attempts
    await markJobProcessing(job.id, job.attempts)

    // Process based on provider
    if (job.provider === 'stockx') {
      // StockX sync - searches by SKU, no pre-populated ID required
      console.log(`     🔄 Syncing StockX by SKU: ${job.style_id}`)
      const result = await syncStockxProductBySku(job.style_id)

      if (!result.success) {
        const errorMsg = result.errors.length > 0 ? result.errors[0].error : 'Unknown error'
        throw new Error(errorMsg)
      }

      console.log(`     ✅ Success: ${result.counts.variantsSynced} variants, ${result.counts.marketDataRefreshed} prices`)

      // Backfill style catalog metadata from StockX after successful sync
      await backfillStyleMetadataFromStockX(job.style_id)

    } else if (job.provider === 'alias') {
      // Alias sync - REQUIRES alias_catalog_id (no SKU search available)
      if (!styleRow.alias_catalog_id) {
        throw new Error(`MISSING_MAPPING: alias_catalog_id for style ${job.style_id}`)
      }

      console.log(`     🔄 Syncing Alias: ${styleRow.alias_catalog_id}`)
      const result = await syncAliasProductByCatalogId(styleRow.alias_catalog_id)

      if (!result.success) {
        const errorMsg = result.errors.length > 0 ? result.errors[0].error : 'Unknown error'
        throw new Error(errorMsg)
      }

      console.log(`     ✅ Success: ${result.counts.variantsSynced} variants, ${result.counts.marketDataRefreshed} prices`)

      // FIX 2: Backfill style catalog metadata from Alias after successful sync
      await backfillStyleMetadataFromAlias(job.style_id)

    } else {
      throw new Error(`Unknown provider: ${job.provider}`)
    }

    // Mark as successful
    await markJobSuccess(job.id)
    return true

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`     ❌ Failed: ${errorMessage}`)

    // MISSING_MAPPING errors are permanent - no point retrying
    const isPermanentError = errorMessage.startsWith('MISSING_MAPPING:')
    const newAttempts = job.attempts + 1

    if (isPermanentError) {
      // Force immediate failure - don't retry
      await markJobFailed(job.id, errorMessage, job.max_attempts, job.max_attempts)
      console.error(`     💀 Permanent error (MISSING_MAPPING), marking as failed immediately`)
    } else {
      await markJobFailed(job.id, errorMessage, newAttempts, job.max_attempts)

      if (newAttempts >= job.max_attempts) {
        console.error(`     💀 Max attempts (${job.max_attempts}) reached, marking as permanently failed`)
      } else {
        console.error(`     🔄 Will retry (attempt ${newAttempts}/${job.max_attempts})`)
      }
    }

    return false
  }
}

/**
 * Process a batch of jobs
 */
async function processBatch(limit: number, provider?: 'stockx' | 'alias'): Promise<WorkerStats> {
  const stats: WorkerStats = {
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
  }

  try {
    // Fetch pending jobs
    const jobs = await fetchPendingJobs(limit, provider)

    if (jobs.length === 0) {
      return stats
    }

    console.log(`\n📦 Processing ${jobs.length} job${jobs.length === 1 ? '' : 's'}...\n`)

    // Process each job sequentially (parallel processing would require more complex locking)
    for (const job of jobs) {
      stats.processed++
      const success = await processJob(job)

      if (success) {
        stats.successful++
      } else {
        stats.failed++
      }

      // Small delay between jobs to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return stats

  } catch (error) {
    // Don't throw - just log and return empty stats so the worker can continue
    // This prevents one bad batch from crashing the entire worker
    console.error('\n❌ Batch processing error (non-fatal):', error)
    return stats
  }
}

/**
 * Print summary statistics
 */
function printSummary(stats: WorkerStats, duration: number) {
  console.log('\n' + '='.repeat(80))
  console.log('📊 BATCH SUMMARY')
  console.log('='.repeat(80))
  console.log('')
  console.log(`  Processed:  ${stats.processed}`)
  console.log(`  Successful: ${stats.successful} ✅`)
  console.log(`  Failed:     ${stats.failed} ❌`)
  console.log(`  Skipped:    ${stats.skipped} ⏭️`)
  console.log('')
  console.log(`  Duration:   ${(duration / 1000).toFixed(2)}s`)
  console.log('')
  console.log('='.repeat(80))
  console.log('')
}

/**
 * Check queue status
 */
async function checkQueueStatus() {
  const { count: pendingCount } = await supabase
    .from('inventory_v4_sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: processingCount } = await supabase
    .from('inventory_v4_sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'processing')

  const { count: failedCount } = await supabase
    .from('inventory_v4_sync_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')

  console.log('📊 Queue Status:')
  console.log(`  Pending:    ${pendingCount ?? 0}`)
  console.log(`  Processing: ${processingCount ?? 0}`)
  console.log(`  Failed:     ${failedCount ?? 0}`)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🔄 INVENTORY V4 - SYNC QUEUE WORKER')
  console.log('='.repeat(80))
  console.log('')
  console.log('Configuration:')
  console.log(`  Batch Size:  ${BATCH_SIZE}`)
  console.log(`  Mode:        ${WATCH_MODE ? `Watch (${WATCH_DELAY}ms delay)` : DRAIN_MODE ? 'Drain (until empty)' : 'Single batch'}`)
  console.log(`  Provider:    ${PROVIDER_FILTER || 'All'}`)
  console.log('')
  console.log('='.repeat(80))

  await checkQueueStatus()

  // Track totals across all batches
  const totals: WorkerStats = { processed: 0, successful: 0, failed: 0, skipped: 0 }
  const overallStart = Date.now()

  if (WATCH_MODE) {
    console.log('\n👀 Starting watch mode (Ctrl+C to stop)...\n')

    // Run continuously - never exits
    while (true) {
      const startTime = Date.now()
      const stats = await processBatch(BATCH_SIZE, PROVIDER_FILTER)
      const duration = Date.now() - startTime

      if (stats.processed > 0) {
        printSummary(stats, duration)
      } else {
        console.log(`  💤 No jobs found, sleeping for ${WATCH_DELAY}ms...`)
      }

      await new Promise((resolve) => setTimeout(resolve, WATCH_DELAY))
    }

  } else if (DRAIN_MODE) {
    console.log('\n🚰 Starting drain mode (will exit when queue is empty)...\n')

    // Run until queue is empty
    let consecutiveEmpty = 0
    while (consecutiveEmpty < 3) { // Wait for 3 consecutive empty batches to ensure queue is truly empty
      const startTime = Date.now()
      const stats = await processBatch(BATCH_SIZE, PROVIDER_FILTER)
      const duration = Date.now() - startTime

      totals.processed += stats.processed
      totals.successful += stats.successful
      totals.failed += stats.failed
      totals.skipped += stats.skipped

      if (stats.processed > 0) {
        printSummary(stats, duration)
        consecutiveEmpty = 0
        // Small delay between batches to avoid hammering the queue
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } else {
        consecutiveEmpty++
        if (consecutiveEmpty < 3) {
          console.log(`  💤 No jobs found (${consecutiveEmpty}/3), checking again...`)
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
    }

    const overallDuration = Date.now() - overallStart
    console.log('\n' + '='.repeat(80))
    console.log('🚰 DRAIN COMPLETE - FINAL SUMMARY')
    console.log('='.repeat(80))
    console.log('')
    console.log(`  Total Processed:  ${totals.processed}`)
    console.log(`  Total Successful: ${totals.successful} ✅`)
    console.log(`  Total Failed:     ${totals.failed} ❌`)
    console.log('')
    console.log(`  Total Duration:   ${(overallDuration / 1000).toFixed(2)}s`)
    console.log('')
    console.log('='.repeat(80))
    console.log('')
    console.log('✅ Queue drained successfully!')
    // Always exit 0 - job failures are expected and handled via retry queue
    process.exit(0)

  } else {
    // Run single batch
    const startTime = Date.now()
    const stats = await processBatch(BATCH_SIZE, PROVIDER_FILTER)
    const duration = Date.now() - startTime

    if (stats.processed > 0) {
      printSummary(stats, duration)
    } else {
      console.log('\n  ✅ No jobs in queue\n')
    }

    console.log('Done!\n')
    // Always exit 0 - job failures are expected and handled via retry queue
    // Exit code 1 should only be used for fatal boot errors (env missing, etc)
    process.exit(0)
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
