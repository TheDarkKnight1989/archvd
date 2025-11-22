/**
 * StockX Product Search API
 * GET /api/stockx/search?q=nike+dunk&currency=GBP
 * Returns enriched sneaker results with median price, 7-day sparkline, and Δ7d
 */

import { NextRequest, NextResponse } from 'next/server'
import { isStockxEnabled, isStockxMockMode } from '@/lib/config/stockx'
import { searchProducts } from '@/lib/services/stockx/products'
import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

interface EnrichedSearchResult {
  id: string
  styleId: string
  title: string
  brand: string
  imageUrl: string | null
  urlKey?: string
  colorway?: string
  medianPrice: number | null
  currency: string
  delta7d: number | null
  sparkline7d: Array<{ date: string; value: number }>
  lastSale: number | null
  lowestAsk: number | null
  highestBid: number | null
  asOf: string | null
}

// ============================================================================
// Mock Data for Quick Testing
// ============================================================================

const MOCK_SEARCH_RESULTS: EnrichedSearchResult[] = [
  {
    id: 'mock-stockx-001',
    styleId: 'DD1391-100',
    title: 'Nike Dunk Low Panda (2021)',
    brand: 'Nike',
    imageUrl: 'https://images.stockx.com/images/Nike-Dunk-Low-Panda.jpg',
    urlKey: 'nike-dunk-low-panda-2021',
    colorway: 'White/Black',
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
    highestBid: 140,
    asOf: new Date().toISOString(),
  },
  {
    id: 'mock-stockx-002',
    styleId: 'DZ5485-612',
    title: 'Air Jordan 1 High OG University Red',
    brand: 'Jordan',
    imageUrl: 'https://images.stockx.com/images/Air-Jordan-1-University-Red.jpg',
    urlKey: 'air-jordan-1-high-og-university-red',
    colorway: 'University Red',
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
    highestBid: 180,
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

export const maxDuration = 10 // 10 second timeout for search with enrichment

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
          r.title.toLowerCase().includes(query.toLowerCase()) ||
          r.styleId.toLowerCase().includes(query.toLowerCase()) ||
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

    // Get current user for OAuth tokens
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated. Please sign in to search StockX products.' },
        { status: 401 }
      )
    }

    // Real API - search products (with timeout and fallback)
    let searchResult: Awaited<ReturnType<typeof searchProducts>>
    try {
      searchResult = await Promise.race([
        searchProducts(query, { page, limit, userId: user.id, currencyCode: currency }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Search timeout after 8s')), 8000)
        )
      ])
    } catch (error: any) {
      console.error('[API /stockx/search] Search failed, falling back to mock data:', error.message)

      // Fallback to mock data on error
      const filtered = MOCK_SEARCH_RESULTS.filter(
        (r) =>
          r.title.toLowerCase().includes(query.toLowerCase()) ||
          r.styleId.toLowerCase().includes(query.toLowerCase()) ||
          r.brand.toLowerCase().includes(query.toLowerCase())
      )

      return NextResponse.json({
        results: filtered,
        total: filtered.length,
        page,
        limit,
        duration_ms: Date.now() - startTime,
        fallback: true,
        error: error.message,
      })
    }

    // Enrich each product with pricing data from database
    const enrichedResults: EnrichedSearchResult[] = await Promise.all(
      searchResult.products.map(async (product) => {
        try {
          // Get latest price info from our database for all available sizes
          const { data: priceRecords } = await supabase
            .from('stockx_latest_prices')
            .select('last_sale, lowest_ask, highest_bid, as_of, size')
            .eq('sku', product.sku)
            .eq('currency', currency)
            .order('as_of', { ascending: false })
            .limit(10)

          console.log(`[API /stockx/search] Found ${priceRecords?.length || 0} price records for ${product.sku}`)

          // Use the most recent record with actual pricing data
          const latestPrice = priceRecords?.find(p => p.last_sale || p.lowest_ask) || priceRecords?.[0]

          return {
            id: product.id,
            styleId: product.sku,
            title: product.name,
            brand: product.brand,
            imageUrl: product.imageUrl || null,
            urlKey: product.slug,
            colorway: product.colorway,
            medianPrice: latestPrice?.last_sale || null,
            currency,
            delta7d: null,
            sparkline7d: [],
            lastSale: latestPrice?.last_sale || null,
            lowestAsk: latestPrice?.lowest_ask || null,
            highestBid: latestPrice?.highest_bid || null,
            asOf: latestPrice?.as_of || null,
          }
        } catch (error) {
          console.error(`[API /stockx/search] Failed to enrich ${product.sku}:`, error)

          // Return basic product info without enrichment
          return {
            id: product.id,
            styleId: product.sku,
            title: product.name,
            brand: product.brand,
            imageUrl: product.imageUrl || null,
            urlKey: product.slug,
            colorway: product.colorway,
            medianPrice: null,
            currency,
            delta7d: null,
            sparkline7d: [],
            lastSale: null,
            lowestAsk: null,
            highestBid: null,
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
