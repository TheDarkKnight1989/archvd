/**
 * Admin Bulk Sync API for Style Catalog
 * POST /api/admin/sync-catalog
 *
 * Triggers bulk sync for StockX and/or Alias data
 * RUNS SYNCHRONOUSLY - no background process that dies on hot-reload
 * PROGRESS TRACKING - updates database every 5 items for live progress bar
 *
 * Query params:
 * - mode: 'all' | 'missing'
 * - platform: 'both' | 'stockx' | 'alias'
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { syncStockxProductBySku } from '@/lib/services/stockx-v4/sync'
import { syncAliasProductByCatalogId } from '@/lib/services/alias-v4/sync'
import { createAliasClient } from '@/lib/services/alias/client'

export const maxDuration = 300 // 5 minutes max for Vercel

interface SyncResult {
  total: number
  completed: number
  success: number
  failed: number
  errors: Array<{ sku: string; error: string }>
}

// Progress update callback type
type ProgressCallback = (completed: number, success: number, failed: number, currentSku: string) => Promise<void>

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body params (or fallback to query params)
    let mode = 'missing'
    let platform = 'both'
    try {
      const body = await request.json()
      mode = body.mode || mode
      platform = body.platform || platform
    } catch {
      // No body, use query params
      const { searchParams } = new URL(request.url)
      mode = searchParams.get('mode') || mode
      platform = searchParams.get('platform') || platform
    }

    // Get SKUs to sync based on mode
    const serviceClient = createServiceClient()
    const { data: catalog, error: catalogError } = await serviceClient
      .from('inventory_v4_style_catalog')
      .select('style_id, stockx_product_id, alias_catalog_id, last_synced_at')
      .order('style_id')

    if (catalogError || !catalog) {
      return NextResponse.json({
        error: 'Failed to fetch catalog',
        details: catalogError?.message,
      }, { status: 500 })
    }

    // Skip items synced within last 6 hours (unless mode is 'force')
    const SKIP_IF_SYNCED_WITHIN_HOURS = 6
    const cutoffTime = new Date(Date.now() - SKIP_IF_SYNCED_WITHIN_HOURS * 60 * 60 * 1000)

    // Filter based on mode
    type CatalogItem = { style_id: string; stockx_product_id: string | null; alias_catalog_id: string | null; last_synced_at: string | null }
    let skusToSync: CatalogItem[]

    if (mode === 'missing') {
      // Only sync items missing provider mappings
      skusToSync = catalog.filter(item => {
        if (platform === 'stockx') return !item.stockx_product_id
        if (platform === 'alias') return !item.alias_catalog_id
        return !item.stockx_product_id || !item.alias_catalog_id
      })
    } else if (mode === 'force') {
      // Force sync ALL items - ignore last_synced_at
      skusToSync = catalog
    } else {
      // mode === 'all': Sync items that are STALE (not synced within 6 hours)
      skusToSync = catalog.filter(item => {
        if (!item.last_synced_at) return true // Never synced
        const lastSync = new Date(item.last_synced_at)
        return lastSync < cutoffTime // Synced more than 6 hours ago
      })
    }

    // Report how many were skipped
    const skippedCount = catalog.length - skusToSync.length
    if (skippedCount > 0 && mode === 'all') {
      console.log(`[Bulk Sync] Skipping ${skippedCount} items synced within last ${SKIP_IF_SYNCED_WITHIN_HOURS} hours`)
    }

    if (skusToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: skippedCount > 0
          ? `Nothing to sync - ${skippedCount} items already synced within last ${SKIP_IF_SYNCED_WITHIN_HOURS} hours. Use "Force Refresh" to re-sync.`
          : 'Nothing to sync - all items are already mapped',
        synced: 0,
        skipped: skippedCount,
      })
    }

    // STEP 1: Run mapper to discover missing Alias catalog IDs
    // (same logic as scripts/map-style-catalog-to-alias.ts)
    if (platform === 'both' || platform === 'alias') {
      const itemsMissingAlias = skusToSync.filter(item => !item.alias_catalog_id)
      if (itemsMissingAlias.length > 0) {
        console.log(`[Bulk Sync] Running Alias mapper for ${itemsMissingAlias.length} items...`)
        await runAliasMapper(itemsMissingAlias, serviceClient)

        // Re-fetch catalog to get updated alias_catalog_ids
        const { data: refreshedCatalog } = await serviceClient
          .from('inventory_v4_style_catalog')
          .select('style_id, stockx_product_id, alias_catalog_id')
          .in('style_id', skusToSync.map(s => s.style_id))

        if (refreshedCatalog) {
          // Update skusToSync with newly discovered alias_catalog_ids
          const refreshedMap = new Map(refreshedCatalog.map(r => [r.style_id, r]))
          skusToSync = skusToSync.map(item => refreshedMap.get(item.style_id) || item)
        }
      }
    }

    // STEP 2: Create job record for progress tracking
    let jobId: string | null = null
    try {
      const { data: jobData } = await serviceClient
        .from('admin_sync_jobs')
        .insert({
          user_id: user.id,
          job_type: 'catalog_sync',
          total_items: skusToSync.length,
          success_count: 0,
          failed_count: 0,
          errors: [],
          // completed_at is NULL = still running
        })
        .select('id')
        .single()
      jobId = jobData?.id || null
    } catch (dbErr) {
      console.error('[Bulk Sync] Failed to create job record:', dbErr)
    }

    // Progress callback - updates database every 5 items
    const updateProgress: ProgressCallback = async (completed, success, failed, currentSku) => {
      if (!jobId) return
      // Only update every 5 items to reduce DB writes
      if (completed % 5 === 0 || completed === skusToSync.length) {
        try {
          await serviceClient
            .from('admin_sync_jobs')
            .update({
              success_count: success,
              failed_count: failed,
              // Store current SKU in errors array as progress indicator
              errors: [{ type: 'progress', currentSku, completed, total: skusToSync.length }],
            })
            .eq('id', jobId)
        } catch {
          // Ignore progress update errors
        }
      }
    }

    // STEP 3: Run sync SYNCHRONOUSLY with progress tracking
    const result = await runBulkSyncSynchronous(skusToSync, platform, updateProgress)

    // STEP 4: Mark job as complete
    if (jobId) {
      try {
        await serviceClient
          .from('admin_sync_jobs')
          .update({
            success_count: result.success,
            failed_count: result.failed,
            errors: result.errors.slice(0, 50), // Final errors
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId)
      } catch (dbErr) {
        console.error('[Bulk Sync] Failed to update job record:', dbErr)
      }
    }

    return NextResponse.json({
      success: result.failed === 0,
      message: `Synced ${result.success}/${result.total} items`,
      ...result,
    })

  } catch (error) {
    console.error('[Sync Catalog] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

// GET endpoint to check sync status and progress
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    // Check for running job (completed_at is NULL)
    const { data: runningJob } = await serviceClient
      .from('admin_sync_jobs')
      .select('*')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (runningJob) {
      // Extract progress from errors array (we store progress there)
      const progressInfo = runningJob.errors?.[0]
      const isProgress = progressInfo?.type === 'progress'

      return NextResponse.json({
        running: true,
        progress: {
          total: runningJob.total_items,
          completed: isProgress ? progressInfo.completed : 0,
          success: runningJob.success_count,
          failed: runningJob.failed_count,
          currentSku: isProgress ? progressInfo.currentSku : null,
          percent: isProgress ? Math.round((progressInfo.completed / runningJob.total_items) * 100) : 0,
        },
        lastSync: null,
      })
    }

    // Get last completed sync
    const { data: lastSync } = await serviceClient
      .from('admin_sync_jobs')
      .select('*')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      running: false,
      progress: null,
      lastSync,
    })

  } catch (error) {
    console.error('[Sync Status] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
    }, { status: 500 })
  }
}

// DELETE endpoint (no-op now since sync is synchronous)
export async function DELETE(request: NextRequest) {
  return NextResponse.json({ success: true, message: 'No sync running (sync is synchronous)' })
}

// SYNCHRONOUS sync function - runs in the request, doesn't die on hot-reload
async function runBulkSyncSynchronous(
  items: Array<{ style_id: string; stockx_product_id: string | null; alias_catalog_id: string | null }>,
  platform: string,
  onProgress?: ProgressCallback
): Promise<SyncResult> {
  const BATCH_DELAY_MS = 300 // 300ms between items
  const serviceClient = createServiceClient()

  const result: SyncResult = {
    total: items.length,
    completed: 0,
    success: 0,
    failed: 0,
    errors: [],
  }

  console.log(`[Bulk Sync] Starting SYNCHRONOUS: ${items.length} items, platform=${platform}`)

  for (const item of items) {
    try {
      let didSync = false

      // Sync StockX - always refresh if we have a product ID, or search if missing
      if (platform === 'both' || platform === 'stockx') {
        console.log(`[Bulk Sync] Syncing StockX: ${item.style_id}`)
        const syncResult = await syncStockxProductBySku(item.style_id)
        if (!syncResult.success) {
          throw new Error(syncResult.errors?.[0]?.error || 'StockX sync failed')
        }
        didSync = true
      }

      // Sync Alias - refresh if we have alias_catalog_id
      if ((platform === 'both' || platform === 'alias') && item.alias_catalog_id) {
        console.log(`[Bulk Sync] Syncing Alias: ${item.alias_catalog_id}`)
        const syncResult = await syncAliasProductByCatalogId(item.alias_catalog_id)
        if (!syncResult.success) {
          throw new Error(syncResult.errors?.[0]?.error || 'Alias sync failed')
        }
        didSync = true
      }

      // Skip items with no alias_catalog_id when syncing alias-only
      if (!didSync && platform === 'alias' && !item.alias_catalog_id) {
        // Can't sync Alias without knowing the catalog ID - skip
        result.success++
        result.completed++
        continue
      }

      // Mark this item as synced (update last_synced_at)
      if (didSync) {
        await serviceClient
          .from('inventory_v4_style_catalog')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('style_id', item.style_id)
      }

      result.success++
    } catch (err) {
      console.error(`[Bulk Sync] Error on ${item.style_id}:`, err)
      result.failed++
      result.errors.push({
        sku: item.style_id,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    result.completed++

    // Report progress
    if (onProgress) {
      await onProgress(result.completed, result.success, result.failed, item.style_id)
    }

    // Rate limit delay
    await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
  }

  console.log(`[Bulk Sync] Complete: ${result.success}/${result.total} success, ${result.failed} failed`)

  return result
}

// Alias mapper - discovers catalog IDs by searching Alias API
// (extracted from scripts/map-style-catalog-to-alias.ts)
async function runAliasMapper(
  items: Array<{ style_id: string }>,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ mapped: number; notFound: number; errors: number }> {
  const aliasClient = createAliasClient()
  let mapped = 0
  let notFound = 0
  let errors = 0

  for (const item of items) {
    const sku = item.style_id
    if (!sku?.trim()) {
      notFound++
      continue
    }

    try {
      // Search Alias by SKU
      const response = await aliasClient.searchCatalog(sku, { limit: 1 })
      const catalogItems = response?.catalog_items

      if (catalogItems && catalogItems.length > 0 && catalogItems[0]?.catalog_id) {
        const catalogId = catalogItems[0].catalog_id

        // Update style catalog with discovered alias_catalog_id
        const { error: updateError } = await supabase
          .from('inventory_v4_style_catalog')
          .update({ alias_catalog_id: catalogId })
          .eq('style_id', sku)

        if (updateError) {
          console.error(`[Alias Mapper] Update failed for ${sku}:`, updateError.message)
          errors++
        } else {
          console.log(`[Alias Mapper] Mapped ${sku} → ${catalogId}`)
          mapped++
        }
      } else {
        console.log(`[Alias Mapper] No match for ${sku}`)
        notFound++
      }
    } catch (err) {
      console.error(`[Alias Mapper] Error for ${sku}:`, err)
      errors++
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`[Alias Mapper] Complete: ${mapped} mapped, ${notFound} not found, ${errors} errors`)
  return { mapped, notFound, errors }
}
