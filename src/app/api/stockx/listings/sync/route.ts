// @ts-nocheck
/**
 * StockX Listings Validation API
 * GET /api/stockx/listings/sync
 *
 * Validates existing linked listings against StockX
 * Does NOT auto-match listings to inventory items
 *
 * Use cases:
 * - Validate linked listings still exist on StockX
 * - Update listing status (active→inactive, sold, etc.)
 * - Detect deleted listings
 * - Report orphaned listings (exist on StockX but not in our DB) for manual review
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService } from '@/lib/services/stockx/listings'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
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

    console.log('[Validate Listings] Starting validation for user:', user.id)

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

    // Fetch all listings from StockX (active + inactive)
    const { listings: stockxListings } = await StockxListingsService.getAllListings(user.id, {
      limit: 100,
    })

    console.log(`[Validate Listings] Found ${stockxListings.length} listings on StockX`)

    // Get all listings we have in our database
    const { data: dbListings, error: dbError } = await supabase
      .from('stockx_listings')
      .select('stockx_listing_id, status')
      .eq('user_id', user.id)

    if (dbError) {
      console.error('[Validate Listings] Failed to fetch DB listings:', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch database listings', details: dbError.message },
        { status: 500 }
      )
    }

    console.log(`[Validate Listings] Found ${dbListings?.length || 0} listings in database`)

    // Create maps for quick lookup
    const stockxMap = new Map(stockxListings.map(l => [l.id, l]))
    const dbMap = new Map((dbListings || []).map(l => [l.stockx_listing_id, l]))

    const stats = {
      validated: 0,
      updated: 0,
      deleted: 0,
      orphaned: 0,
      errors: 0,
    }

    const orphanedListings = []

    // 1. Validate existing DB listings against StockX
    for (const dbListing of dbListings || []) {
      const stockxListing = stockxMap.get(dbListing.stockx_listing_id)

      if (!stockxListing) {
        // Listing exists in DB but not on StockX - mark as deleted
        console.log(`[Validate Listings] Listing ${dbListing.stockx_listing_id} deleted on StockX`)

        const { error: deleteError } = await supabase
          .from('stockx_listings')
          .update({
            status: 'DELETED',
            updated_at: new Date().toISOString(),
          })
          .eq('stockx_listing_id', dbListing.stockx_listing_id)

        if (deleteError) {
          console.error(`[Validate Listings] Failed to mark as deleted:`, deleteError)
          stats.errors++
        } else {
          stats.deleted++
        }

        // Also remove from inventory_market_links
        await supabase
          .from('inventory_market_links')
          .update({
            stockx_listing_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('stockx_listing_id', dbListing.stockx_listing_id)

        continue
      }

      stats.validated++

      // Update status if changed
      if (stockxListing.status !== dbListing.status) {
        const { error: updateError } = await supabase
          .from('stockx_listings')
          .update({
            status: stockxListing.status,
            amount: parseFloat(stockxListing.amount?.amount || '0'),
            expires_at: stockxListing.expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('stockx_listing_id', dbListing.stockx_listing_id)

        if (updateError) {
          console.error(`[Validate Listings] Failed to update listing:`, updateError)
          stats.errors++
        } else {
          stats.updated++
          console.log(`[Validate Listings] Updated ${dbListing.stockx_listing_id}: ${dbListing.status} → ${stockxListing.status}`)
        }
      }
    }

    // 2. Identify orphaned listings (exist on StockX but not in DB)
    for (const stockxListing of stockxListings) {
      if (!dbMap.has(stockxListing.id)) {
        stats.orphaned++
        orphanedListings.push({
          id: stockxListing.id,
          productId: stockxListing.productId,
          variantId: stockxListing.variantId,
          amount: stockxListing.amount,
          status: stockxListing.status,
          note: 'Created outside app or before tracking was implemented',
        })
      }
    }

    if (orphanedListings.length > 0) {
      console.log(`[Validate Listings] Found ${orphanedListings.length} orphaned listings`)
    }

    const duration = Date.now() - startTime

    console.log('[Validate Listings] Complete:', { ...stats, duration_ms: duration })

    return NextResponse.json({
      success: true,
      message: `Validated ${stats.validated} listings`,
      stats,
      orphanedListings: orphanedListings.length > 0 ? orphanedListings : undefined,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Validate Listings] Error:', {
      message: error.message,
      stack: error.stack,
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to validate listings',
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
