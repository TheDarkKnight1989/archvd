// @ts-nocheck
/**
 * StockX Delete Listing API
 * POST /api/stockx/listings/delete
 *
 * Deletes (cancels) a StockX listing
 * Returns operationId for async tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService } from '@/lib/services/stockx/listings'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { listingId } = body

    // Validate required fields
    if (!listingId) {
      return NextResponse.json(
        { error: 'Missing required field: listingId' },
        { status: 400 }
      )
    }

    console.log('[Delete Listing] Request:', { listingId, userId: user.id })

    // Check if StockX is in mock mode
    if (isStockxMockMode()) {
      return NextResponse.json(
        {
          success: false,
          error: 'StockX is in mock mode. Real API calls are disabled.',
        },
        { status: 503 }
      )
    }

    // Delete listing on StockX
    console.log('[Delete Listing] Calling StockX API with:', {
      userId: user.id,
      listingId,
    })

    const operation = await StockxListingsService.deleteListing(user.id, listingId)

    console.log('[Delete Listing] Operation completed:', operation)

    // Get variant_id from inventory_market_links before removing listing_id
    const { data: link } = await supabase
      .from('inventory_market_links')
      .select('stockx_variant_id')
      .eq('stockx_listing_id', listingId)
      .single()

    // Update local cache - remove listing ID from inventory_market_links
    // Note: RLS will ensure user can only update their own items
    const { error: linkUpdateError } = await supabase
      .from('inventory_market_links')
      .update({
        stockx_listing_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('stockx_listing_id', listingId)

    if (linkUpdateError) {
      console.warn('[Delete Listing] Failed to update inventory_market_links:', linkUpdateError.message)
    } else {
      console.log('[Delete Listing] ✅ Removed listing ID from inventory_market_links')
    }

    // Delete from stockx_listings table
    // Try to delete by listing_id first, then fall back to deleting orphaned entries by variant_id
    let deleteError = null

    // First try: delete by listing_id (if the entry has it populated)
    const { error: deleteByIdError, count: deleteByIdCount } = await supabase
      .from('stockx_listings')
      .delete({ count: 'exact' })
      .eq('stockx_listing_id', listingId)
      .eq('user_id', user.id)

    if (deleteByIdError) {
      deleteError = deleteByIdError
      console.warn('[Delete Listing] Failed to delete by listing_id:', deleteByIdError.message)
    } else if (deleteByIdCount && deleteByIdCount > 0) {
      console.log('[Delete Listing] ✅ Deleted from stockx_listings cache (by listing_id)')
    } else if (link?.stockx_variant_id) {
      // Second try: delete orphaned entries (NULL listing_id) for this variant
      const { error: deleteOrphanError } = await supabase
        .from('stockx_listings')
        .delete()
        .eq('stockx_variant_id', link.stockx_variant_id)
        .eq('user_id', user.id)
        .is('stockx_listing_id', null)

      if (deleteOrphanError) {
        deleteError = deleteOrphanError
        console.warn('[Delete Listing] Failed to delete orphaned entries:', deleteOrphanError.message)
      } else {
        console.log('[Delete Listing] ✅ Deleted orphaned entries from stockx_listings cache')
      }
    } else {
      console.warn('[Delete Listing] Could not find variant_id, skipping stockx_listings cleanup')
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      operationId: operation.operationId,
      status: operation.status,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Delete Listing] Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete listing',
        details: error.stack,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
