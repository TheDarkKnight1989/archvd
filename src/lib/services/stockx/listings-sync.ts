/**
 * StockX Listings Sync Engine
 * Syncs user's StockX listings to local database
 *
 * @deprecated INTENTIONALLY V3 - This syncs to V3 `stockx_listings` table.
 *             V4 listing state is managed by `inventory_v4_listings` table.
 *             Kept for backwards compatibility with listings management page.
 *             New listing operations should update V4 tables.
 *
 * This function is pure and reusable - can be called from:
 * - Manual sync API route (user-triggered)
 * - Railway worker (automated, future)
 */

import { getStockxClient } from './client'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

export interface SyncSummary {
  totalRemoteListings: number
  totalLocalListings: number
  updatedStatuses: number
  markedMissing: number
  unchanged: number
  warnings: string[]
}

interface RemoteListingInfo {
  status: string
  variantId?: string
  productId?: string
  fullPayload: any
}

// ============================================================================
// Main Sync Function
// ============================================================================

/**
 * Sync a user's StockX listings from StockX API to local database
 *
 * Algorithm:
 * 1. Fetch listings from StockX (filtered by mode)
 * 2. Build Set of remote listing IDs
 * 3. Query local inventory_market_links (via items join for user filter)
 * 4. For each local link:
 *    - If listing exists on StockX → update status & payload
 *    - If listing does NOT exist → mark as MISSING
 * 5. Update last_sync timestamps
 *
 * @param userId - Supabase user ID
 * @param mode - 'quick' (ACTIVE/PENDING only, fast) or 'full' (all statuses, slow)
 * @returns Summary of sync operation
 */
export async function syncUserStockxListings(
  userId: string,
  mode: 'quick' | 'full' = 'quick'
): Promise<SyncSummary> {
  const warnings: string[] = []

  try {
    // ========================================================================
    // 1. Get StockX client for this user
    // ========================================================================

    const stockx = await getStockxClient(userId)

    // ========================================================================
    // 2. Fetch ALL listings from StockX (with pagination)
    // ========================================================================

    console.log('[StockX Listings Sync] Starting sync for user:', userId, 'mode:', mode)

    // Quick mode: Only fetch ACTIVE and PENDING listings (fast, covers 95% of use cases)
    // Full mode: Fetch all statuses (slow, but catches sold/expired/cancelled)
    const statusFilter = mode === 'quick' ? 'ACTIVE,PENDING' : ''

    const remoteById = new Map<string, RemoteListingInfo>()
    let pageNumber = 1
    const pageSize = 100
    let totalFetched = 0
    const MAX_PAGES = 100 // Safety limit to prevent infinite loops

    // Paginate through listings
    while (pageNumber <= MAX_PAGES) {
      const endpoint = statusFilter
        ? `/v2/selling/listings?listingStatuses=${statusFilter}&pageSize=${pageSize}&pageNumber=${pageNumber}`
        : `/v2/selling/listings?pageSize=${pageSize}&pageNumber=${pageNumber}`

      console.log('[StockX Listings Sync] Fetching page:', {
        pageNumber,
        pageSize,
        endpoint,
      })

      const response = await stockx.request(endpoint)

      // Extract listings from response
      // Response structure: { count, pageNumber, pageSize, hasNextPage, listings }
      const listings = response.listings || []
      const total = response.count || 0

      console.log('[StockX Listings Sync] Received:', {
        listingsInPage: listings.length,
        totalListings: total,
        currentPage: pageNumber,
        responseKeys: Object.keys(response),
        paginationKeys: response.pagination ? Object.keys(response.pagination) : null,
        sampleListing: listings[0] ? {
          listingId: listings[0].listingId,
          status: listings[0].status,
          hasVariant: !!listings[0].variant,
          hasProduct: !!listings[0].product,
        } : null,
      })

      // Build map of remote listings
      for (const listing of listings) {
        const listingId = listing?.listingId
        if (!listingId) continue

        const status: string = listing?.status || 'UNKNOWN'

        // DEBUG: Log first payload to see structure
        if (remoteById.size === 0) {
          console.log('[StockX Listings Sync] Sample listing object:', {
            fullListing: listing,
            listingId: listing.listingId,
            status: listing.status,
            ask: listing.ask,
            amount: listing.amount,
            allKeys: Object.keys(listing),
          })
        }

        remoteById.set(listingId, {
          status,
          variantId: listing?.variant?.variantId,
          productId: listing?.product?.productId,
          fullPayload: listing, // Store full listing for audit trail
        })
      }

      totalFetched += listings.length

      // Check if there are more pages using the hasNextPage flag from response
      const hasNextPage = response.hasNextPage || false

      if (!hasNextPage || listings.length === 0) {
        console.log('[StockX Listings Sync] Pagination complete:', {
          totalPages: pageNumber,
          totalListings: remoteById.size,
        })
        break
      }

      pageNumber += 1
    }

    const totalRemoteListings = remoteById.size

    console.log('[StockX Listings Sync] Fetched all remote listings:', {
      totalRemoteListings,
      totalFetched,
    })

    // ========================================================================
    // 3. Fetch local inventory_market_links (filtered by user_id)
    // ========================================================================

    const supabase = await createServiceRoleClient()

    // Query inventory_market_links for this user
    // In quick mode: only check ACTIVE/PENDING listings (fast)
    // In full mode: check all listings (slow but thorough)
    let query = supabase
      .from('inventory_market_links')
      .select('id, item_id, user_id, stockx_product_id, stockx_variant_id, stockx_listing_id, stockx_listing_status')
      .eq('user_id', userId)
      .not('stockx_listing_id', 'is', null)

    if (mode === 'quick') {
      query = query.in('stockx_listing_status', ['ACTIVE', 'PENDING', 'UNKNOWN'])
    }

    const { data: localLinks, error: linksError } = await query

    if (linksError) {
      console.error('[StockX Listings Sync] Failed to fetch local links:', linksError)
      throw new Error(`Failed to fetch local listings: ${linksError.message}`)
    }

    const totalLocalListings = localLinks?.length || 0

    console.log('[StockX Listings Sync] Fetched local links:', {
      totalLocalListings,
    })

    // ========================================================================
    // 4. Compare and build updates
    // ========================================================================

    let updatedStatuses = 0
    let markedMissing = 0
    let unchanged = 0

    const updates: Array<{
      id: string
      item_id: string
      user_id: string
      stockx_product_id: string
      stockx_variant_id: string
      stockx_listing_id?: string | null  // Cleared when MISSING, preserved when ACTIVE
      stockx_listing_status: string
      stockx_last_listing_sync_at: string
      stockx_listing_payload: any | null
    }> = []

    const nowIso = new Date().toISOString()

    for (const link of localLinks || []) {
      const listingId = link.stockx_listing_id as string | null
      if (!listingId) {
        unchanged++
        continue
      }

      const remote = remoteById.get(listingId)

      // Case A: Listing no longer exists on StockX → mark as MISSING
      if (!remote) {
        const newStatus = 'MISSING'

        if (link.stockx_listing_status !== newStatus) {
          updates.push({
            id: link.id,
            item_id: link.item_id,
            user_id: link.user_id,
            stockx_product_id: link.stockx_product_id,
            stockx_variant_id: link.stockx_variant_id,
            stockx_listing_id: null, // IMPORTANT: Clear listing_id so it doesn't show as "Listed" in Portfolio
            stockx_listing_status: newStatus,
            stockx_last_listing_sync_at: nowIso,
            stockx_listing_payload: null, // Clear payload for missing listings
          })
          markedMissing++

          console.log('[StockX Listings Sync] Marking as MISSING:', {
            linkId: link.id,
            listingId,
            previousStatus: link.stockx_listing_status,
          })
        } else {
          // Already marked MISSING, just update sync time
          updates.push({
            id: link.id,
            item_id: link.item_id,
            user_id: link.user_id,
            stockx_product_id: link.stockx_product_id,
            stockx_variant_id: link.stockx_variant_id,
            stockx_listing_id: null, // IMPORTANT: Keep listing_id cleared
            stockx_listing_status: newStatus,
            stockx_last_listing_sync_at: nowIso,
            stockx_listing_payload: null,
          })
          unchanged++
        }
        continue
      }

      // Case B: Listing exists → update status if changed
      const remoteStatus = remote.status || 'UNKNOWN'

      if (link.stockx_listing_status !== remoteStatus) {
        updates.push({
          id: link.id,
          item_id: link.item_id,
          user_id: link.user_id,
          stockx_product_id: link.stockx_product_id,
          stockx_variant_id: link.stockx_variant_id,
          stockx_listing_status: remoteStatus,
          stockx_last_listing_sync_at: nowIso,
          stockx_listing_payload: remote.fullPayload,
        })
        updatedStatuses++

        console.log('[StockX Listings Sync] Status changed:', {
          linkId: link.id,
          listingId,
          oldStatus: link.stockx_listing_status,
          newStatus: remoteStatus,
        })
      } else {
        // Status unchanged, but still update sync time and payload
        updates.push({
          id: link.id,
          item_id: link.item_id,
          user_id: link.user_id,
          stockx_product_id: link.stockx_product_id,
          stockx_variant_id: link.stockx_variant_id,
          stockx_listing_status: link.stockx_listing_status || remoteStatus,
          stockx_last_listing_sync_at: nowIso,
          stockx_listing_payload: remote.fullPayload,
        })
        unchanged++
      }
    }

    console.log('[StockX Listings Sync] Updates summary:', {
      totalUpdates: updates.length,
      updatedStatuses,
      markedMissing,
      unchanged,
    })

    // ========================================================================
    // 5. Apply updates in batches (using service role client to bypass RLS)
    // ========================================================================

    const BATCH_SIZE = 100
    const adminClient = createServiceRoleClient()

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE)

      // DEBUG: Log first item in first batch to see what's being sent
      if (i === 0 && batch.length > 0) {
        console.log('[StockX Listings Sync] Sample update being sent to DB:', {
          firstUpdate: batch[0],
          hasPayload: !!batch[0].stockx_listing_payload,
          payloadKeys: batch[0].stockx_listing_payload ? Object.keys(batch[0].stockx_listing_payload) : null,
          payloadSample: batch[0].stockx_listing_payload,
        })
      }

      const { error: updateError } = await adminClient
        .from('inventory_market_links')
        .upsert(batch, {
          onConflict: 'id',
        })

      if (updateError) {
        const errorMsg = `Failed to upsert batch starting at index ${i}: ${updateError.message}`
        console.error('[StockX Listings Sync]', errorMsg)
        warnings.push(errorMsg)
      } else {
        console.log('[StockX Listings Sync] Batch updated successfully:', {
          batchIndex: Math.floor(i / BATCH_SIZE) + 1,
          batchSize: batch.length,
        })
      }
    }

    // ========================================================================
    // 6. Update last_listing_sync_at in stockx_accounts
    // ========================================================================

    const { error: acctError } = await supabase
      .from('stockx_accounts')
      .update({ last_listing_sync_at: nowIso })
      .eq('user_id', userId)

    if (acctError) {
      const errorMsg = `Failed to update stockx_accounts.last_listing_sync_at: ${acctError.message}`
      console.warn('[StockX Listings Sync]', errorMsg)
      warnings.push(errorMsg)
    }

    // ========================================================================
    // 7. Return summary
    // ========================================================================

    const summary: SyncSummary = {
      totalRemoteListings,
      totalLocalListings,
      updatedStatuses,
      markedMissing,
      unchanged,
      warnings,
    }

    console.log('[StockX Listings Sync] Sync complete:', summary)

    return summary

  } catch (error: any) {
    console.error('[StockX Listings Sync] Fatal error:', {
      error: error.message,
      stack: error.stack,
    })
    throw error
  }
}
