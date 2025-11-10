/**
 * StockX Product Search API
 * GET /api/stockx/search?q=nike+dunk&currency=GBP
 * Returns enriched sneaker results with median price, 7-day sparkline, and Δ7d
 */

import { NextRequest, NextResponse } from 'next/server'
import { isStockxEnabled, isStockxMockMode } from '@/lib/config/stockx'
import { searchProducts } from '@/lib/services/stockx/products'
import { getSalesHistory } from '@/lib/services/stockx/market'
import { supabase } from '@/lib/supabase/client'

// ============================================================================
// Types
// ============================================================================

interface EnrichedSearchResult {
  id: string
  sku: string
  name: string
  brand: string
  imageUrl: string | null
  medianPrice: number | null
  currency: string
  delta7d: number | null
  sparkline7d: Array<{ date: string; value: number }>
  lastSale: number | null
  lowestAsk: number | null
  asOf: string | null
}

// ============================================================================
// Mock Data for Quick Testing
// ============================================================================

const MOCK_SEARCH_RESULTS: EnrichedSearchResult[] = [
  {
    id: 'mock-stockx-001',
    sku: 'DD1391-100',
    name: 'Nike Dunk Low Panda (2021)',
    brand: 'Nike',
    imageUrl: 'https://images.stockx.com/images/Nike-Dunk-Low-Panda.jpg',
    medianPrice: 145.50,
    currency: 'GBP',
    delta7d: 2.3,
    sparkline7d: [
      { date: '2025-11-03', value: 142 },
      { date: '2025-11-04', value: 143 },
      { date: '2025-11-05', value: 144 },
      { date: '2025-11-06', value: 146 },
      { date: '2025-11-07', value: 145 },
      { date: '2025-11-08', value: 146 },
      { date: '2025-11-09', value: 147 },
    ],
    lastSale: 147,
    lowestAsk: 150,
    asOf: new Date().toISOString(),
  },
  {
    id: 'mock-stockx-002',
    sku: 'DZ5485-612',
    name: 'Air Jordan 1 High OG University Red',
    brand: 'Jordan',
    imageUrl: 'https://images.stockx.com/images/Air-Jordan-1-University-Red.jpg',
    medianPrice: 185.00,
    currency: 'GBP',
    delta7d: -1.5,
    sparkline7d: [
      { date: '2025-11-03', value: 188 },
      { date: '2025-11-04', value: 187 },
      { date: '2025-11-05', value: 186 },
      { date: '2025-11-06', value: 185 },
      { date: '2025-11-07', value: 184 },
      { date: '2025-11-08', value: 185 },
      { date: '2025-11-09', value: 185 },
    ],
    lastSale: 185,
    lowestAsk: 190,
    asOf: new Date().toISOString(),
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate 7-day price change percentage
 */
function calculateDelta7d(sparkline: Array<{ value: number }>): number | null {
  if (sparkline.length < 2) return null

  const firstPrice = sparkline[0].value
  const lastPrice = sparkline[sparkline.length - 1].value

  if (firstPrice === 0) return null

  return ((lastPrice - firstPrice) / firstPrice) * 100
}

/**
 * Convert USD to target currency (simplified - in production use real FX rates)
 */
function convertCurrency(amountUsd: number, targetCurrency: string): number {
  // Simplified conversion rates (in production, fetch from fx_rates table)
  const rates: Record<string, number> = {
    USD: 1,
    GBP: 0.79,
    EUR: 0.92,
    JPY: 149.5,
  }

  const rate = rates[targetCurrency] || 1
  return amountUsd * rate
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now()

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
    const query = searchParams.get('q')
    const currency = searchParams.get('currency') || 'USD'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    console.log('[API /stockx/search]', {
      query,
      currency,
      page,
      limit,
      mockMode: isStockxMockMode(),
    })

    // Mock mode - return mock data
    if (isStockxMockMode()) {
      const filtered = MOCK_SEARCH_RESULTS.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.sku.toLowerCase().includes(query.toLowerCase()) ||
          r.brand.toLowerCase().includes(query.toLowerCase())
      )

      const duration = Date.now() - startTime

      return NextResponse.json({
        results: filtered.map((r) => ({
          ...r,
          medianPrice: currency !== 'USD' ? convertCurrency(r.medianPrice || 0, currency) : r.medianPrice,
          lastSale: currency !== 'USD' ? convertCurrency(r.lastSale || 0, currency) : r.lastSale,
          lowestAsk: currency !== 'USD' ? convertCurrency(r.lowestAsk || 0, currency) : r.lowestAsk,
          currency,
          sparkline7d: r.sparkline7d.map((s) => ({
            ...s,
            value: currency !== 'USD' ? convertCurrency(s.value, currency) : s.value,
          })),
        })),
        total: filtered.length,
        page,
        limit,
        duration_ms: duration,
      })
    }

    // Real API - search products
    const searchResult = await searchProducts(query, { page, limit })

    // Enrich each product with pricing data
    const enrichedResults: EnrichedSearchResult[] = await Promise.all(
      searchResult.products.map(async (product) => {
        try {
          // Get 7-day sales history for median size (UK 9 / US 10)
          const salesHistory = await getSalesHistory(product.sku, '10', {
            limit: 30,
            days: 7,
            currency,
          })

          // Calculate median price
          const prices = salesHistory.map((s) => s.salePrice).filter(Boolean)
          const medianPrice =
            prices.length > 0
              ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
              : null

          // Build 7-day sparkline
          const sparkline7d = salesHistory
            .slice(-7)
            .map((sale) => ({
              date: new Date(sale.soldAt).toISOString().split('T')[0],
              value: sale.salePrice,
            }))

          // Calculate 7-day delta
          const delta7d = calculateDelta7d(sparkline7d)

          // Get latest price info from our database
          const { data: latestPrice } = await supabase
            .from('stockx_latest_prices')
            .select('last_sale, lowest_ask, as_of')
            .eq('sku', product.sku)
            .eq('size', '10')
            .eq('currency', currency)
            .single()

          return {
            id: product.id,
            sku: product.sku,
            name: product.name,
            brand: product.brand,
            imageUrl: product.imageUrl || null,
            medianPrice,
            currency,
            delta7d,
            sparkline7d,
            lastSale: latestPrice?.last_sale || null,
            lowestAsk: latestPrice?.lowest_ask || null,
            asOf: latestPrice?.as_of || null,
          }
        } catch (error) {
          console.error(`[API /stockx/search] Failed to enrich ${product.sku}:`, error)

          // Return basic product info without enrichment
          return {
            id: product.id,
            sku: product.sku,
            name: product.name,
            brand: product.brand,
            imageUrl: product.imageUrl || null,
            medianPrice: null,
            currency,
            delta7d: null,
            sparkline7d: [],
            lastSale: null,
            lowestAsk: null,
            asOf: null,
          }
        }
      })
    )

    const duration = Date.now() - startTime

    console.log('[API /stockx/search] Success', {
      query,
      resultsCount: enrichedResults.length,
      duration_ms: duration,
    })

    return NextResponse.json({
      results: enrichedResults,
      total: searchResult.total,
      page,
      limit,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[API /stockx/search] Error', {
      error: error.message,
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
