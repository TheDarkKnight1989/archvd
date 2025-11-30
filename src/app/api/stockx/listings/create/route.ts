// @ts-nocheck
/**
 * StockX Create Listing API
 * POST /api/stockx/listings/create
 *
 * Creates a new ask listing on StockX for an inventory item
 * Saves the listingId directly to inventory_market_links
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
    const { inventoryItemId, askPrice, currencyCode, expiryDays } = body

    // Validate required fields
    if (!inventoryItemId || !askPrice) {
      return NextResponse.json(
        { error: 'Missing required fields: inventoryItemId, askPrice' },
        { status: 400 }
      )
    }

    console.log('[Create Listing] Request:', { inventoryItemId, askPrice, currencyCode })

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

    // Get StockX mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id')
      .eq('item_id', inventoryItemId)
      .single()

    if (mappingError) {
      console.error('[Create Listing] Mapping query error:', mappingError)
      return NextResponse.json(
        {
          code: 'NO_MAPPING',
          error: 'This item is not linked to StockX. Please map it first.',
          details: mappingError.message,
        },
        { status: 400 }
      )
    }

    if (!mapping) {
      console.log('[Create Listing] No mapping found for item:', inventoryItemId)
      return NextResponse.json(
        {
          code: 'NO_MAPPING',
          error: 'This item is not linked to StockX. Please map it first.',
        },
        { status: 400 }
      )
    }

    if (!mapping.stockx_product_id || !mapping.stockx_variant_id) {
      console.error('[Create Listing] Incomplete mapping:', { inventoryItemId, mapping })
      return NextResponse.json(
        {
          code: 'INCOMPLETE_MAPPING',
          error: 'StockX mapping is incomplete. Missing product or variant ID.',
          details: `productId: ${mapping.stockx_product_id}, variantId: ${mapping.stockx_variant_id}`,
        },
        { status: 400 }
      )
    }

    // Calculate expiry time (StockX requires ISO 8601 with .000Z format)
    const expiryDate = expiryDays
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // Default 90 days
    const expiryTime = expiryDate.toISOString()

    // Create listing on StockX
    console.log('[Create Listing] Calling StockX API with:', {
      userId: user.id,
      productId: mapping.stockx_product_id,
      variantId: mapping.stockx_variant_id,
      amount: askPrice,
      currencyCode: currencyCode || 'GBP',
    })

    const operation = await StockxListingsService.createListing(user.id, {
      productId: mapping.stockx_product_id,
      variantId: mapping.stockx_variant_id,
      amount: askPrice,
      currencyCode: currencyCode || 'GBP',
      quantity: 1,
      expiresAt: expiryTime,
    })

    // Extract listing ID from StockX response
    const listingId = operation.listingId

    if (!listingId) {
      console.error('[Create Listing] ERROR: No listing ID in response')
      console.error('[Create Listing] Response:', JSON.stringify(operation, null, 2))
      throw new Error('StockX did not return a listing ID')
    }

    const listingStatus = operation.status === 'completed' ? 'ACTIVE' : 'PENDING'
    console.log('[Create Listing] Listing created:', listingId, `(${listingStatus})`)

    // 1. Save listing ID and status to inventory_market_links (needed for updates/deletes)
    const nowIso = new Date().toISOString()
    const { error: linkError } = await supabase
      .from('inventory_market_links')
      .update({
        stockx_listing_id: listingId,
        stockx_listing_status: listingStatus, // FIX: Set status so UI can find this listing
        stockx_last_listing_sync_at: nowIso,
        stockx_listing_payload: operation, // Store full StockX response for audit trail
        updated_at: nowIso,
      })
      .eq('item_id', inventoryItemId)

    if (linkError) {
      console.error('[Create Listing] Failed to save listing ID:', linkError)
      throw new Error(`Database error: ${linkError.message}`)
    }

    console.log('[Create Listing] ✅ Listing ID and status saved to inventory_market_links:', {
      listingId,
      status: listingStatus,
    })

    // 2. Look up internal catalog IDs for stockx_listings table
    const { data: product, error: productError } = await supabase
      .from('stockx_products')
      .select('id')
      .eq('stockx_product_id', mapping.stockx_product_id)
      .single()

    const { data: variant, error: variantError } = await supabase
      .from('stockx_variants')
      .select('id')
      .eq('stockx_variant_id', mapping.stockx_variant_id)
      .single()

    if (productError || variantError || !product || !variant) {
      console.warn('[Create Listing] Missing catalog data - skipping stockx_listings tracking:', {
        productError: productError?.message,
        variantError: variantError?.message,
        hasProduct: !!product,
        hasVariant: !!variant,
      })
      console.warn('[Create Listing] This is OK - listing ID is saved in inventory_market_links')
    } else {
      // 3. Track status in stockx_listings table (only if we have catalog data)
      const { error: trackingError } = await supabase
        .from('stockx_listings')
        .upsert({
          stockx_listing_id: listingId,
          user_id: user.id,
          stockx_product_id: mapping.stockx_product_id,
          stockx_variant_id: mapping.stockx_variant_id,
          product_id: product.id,
          variant_id: variant.id,
          status: listingStatus,
          amount: Math.round(askPrice * 100), // Convert pounds to cents (database stores as integer)
          currency_code: currencyCode || 'GBP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'stockx_listing_id'
        })

      if (trackingError) {
        console.warn('[Create Listing] Failed to track in stockx_listings:', trackingError.message)
      } else {
        console.log('[Create Listing] ✅ Status tracked:', listingStatus)
      }
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      listingId: listingId,
      status: listingStatus,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Create Listing] Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create listing',
        details: error.stack,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
