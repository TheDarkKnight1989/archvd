// @ts-nocheck
/**
 * StockX Listings Sync API
 *
 * GET /api/stockx/listings/sync
 * Validates existing linked listings against StockX
 * Does NOT auto-match listings to inventory items
 *
 * Use cases:
 * - Validate linked listings still exist on StockX
 * - Update listing status (active→inactive, sold, etc.)
 * - Detect deleted listings
 * - Report orphaned listings (exist on StockX but not in our DB) for manual review
 *
 * POST /api/stockx/listings/sync
 * Fixes broken listing IDs by matching on variant IDs
 *
 * WHY: After fixing the create listing bug, we need to update existing
 * listings in the database with their correct listing IDs from StockX
 *
 * Use cases:
 * - Fix listings that have operationIds instead of real listing IDs
 * - Match StockX listings to database records by variant ID
 * - Update database with correct listing IDs
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService } from '@/lib/services/stockx/listings'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

/**
 * POST /api/stockx/listings/sync
 * Fixes broken listing IDs by matching on variant IDs
 *
 * This solves the operationId bug where listings were created with
 * operationId as the listing ID, causing 404 errors on updates/cancels
 */
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

    const { batchSize = 100, dryRun = false } = await request.json().catch(() => ({}))

    console.log('[Sync Listings] Starting sync', { userId: user.id, batchSize, dryRun })

    // Fetch all listings from StockX API (paginated)
    let page = 1
    let hasMore = true
    const allStockxListings: any[] = []
    let apiCallCount = 0

    while (hasMore) {
      console.log(`[Sync Listings] Fetching page ${page}...`)

      const response = await StockxListingsService.getAllListings(user.id, {
        page,
        limit: batchSize,
      })

      apiCallCount++
      allStockxListings.push(...response.listings)

      console.log(`[Sync Listings] Page ${page}: Got ${response.listings.length} listings (total: ${allStockxListings.length})`)

      hasMore = response.listings.length === batchSize
      page++

      // Safety limit - prevent infinite loops
      if (page > 100) {
        console.warn('[Sync Listings] Hit page limit (100), stopping')
        break
      }
    }

    console.log(`[Sync Listings] Fetched ${allStockxListings.length} listings from StockX in ${apiCallCount} API calls`)

    // Build lookup map: variantId -> listing
    const variantToListing = new Map<string, any>()
    for (const listing of allStockxListings) {
      if (listing.variantId) {
        variantToListing.set(listing.variantId, listing)
      }
    }

    console.log('[Sync Listings] Built variant lookup map with', variantToListing.size, 'entries')

    // Fetch all inventory items with StockX mappings
    const { data: inventoryLinks, error: linksError } = await supabase
      .from('inventory_market_links')
      .select('item_id, stockx_product_id, stockx_variant_id, stockx_listing_id')
      .not('stockx_variant_id', 'is', null)

    if (linksError) {
      throw new Error(`Failed to fetch inventory links: ${linksError.message}`)
    }

    console.log(`[Sync Listings] Found ${inventoryLinks?.length || 0} inventory items with StockX mappings`)

    // Process updates
    const updates: Array<{ itemId: string; oldListingId: string | null; newListingId: string; variantId: string }> = []
    const noMatch: Array<{ itemId: string; variantId: string }> = []
    const alreadyCorrect: Array<{ itemId: string; listingId: string }> = []

    for (const link of inventoryLinks || []) {
      const variantId = link.stockx_variant_id
      const stockxListing = variantToListing.get(variantId)

      if (stockxListing) {
        const currentListingId = link.stockx_listing_id
        const correctListingId = stockxListing.id

        if (currentListingId !== correctListingId) {
          updates.push({
            itemId: link.item_id,
            oldListingId: currentListingId,
            newListingId: correctListingId,
            variantId,
          })
        } else {
          alreadyCorrect.push({
            itemId: link.item_id,
            listingId: currentListingId,
          })
        }
      } else if (link.stockx_listing_id) {
        // Has a listing ID but no match in StockX API - might be cancelled/expired
        noMatch.push({
          itemId: link.item_id,
          variantId,
        })
      }
    }

    console.log('[Sync Listings] Analysis:', {
      needsUpdate: updates.length,
      alreadyCorrect: alreadyCorrect.length,
      noMatch: noMatch.length,
    })

    let updatedCount = 0
    const errors: Array<{ itemId: string; error: string }> = []

    if (!dryRun && updates.length > 0) {
      // Update inventory_market_links with correct listing IDs
      for (const update of updates) {
        try {
          const { error: updateError } = await supabase
            .from('inventory_market_links')
            .update({ stockx_listing_id: update.newListingId })
            .eq('item_id', update.itemId)

          if (updateError) {
            errors.push({ itemId: update.itemId, error: updateError.message })
          } else {
            updatedCount++
          }
        } catch (err: any) {
          errors.push({ itemId: update.itemId, error: err.message })
        }
      }

      // Also update stockx_listings table
      for (const update of updates) {
        try {
          // Get the listing from StockX data
          const stockxListing = variantToListing.get(update.variantId)

          if (stockxListing) {
            // Check if a record exists for this variant
            const { data: existingListing } = await supabase
              .from('stockx_listings')
              .select('id')
              .eq('stockx_variant_id', update.variantId)
              .eq('user_id', user.id)
              .single()

            if (existingListing) {
              // Update existing record
              const { error: listingUpdateError } = await supabase
                .from('stockx_listings')
                .update({
                  stockx_listing_id: update.newListingId,
                  status: stockxListing.status || 'ACTIVE',
                  amount: Math.round(parseFloat(stockxListing.amount?.amount || '0') * 100),
                  currency_code: stockxListing.amount?.currencyCode || 'GBP',
                  expires_at: stockxListing.expiresAt,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingListing.id)

              if (listingUpdateError) {
                console.warn('[Sync Listings] Failed to update stockx_listings:', listingUpdateError)
              }
            }
          }
        } catch (err: any) {
          console.warn('[Sync Listings] Error updating stockx_listings:', err.message)
        }
      }

      console.log(`[Sync Listings] Updated ${updatedCount} records`)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      dryRun,
      stats: {
        totalStockxListings: allStockxListings.length,
        totalInventoryItems: inventoryLinks?.length || 0,
        needsUpdate: updates.length,
        alreadyCorrect: alreadyCorrect.length,
        noMatch: noMatch.length,
        updated: updatedCount,
        errors: errors.length,
      },
      updates: dryRun ? updates : undefined,
      noMatch: noMatch.length > 0 ? noMatch : undefined,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Sync Listings] Error:', {
      message: error.message,
      stack: error.stack,
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync listings',
        details: error.stack,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
