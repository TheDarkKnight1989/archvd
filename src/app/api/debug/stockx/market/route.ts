/**
 * DEBUG ROUTE: StockX Market Data Inspection
 *
 * POST /api/debug/stockx/market
 *
 * Purpose: Call StockX V2 API directly and return raw response
 * WITHOUT writing to database. Used to diagnose why certain products
 * have no market snapshot data.
 *
 * DO NOT USE IN PRODUCTION - FOR DEBUGGING ONLY
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxMarketService } from '@/lib/services/stockx/market'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface DebugMarketRequest {
  productId: string
  currencyCode?: 'GBP' | 'USD' | 'EUR'
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // ========================================================================
    // Step 1: Authenticate (optional - can remove if needed for pure debugging)
    // ========================================================================
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - login required for debug route' },
        { status: 401 }
      )
    }

    // ========================================================================
    // Step 2: Parse Request Body
    // ========================================================================
    let body: DebugMarketRequest

    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { productId, currencyCode = 'GBP' } = body

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid productId' },
        { status: 400 }
      )
    }

    logger.info('[DEBUG Market] Request received', {
      productId,
      currencyCode,
      userId: user.id,
    })

    // ========================================================================
    // Step 3: Call StockX V2 Market Data API
    // ========================================================================
    console.log('\n' + '='.repeat(70))
    console.log('[DEBUG Market] Calling StockX V2 API')
    console.log('='.repeat(70))
    console.log('Product ID:', productId)
    console.log('Currency:', currencyCode)
    console.log('Timestamp:', new Date().toISOString())
    console.log('='.repeat(70) + '\n')

    let marketDataResponse: any = null
    let apiError: any = null
    let httpStatus: number | null = null

    try {
      // Call the V2 market data service using static method
      // Fetch market data for all variants
      const variants = await StockxMarketService.getProductMarketData(
        productId,
        currencyCode
      )

      marketDataResponse = variants
      httpStatus = 200

      console.log('[DEBUG Market] ✅ StockX V2 API Response:')
      console.log('  Variants returned:', variants.length)

      if (variants.length > 0) {
        console.log('\n  Sample variant structure:')
        console.log(JSON.stringify(variants[0], null, 2))

        console.log('\n  All variant IDs:')
        variants.forEach((v: any, idx: number) => {
          console.log(`    [${idx}] ${v.variantId} - ${v.variantValue || 'N/A'}`)
          console.log(`        Lowest Ask: ${v.lowestAsk ?? 'null'}`)
          console.log(`        Highest Bid: ${v.highestBid ?? 'null'}`)
        })
      } else {
        console.log('  ⚠️  EMPTY ARRAY - No variants returned by StockX')
      }

    } catch (error: any) {
      apiError = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      }
      httpStatus = error.status || error.statusCode || 500

      console.error('[DEBUG Market] ❌ StockX V2 API Error:')
      console.error('  Error:', error.message)
      console.error('  Status:', httpStatus)
      if (error.response) {
        console.error('  Response:', JSON.stringify(error.response, null, 2))
      }
    }

    const duration = Date.now() - startTime

    console.log('\n' + '='.repeat(70))
    console.log(`[DEBUG Market] Request completed in ${duration}ms`)
    console.log('='.repeat(70) + '\n')

    // ========================================================================
    // Step 4: Return Diagnostic Response
    // ========================================================================
    return NextResponse.json({
      debug: true,
      timestamp: new Date().toISOString(),
      request: {
        productId,
        currencyCode,
      },
      stockxApi: {
        httpStatus,
        success: apiError === null,
        error: apiError,
        variantsCount: marketDataResponse?.length ?? 0,
        variants: marketDataResponse,
      },
      durationMs: duration,
      notes: [
        'This route calls StockX V2 API directly without writing to database',
        'Use this to diagnose why certain products have no market snapshots',
        'If variants array is empty, the product may be delisted or unavailable in this currency',
      ],
    })

  } catch (error: any) {
    const duration = Date.now() - startTime

    logger.error('[DEBUG Market] Unexpected error', {
      error: error.message,
      stack: error.stack,
      duration,
    })

    console.error('[DEBUG Market] ❌ Unexpected error:', error)

    return NextResponse.json(
      {
        debug: true,
        error: error.message || 'Unexpected error',
        stack: error.stack,
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}
