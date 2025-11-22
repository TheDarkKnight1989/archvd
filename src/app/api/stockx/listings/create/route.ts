// @ts-nocheck
/**
 * StockX Create Listing API
 * POST /api/stockx/listings/create
 *
 * Creates a new ask listing on StockX for an inventory item
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
    const expiryTime = expiryDate.toISOString() // Keep milliseconds: 2021-11-09T12:44:31.000Z

    // Create listing on StockX
    console.log('[Create Listing] Calling StockX API with:', {
      userId: user.id,
      productId: mapping.stockx_product_id,
      variantId: mapping.stockx_variant_id,
      amount: askPrice,
      currencyCode: currencyCode || 'USD',
    })

    const operation = await StockxListingsService.createListing(user.id, {
      productId: mapping.stockx_product_id,
      variantId: mapping.stockx_variant_id,
      amount: askPrice,
      currencyCode: currencyCode || 'USD',
      quantity: 1,
      expiresAt: expiryTime,
    })

    console.log('[Create Listing] Operation completed:', operation)

    // Create batch job for operation tracking
    const { data: job, error: jobError } = await supabase
      .from('stockx_batch_jobs')
      .insert({
        user_id: user.id,
        job_type: 'create_listing',
        status: 'PENDING',
        stockx_operation_id: operation.operationId,
        total_items: 1,
        processed_items: 0,
        failed_items: 0,
        started_at: new Date().toISOString(),
        metadata: {
          inventoryItemId,
          askPrice,
          currencyCode: currencyCode || 'USD',
          productId: mapping.stockx_product_id,
          variantId: mapping.stockx_variant_id,
        },
      })
      .select()
      .single()

    if (jobError) {
      console.error('[Create Listing] Failed to create batch job:', jobError)
      // Don't fail the request, job will still be polled eventually
    } else {
      console.log('[Create Listing] Batch job created:', job.id)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      operationId: operation.operationId,
      status: operation.status,
      listingId: operation.result?.id,
      jobId: job?.id,
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
