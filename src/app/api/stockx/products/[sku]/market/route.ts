/**
 * StockX Product Market Data API
 * GET /api/stockx/products/[sku]/market?currency=GBP
 * Returns per-size latest ask/bid/last + timestamp
 */

import { NextRequest, NextResponse } from 'next/server'
import { isStockxEnabled, isStockxMockMode } from '@/lib/config/stockx'
import { getMarketData } from '@/lib/services/stockx/market'
import { supabase } from '@/lib/supabase/client'

// ============================================================================
// Types
// ============================================================================

interface SizeMarketData {
  size: string
  lowestAsk: number | null
  highestBid: number | null
  lastSale: number | null
  lastSaleDate: string | null
  salesLast72h?: number
  asOf: string | null
}

interface ProductMarketResponse {
  sku: string
  currency: string
  variants: SizeMarketData[]
  asOf: string
  source: 'cache' | 'api' | 'mock'
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_SIZES = ['8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12']

function generateMockMarketData(sku: string, currency: string): ProductMarketResponse {
  const basePrice = 150 + Math.random() * 200

  const variants: SizeMarketData[] = MOCK_SIZES.map((size) => {
    const sizeModifier = (parseFloat(size) - 10) * 5 // Smaller/larger sizes vary
    const price = basePrice + sizeModifier

    return {
      size,
      lowestAsk: price + 20 + Math.random() * 10,
      highestBid: price - 10 - Math.random() * 5,
      lastSale: price + Math.random() * 10 - 5,
      lastSaleDate: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
      salesLast72h: Math.floor(Math.random() * 50),
      asOf: new Date().toISOString(),
    }
  })

  return {
    sku,
    currency,
    variants,
    asOf: new Date().toISOString(),
    source: 'mock',
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert USD to target currency (simplified)
 */
function convertCurrency(amountUsd: number, targetCurrency: string): number {
  const rates: Record<string, number> = {
    USD: 1,
    GBP: 0.79,
    EUR: 0.92,
    JPY: 149.5,
  }

  const rate = rates[targetCurrency] || 1
  return amountUsd * rate
}

/**
 * Fetch cached market data from Supabase
 */
async function getCachedMarketData(
  sku: string,
  currency: string
): Promise<SizeMarketData[] | null> {
  try {
    const { data, error } = await supabase
      .from('stockx_latest_prices')
      .select('size, lowest_ask, highest_bid, last_sale, sales_last_72h, as_of')
      .eq('sku', sku)
      .eq('currency', currency)
      .order('size')

    if (error || !data || data.length === 0) {
      return null
    }

    // Check if data is stale (older than 1 hour)
    const latestAsOf = new Date(data[0].as_of).getTime()
    const oneHourAgo = Date.now() - 3600000

    if (latestAsOf < oneHourAgo) {
      console.log('[API /stockx/products/[sku]/market] Cached data is stale', {
        sku,
        latestAsOf: new Date(latestAsOf).toISOString(),
      })
      return null
    }

    return data.map((row) => ({
      size: row.size,
      lowestAsk: row.lowest_ask,
      highestBid: row.highest_bid,
      lastSale: row.last_sale,
      lastSaleDate: null, // Not stored in cache
      salesLast72h: row.sales_last_72h,
      asOf: row.as_of,
    }))
  } catch (error) {
    console.error('[API /stockx/products/[sku]/market] Cache fetch failed:', error)
    return null
  }
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const startTime = Date.now()
  const { sku } = await params

  try {
    // Check if StockX is enabled
    if (!isStockxEnabled()) {
      return NextResponse.json(
        { error: 'StockX integration is not enabled' },
        { status: 501 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const currency = searchParams.get('currency') || 'USD'
    const forceRefresh = searchParams.get('refresh') === 'true'

    console.log('[API /stockx/products/[sku]/market]', {
      sku,
      currency,
      forceRefresh,
      mockMode: isStockxMockMode(),
    })

    // Mock mode
    if (isStockxMockMode()) {
      const mockData = generateMockMarketData(sku, currency)
      const duration = Date.now() - startTime

      return NextResponse.json({
        ...mockData,
        duration_ms: duration,
      })
    }

    // Try cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = await getCachedMarketData(sku, currency)
      if (cachedData) {
        const duration = Date.now() - startTime

        console.log('[API /stockx/products/[sku]/market] Cache hit', {
          sku,
          sizesCount: cachedData.length,
          duration_ms: duration,
        })

        return NextResponse.json({
          sku,
          currency,
          variants: cachedData,
          asOf: cachedData[0]?.asOf || new Date().toISOString(),
          source: 'cache',
          duration_ms: duration,
        })
      }
    }

    // Cache miss - fetch from StockX API
    console.log('[API /stockx/products/[sku]/market] Cache miss, fetching from API', {
      sku,
      currency,
    })

    const marketData = await getMarketData(sku, currency)

    if (!marketData) {
      return NextResponse.json(
        { error: 'Product not found or no market data available' },
        { status: 404 }
      )
    }

    const duration = Date.now() - startTime

    console.log('[API /stockx/products/[sku]/market] API success', {
      sku,
      sizesCount: marketData.variants.length,
      duration_ms: duration,
    })

    // Store in cache (background - don't wait)
    storeCacheAsync(sku, currency, marketData.variants)

    return NextResponse.json({
      sku,
      currency,
      variants: marketData.variants.map((v) => ({
        size: v.size,
        lowestAsk: v.lowestAsk,
        highestBid: v.highestBid,
        lastSale: v.lastSale,
        lastSaleDate: v.lastSaleDate,
        asOf: marketData.as_of,
      })),
      asOf: marketData.as_of,
      source: 'api',
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[API /stockx/products/[sku]/market] Error', {
      error: error.message,
      sku,
      duration_ms: duration,
    })

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// Background Cache Storage
// ============================================================================

/**
 * Store market data in cache (fire and forget)
 */
async function storeCacheAsync(
  sku: string,
  currency: string,
  variants: Array<{
    size: string
    lowestAsk: number | null
    highestBid: number | null
    lastSale: number | null
  }>
) {
  try {
    const asOf = new Date().toISOString()

    const records = variants.map((v) => ({
      sku,
      size: v.size,
      currency,
      lowest_ask: v.lowestAsk,
      highest_bid: v.highestBid,
      last_sale: v.lastSale,
      as_of: asOf,
      source: 'stockx',
    }))

    const { error } = await supabase.from('stockx_market_prices').insert(records)

    if (error) {
      console.error('[API /stockx/products/[sku]/market] Cache storage failed:', error)
    } else {
      console.log('[API /stockx/products/[sku]/market] Cached market data', {
        sku,
        sizesCount: records.length,
      })
    }
  } catch (error) {
    console.error('[API /stockx/products/[sku]/market] Cache storage error:', error)
  }
}
