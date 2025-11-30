/**
 * StockX Combined Sync API
 * Syncs both inventory prices AND listings in a single request
 *
 * POST /api/stockx/sync-all
 *
 * DIRECTIVE COMPLIANCE:
 * - No direct StockX API calls in this route
 * - Delegates to worker orchestrator (syncAllInventoryItemsFromStockx)
 * - Delegates to listings sync (syncUserStockxListings)
 * - Runs both in parallel for optimal performance
 *
 * Pipeline:
 * 1. Validate user authentication
 * 2. Parse optional mode parameter (quick | full)
 * 3. Run both syncs in parallel with Promise.all
 * 4. Merge results and return combined summary
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncAllInventoryItemsFromStockx } from '@/lib/providers/stockx-worker'
import { syncUserStockxListings } from '@/lib/services/stockx/listings-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // ========================================================================
    // Step 1: Authenticate User
    // ========================================================================
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // ========================================================================
    // Step 2: Parse Request Body (Optional)
    // ========================================================================
    let mode: 'quick' | 'full' = 'quick' // Default to quick mode

    try {
      const body = await request.json()
      if (body.mode === 'full') {
        mode = 'full'
      }
    } catch {
      // No body or invalid JSON - use default quick mode
    }

    console.log('[StockX Sync-All] Starting combined sync', {
      userId: user.id,
      mode,
    })

    // ========================================================================
    // Step 3: Run Both Syncs in Parallel
    // ========================================================================
    const [priceResult, listingsResult] = await Promise.allSettled([
      // Price sync (inventory items with market data)
      syncAllInventoryItemsFromStockx({
        userId: user.id,
        mode: 'mapped-only', // Always use mapped-only for price sync
        limit: 100,
        cursor: null,
        dryRun: false,
      }),
      // Listings sync (active/pending listings)
      syncUserStockxListings(user.id, mode),
    ])

    const duration = Date.now() - startTime

    // ========================================================================
    // Step 4: Handle Results
    // ========================================================================

    // Extract price sync results
    const priceSync = priceResult.status === 'fulfilled'
      ? priceResult.value
      : null
    const priceSyncError = priceResult.status === 'rejected'
      ? String(priceResult.reason)
      : null

    // Extract listings sync results
    const listingsSync = listingsResult.status === 'fulfilled'
      ? listingsResult.value
      : null
    const listingsSyncError = listingsResult.status === 'rejected'
      ? String(listingsResult.reason)
      : null

    // Log results
    console.log('[StockX Sync-All] Combined sync completed', {
      userId: user.id,
      mode,
      duration_ms: duration,
      priceSync: priceSync ? {
        synced: priceSync.totalItemsSynced,
        skipped: priceSync.totalItemsSkipped,
        errors: priceSync.totalErrors,
      } : 'FAILED',
      listingsSync: listingsSync ? {
        remote: listingsSync.totalRemoteListings,
        updated: listingsSync.updatedStatuses,
        missing: listingsSync.markedMissing,
      } : 'FAILED',
    })

    // ========================================================================
    // Step 5: Return Combined Summary
    // ========================================================================

    // If both failed, return error
    if (!priceSync && !listingsSync) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Both syncs failed',
          details: {
            priceSync: priceSyncError,
            listingsSync: listingsSyncError,
          },
          durationMs: duration,
        },
        { status: 500 }
      )
    }

    // Return success with combined results
    return NextResponse.json({
      status: 'ok',
      mode,
      prices: priceSync ? {
        totalItemsScanned: priceSync.totalItemsScanned,
        totalItemsSynced: priceSync.totalItemsSynced,
        totalItemsSkipped: priceSync.totalItemsSkipped,
        totalErrors: priceSync.totalErrors,
        error: null,
      } : {
        totalItemsScanned: 0,
        totalItemsSynced: 0,
        totalItemsSkipped: 0,
        totalErrors: 0,
        error: priceSyncError,
      },
      listings: listingsSync ? {
        totalRemoteListings: listingsSync.totalRemoteListings,
        updatedStatuses: listingsSync.updatedStatuses,
        markedMissing: listingsSync.markedMissing,
        warnings: listingsSync.warnings || [],
        error: null,
      } : {
        totalRemoteListings: 0,
        updatedStatuses: 0,
        markedMissing: 0,
        warnings: [],
        error: listingsSyncError,
      },
      durationMs: duration,
    })

  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[StockX Sync-All] Unexpected error', {
      error: error.message,
      stack: error.stack,
      duration,
    })

    return NextResponse.json(
      {
        status: 'error',
        error: error.message || 'Failed to sync with StockX',
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}
