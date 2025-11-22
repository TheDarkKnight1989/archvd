// @ts-nocheck
/**
 * StockX Listings Sync Worker
 * GET /api/stockx/sync/listings
 *
 * Fetches all user listings from StockX and syncs them to the database
 * Updates listing status, prices, expiry, and metadata
 * Corrects mismatched statuses and identifies missing listings
 *
 * This should be called:
 * - Periodically via cron (e.g., every 15 minutes)
 * - After any listing operation completes
 * - On user demand (refresh listings)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService } from '@/lib/services/stockx/listings'
import { isStockxMockMode } from '@/lib/config/stockx'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for sync

type SyncStats = {
  totalListings: number
  updated: number
  created: number
  statusChanged: number
  priceChanged: number
  expiryChanged: number
  errors: number
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Listings Sync] Starting sync for user:', user.id)

    if (isStockxMockMode()) {
      return NextResponse.json(
        {
          success: false,
          message: 'StockX is in mock mode',
          stats: {
            totalListings: 0,
            updated: 0,
            created: 0,
            statusChanged: 0,
            priceChanged: 0,
            expiryChanged: 0,
            errors: 0,
          },
        },
        { status: 503 }
      )
    }

    const stats: SyncStats = {
      totalListings: 0,
      updated: 0,
      created: 0,
      statusChanged: 0,
      priceChanged: 0,
      expiryChanged: 0,
      errors: 0,
    }

    // 1. Fetch all user listings from StockX (client is user-specific via auth)
    const stockxListings = await StockxListingsService.getListings()
    stats.totalListings = stockxListings.length

    console.log(`[Listings Sync] Found ${stockxListings.length} listings on StockX`)

    // 2. Fetch all existing listings from database
    const { data: dbListings } = await supabase
      .from('stockx_listings')
      .select('*')
      .eq('user_id', user.id)

    const dbListingsMap = new Map(
      dbListings?.map((listing) => [listing.stockx_listing_id, listing]) || []
    )

    // 3. Process each StockX listing
    for (const stockxListing of stockxListings) {
      try {
        const existingListing = dbListingsMap.get(stockxListing.id)

        if (!existingListing) {
          // Create new listing in database (discovered via sync)
          const { error: insertError } = await supabase.from('stockx_listings').insert({
            user_id: user.id,
            stockx_listing_id: stockxListing.id,
            stockx_product_id: stockxListing.productId,
            stockx_variant_id: stockxListing.variantId,
            ask_price: stockxListing.amount,
            currency: stockxListing.currency,
            quantity: stockxListing.quantity,
            status: stockxListing.status,
            expires_at: stockxListing.expiresAt,
            created_at_stockx: stockxListing.createdAt,
            updated_at_stockx: stockxListing.updatedAt,
            metadata: stockxListing.metadata || {},
          })

          if (insertError) {
            console.error('[Listings Sync] Error inserting new listing:', insertError)
            stats.errors++
          } else {
            stats.created++
            console.log('[Listings Sync] Created new listing:', stockxListing.id)
          }
        } else {
          // Update existing listing if anything changed
          const updates: any = {
            updated_at: new Date().toISOString(),
            updated_at_stockx: stockxListing.updatedAt,
          }

          let hasChanges = false

          // Check for status changes
          if (existingListing.status !== stockxListing.status) {
            updates.status = stockxListing.status
            stats.statusChanged++
            hasChanges = true
            console.log(
              `[Listings Sync] Status changed for ${stockxListing.id}: ${existingListing.status} → ${stockxListing.status}`
            )
          }

          // Check for price changes
          if (existingListing.ask_price !== stockxListing.amount) {
            updates.ask_price = stockxListing.amount
            stats.priceChanged++
            hasChanges = true
            console.log(
              `[Listings Sync] Price changed for ${stockxListing.id}: ${existingListing.ask_price} → ${stockxListing.amount}`
            )
          }

          // Check for expiry changes
          if (existingListing.expires_at !== stockxListing.expiresAt) {
            updates.expires_at = stockxListing.expiresAt
            stats.expiryChanged++
            hasChanges = true
          }

          // Update currency if changed
          if (existingListing.currency !== stockxListing.currency) {
            updates.currency = stockxListing.currency
            hasChanges = true
          }

          // Update quantity if changed
          if (existingListing.quantity !== stockxListing.quantity) {
            updates.quantity = stockxListing.quantity
            hasChanges = true
          }

          // Update metadata if changed
          if (JSON.stringify(existingListing.metadata) !== JSON.stringify(stockxListing.metadata)) {
            updates.metadata = stockxListing.metadata || {}
            hasChanges = true
          }

          if (hasChanges) {
            const { error: updateError } = await supabase
              .from('stockx_listings')
              .update(updates)
              .eq('stockx_listing_id', stockxListing.id)

            if (updateError) {
              console.error('[Listings Sync] Error updating listing:', updateError)
              stats.errors++
            } else {
              stats.updated++
            }
          }
        }
      } catch (error: any) {
        console.error('[Listings Sync] Error processing listing:', error)
        stats.errors++
      }
    }

    // 4. Check for listings in DB that are no longer on StockX (orphaned)
    const stockxListingIds = new Set(stockxListings.map((l) => l.id))
    const orphanedListings = dbListings?.filter(
      (dbListing) =>
        !stockxListingIds.has(dbListing.stockx_listing_id) &&
        dbListing.status !== 'DELETED' &&
        dbListing.status !== 'MATCHED'
    )

    if (orphanedListings && orphanedListings.length > 0) {
      console.log(`[Listings Sync] Found ${orphanedListings.length} orphaned listings`)

      for (const orphaned of orphanedListings) {
        // Mark as deleted in our DB (no longer exists on StockX)
        await supabase
          .from('stockx_listings')
          .update({
            status: 'DELETED',
            updated_at: new Date().toISOString(),
          })
          .eq('stockx_listing_id', orphaned.stockx_listing_id)

        stats.statusChanged++
        stats.updated++

        console.log('[Listings Sync] Marked orphaned listing as deleted:', orphaned.stockx_listing_id)
      }
    }

    const duration = Date.now() - startTime

    logger.apiRequest(
      '/api/stockx/sync/listings',
      { user_id: user.id },
      duration,
      stats
    )

    console.log('[Listings Sync] Completed in', duration, 'ms:', stats)

    return NextResponse.json({
      success: true,
      message: 'Listings synced successfully',
      stats,
      durationMs: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    logger.error('[Listings Sync] Error', {
      message: error.message,
      stack: error.stack,
      durationMs: duration,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
