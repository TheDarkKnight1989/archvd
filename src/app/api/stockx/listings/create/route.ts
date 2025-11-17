/**
 * StockX Create Listing API
 * POST /api/stockx/listings/create
 *
 * Creates a new ask listing on StockX for an inventory item
 * Validates mapping, price, and item status before creating
 * Returns operation ID for async tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService, validateListingRequest, calculateListingFees } from '@/lib/services/stockx/listings'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute

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
    const { inventoryItemId, askPrice, currency, expiryDays } = body

    // Validate required fields
    if (!inventoryItemId || !askPrice) {
      return NextResponse.json(
        { error: 'Missing required fields: inventoryItemId, askPrice' },
        { status: 400 }
      )
    }

    console.log('[Create Listing] Request:', { inventoryItemId, askPrice, currency })

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

    // Run validation
    const validationErrors = await validateListingRequest(user.id, inventoryItemId, askPrice)

    if (validationErrors.length > 0) {
      console.log('[Create Listing] Validation failed:', validationErrors)
      return NextResponse.json(
        {
          success: false,
          errors: validationErrors,
        },
        { status: 400 }
      )
    }

    // Get StockX mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id')
      .eq('item_id', inventoryItemId)
      .single()

    if (mappingError || !mapping) {
      return NextResponse.json(
        { error: 'StockX mapping not found for this item' },
        { status: 404 }
      )
    }

    // Calculate expiry time
    const expiryTime = expiryDays
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // Default 90 days

    // Create listing on StockX
    const operation = await StockxListingsService.createListing({
      productId: mapping.stockx_product_id,
      variantId: mapping.stockx_variant_id,
      amount: askPrice,
      currency: currency || 'USD',
      quantity: 1,
      expiresAt: expiryTime,
    })

    console.log('[Create Listing] Operation started:', operation.operationId)

    // Track operation in database
    const jobId = await StockxListingsService.trackOperation(
      user.id,
      'create_listing',
      operation.operationId,
      {
        inventoryItemId,
        askPrice,
        currency: currency || 'USD',
      }
    )

    // If operation completed immediately (mock mode), save listing
    if (operation.status === 'completed' && operation.result) {
      await StockxListingsService.saveListingToDatabase(
        user.id,
        inventoryItemId,
        operation.result
      )

      // Update inventory item status
      await supabase
        .from('Inventory')
        .update({ status: 'listed' })
        .eq('id', inventoryItemId)
    }

    // Calculate fee estimate for response
    const feeEstimate = calculateListingFees(askPrice, 1) // TODO: Get actual seller level

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      operationId: operation.operationId,
      jobId,
      status: operation.status,
      listingId: operation.result?.id,
      feeEstimate,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Create Listing] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
