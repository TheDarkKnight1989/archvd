// @ts-nocheck
/**
 * StockX Update Listing API
 * POST /api/stockx/listings/update
 *
 * Updates an existing ask listing on StockX
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
    const { listingId, askPrice, currencyCode, expiryDays } = body

    // Validate required fields
    if (!listingId) {
      return NextResponse.json(
        { error: 'Missing required field: listingId' },
        { status: 400 }
      )
    }

    console.log('[Update Listing] Request:', { listingId, askPrice, currencyCode })

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

    // Note: No need to verify listing in our DB - StockX API will validate ownership
    // This allows updates to work even if stockx_listings table isn't populated

    // Calculate expiry time if provided
    let expiryTime: string | undefined
    if (expiryDays) {
      const expiryDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      expiryTime = expiryDate.toISOString()
    }

    // Update listing on StockX
    console.log('[Update Listing] Calling StockX API with:', {
      userId: user.id,
      listingId,
      amount: askPrice,
      currencyCode: currencyCode || 'GBP',
      expiresAt: expiryTime,
    })

    const operation = await StockxListingsService.updateListing(
      user.id,
      listingId,
      {
        amount: askPrice,
        currencyCode: currencyCode || 'GBP',
        expiresAt: expiryTime,
      }
    )

    console.log('[Update Listing] Operation completed:', operation)

    // Update local stockx_listings table to reflect the new price
    // First, look up the variant_id from inventory_market_links
    if (askPrice !== undefined) {
      const { data: link, error: linkError } = await supabase
        .from('inventory_market_links')
        .select('stockx_variant_id')
        .eq('stockx_listing_id', listingId)
        .single()

      if (linkError || !link) {
        console.warn('[Update Listing] Could not find variant for listing:', listingId)
      } else {
        // Update stockx_listings using variant_id + user_id (since listing_id might be null)
        const { error: updateError } = await supabase
          .from('stockx_listings')
          .update({
            stockx_listing_id: listingId, // Also set the listing ID if it was null
            amount: Math.round(askPrice * 100), // Convert pounds to cents
            currency_code: currencyCode || 'GBP',
            expires_at: expiryTime || null,
            updated_at: new Date().toISOString(),
          })
          .eq('stockx_variant_id', link.stockx_variant_id)
          .eq('user_id', user.id)

        if (updateError) {
          console.warn('[Update Listing] Failed to update local cache:', updateError.message)
        } else {
          console.log('[Update Listing] ✅ Local cache updated with new price:', askPrice)
        }
      }

      // V4: Update inventory_v4_listings (source of truth for V4 inventory)
      // Normalize price to avoid floating point issues (e.g., 9999.99 instead of 10000)
      const normalizedPrice = parseFloat(askPrice.toFixed(2))
      const { error: v4UpdateError } = await supabase
        .from('inventory_v4_listings')
        .update({
          listed_price: normalizedPrice,
          listed_currency: currencyCode || 'GBP',
          updated_at: new Date().toISOString(),
        })
        .eq('external_listing_id', listingId)
        .eq('platform', 'stockx')
        .eq('user_id', user.id)

      if (v4UpdateError) {
        console.warn('[Update Listing] Failed to update inventory_v4_listings:', v4UpdateError)
      } else {
        console.log('[Update Listing] ✅ V4 listings updated with price:', normalizedPrice)
      }
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

    console.error('[Update Listing] Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update listing',
        details: error.stack,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
