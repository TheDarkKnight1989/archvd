import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Portfolio Overview API (Matrix V2)
 *
 * Returns live market data from unified schema:
 * - latest_market_prices (provider preference: StockX > Alias > eBay > Seed)
 * - portfolio_value_daily (30-day history MV)
 * - inventory_market_links (SKU+size mapping)
 *
 * Performance: 60s server-side LRU cache by (userId, currency)
 */

type CategoryBreakdown = {
  category: string
  value: number
  percentage: number
}

type PortfolioOverview = {
  isEmpty: boolean
  kpis: {
    estimatedValue: number
    invested: number
    unrealisedPL: number
    unrealisedPLDelta7d: number | null
    roi: number
    missingPricesCount: number
    provider: 'stockx' | 'alias' | 'ebay' | 'seed' | 'mixed' | 'none'
  }
  series30d: Array<{ date: string; value: number | null }>
  categoryBreakdown: CategoryBreakdown[]
  missingItems: Array<{
    id: string
    sku: string
    size_uk: string | null
    reason: string
  }>
  meta: {
    pricesAsOf: string
  }
}

// Simple in-memory cache (60s TTL)
const cache = new Map<string, { data: PortfolioOverview; expiresAt: number }>()

function getCacheKey(userId: string, currency: string): string {
  return `${userId}:${currency}`
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const searchParams = request.nextUrl.searchParams
    const currency = (searchParams.get('currency') || 'GBP') as 'GBP' | 'EUR' | 'USD'

    const supabase = await createClient()

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check cache
    const cacheKey = getCacheKey(user.id, currency)
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      logger.apiRequest(
        '/api/portfolio/overview',
        { currency, user_id: user.id, cached: true },
        Date.now() - startTime,
        {}
      )
      return NextResponse.json(cached.data)
    }

    // 1. Fetch active inventory items
    const { data: inventory, error: inventoryError } = await supabase
      .from('Inventory')
      .select('id, sku, size, size_uk, purchase_price, tax, shipping, purchase_total, category')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (inventoryError) {
      throw inventoryError
    }

    if (!inventory || inventory.length === 0) {
      const emptyResponse: PortfolioOverview = {
        isEmpty: true,
        kpis: {
          estimatedValue: 0,
          invested: 0,
          unrealisedPL: 0,
          unrealisedPLDelta7d: null,
          roi: 0,
          missingPricesCount: 0,
          provider: 'none',
        },
        series30d: [],
        categoryBreakdown: [],
        missingItems: [],
        meta: {
          pricesAsOf: new Date().toISOString(),
        },
      }

      logger.apiRequest(
        '/api/portfolio/overview',
        { currency, user_id: user.id },
        Date.now() - startTime,
        { itemCount: 0 }
      )

      return NextResponse.json(emptyResponse)
    }

    // 2. Fetch market links for these inventory items (updated for StockX V2)
    // PHASE 3.11: Include mapping_status to detect broken/invalid mappings
    const inventoryIds = inventory.map((i) => i.id)
    const { data: marketLinks, error: linksError } = await supabase
      .from('inventory_market_links')
      .select('item_id, stockx_product_id, stockx_variant_id, mapping_status')
      .in('item_id', inventoryIds)

    if (linksError) {
      logger.warn('[Portfolio Overview] Error fetching market links', {
        message: linksError.message,
      })
    }

    // Build map: inventory_id -> StockX IDs + mapping_status
    // PHASE 3.11: Include mapping_status to filter out invalid mappings
    const inventoryToStockxIds = new Map<string, { productId: string; variantId: string; mappingStatus: string | null }>()

    marketLinks?.forEach((link) => {
      if (link.stockx_product_id && link.stockx_variant_id) {
        inventoryToStockxIds.set(link.item_id, {
          productId: link.stockx_product_id,
          variantId: link.stockx_variant_id,
          mappingStatus: link.mapping_status || 'ok',
        })
      }
    })

    // 3. Build inventory items with SKUs (use item's own SKU for price lookup)
    const inventoryMap = new Map(inventory.map((item) => [item.id, item]))

    // Get all market SKUs + sizes to query for prices (fallback for items without StockX)
    const marketQueries: { sku: string; size: string | null }[] = []
    inventory.forEach((item) => {
      if (item.sku) {
        let size = item.size_uk || item.size || null
        // Parse UK prefix if present (e.g., "UK8" → "8")
        if (size && typeof size === 'string' && size.toUpperCase().startsWith('UK')) {
          size = size.substring(2).trim()
        }
        marketQueries.push({ sku: item.sku, size })
      }
    })

    // 4. Fetch StockX market prices first (highest priority)
    // IMPORTANT: stockx_market_latest returns amounts in MAJOR currency units (e.g., 150.0 = £150.00)
    // - Do NOT divide by 100
    // - Filter by currency_code to get prices in user's preferred currency
    // - Use DbStockxMarketLatest type from @/lib/stockx/dbTypes for type safety
    // - Market price = highest_bid ?? lowest_ask ?? null (Phase 3.3)
    const { data: stockxPrices, error: stockxPricesError } = await supabase
      .from('stockx_market_latest')
      .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid, snapshot_at')
      .eq('currency_code', currency)

    if (stockxPricesError) {
      logger.warn('[Portfolio Overview] Error fetching StockX prices', {
        message: stockxPricesError.message,
      })
    }

    // Build StockX price map (prices already in major units)
    const stockxPriceMap = new Map<string, any>()
    stockxPrices?.forEach((price) => {
      const key = `${price.stockx_product_id}:${price.stockx_variant_id}`
      stockxPriceMap.set(key, price)  // All price fields already in major units
    })

    // 5. Fetch latest prices from latest_market_prices (fallback for non-StockX items)
    const priceMap = new Map<string, any>()
    if (marketQueries.length > 0) {
      // Query latest_market_prices for all SKU+size combinations
      // Note: This view already has provider preference logic
      for (const query of marketQueries) {
        const qb = supabase
          .from('latest_market_prices')
          .select('sku, size_uk, last_sale, ask, bid, provider, as_of')
          .eq('sku', query.sku)

        if (query.size) {
          qb.eq('size_uk', query.size)
        } else {
          qb.is('size_uk', null)
        }

        const { data: priceData } = await qb.limit(1).single()

        if (priceData) {
          // Market price: ask → last_sale → null (no bid fallback)
          const price = priceData.ask || priceData.last_sale || null
          if (price) {
            const key = `${query.sku}:${query.size || 'null'}`
            priceMap.set(key, { ...priceData, price })
          }
        }
      }
    }

    // 6. Calculate KPIs (prefer StockX → fallback to other providers)
    let totalEstimatedValue = 0
    let totalInvested = 0
    const providers = new Set<string>()
    let latestPriceTimestamp: Date | null = null
    const missingPrices: Array<{ id: string; sku: string; size: string | null; reason: string }> = []

    inventory.forEach((item) => {
      const invested =
        item.purchase_total || item.purchase_price + (item.tax || 0) + (item.shipping || 0)
      totalInvested += invested

      // Priority 1: Check for StockX mapping
      const stockxIds = inventoryToStockxIds.get(item.id)
      if (stockxIds) {
        // PHASE 3.11: Skip items with invalid StockX mappings
        // WHY: Don't include fake/stale prices from broken product mappings in totals
        const isInvalidMapping = stockxIds.mappingStatus === 'stockx_404' || stockxIds.mappingStatus === 'invalid'

        if (isInvalidMapping) {
          missingPrices.push({
            id: item.id,
            sku: item.sku,
            size: item.size_uk || item.size,
            reason: 'Invalid StockX mapping',
          })
          return // Skip invalid mappings - don't include in totals
        }

        const stockxKey = `${stockxIds.productId}:${stockxIds.variantId}`
        const stockxPrice = stockxPriceMap.get(stockxKey)

        if (stockxPrice) {
          // PHASE 3.3: Market price = highest_bid ?? lowest_ask ?? null
          const price = stockxPrice.highest_bid ?? stockxPrice.lowest_ask ?? null

          if (price) {
            totalEstimatedValue += price
            providers.add('stockx')

            if (stockxPrice.snapshot_at) {
              const priceDate = new Date(stockxPrice.snapshot_at)
              if (!latestPriceTimestamp || priceDate > latestPriceTimestamp) {
                latestPriceTimestamp = priceDate
              }
            }
            return // Found StockX price, skip fallback
          }
        }
      }

      // Priority 2: Fallback to other market providers
      if (!item.sku) {
        missingPrices.push({
          id: item.id,
          sku: item.sku,
          size: item.size_uk || item.size,
          reason: 'No SKU',
        })
        return
      }

      let size = item.size_uk || item.size || null
      // Parse UK prefix if present (e.g., "UK8" → "8")
      if (size && typeof size === 'string' && size.toUpperCase().startsWith('UK')) {
        size = size.substring(2).trim()
      }
      const priceKey = `${item.sku}:${size || 'null'}`
      const priceData = priceMap.get(priceKey)

      if (!priceData) {
        missingPrices.push({
          id: item.id,
          sku: item.sku,
          size: size,
          reason: 'No market price available',
        })
        return
      }

      totalEstimatedValue += priceData.price
      providers.add(priceData.provider)

      if (priceData.as_of) {
        const priceDate = new Date(priceData.as_of)
        if (!latestPriceTimestamp || priceDate > latestPriceTimestamp) {
          latestPriceTimestamp = priceDate
        }
      }
    })

    const unrealisedPL = totalEstimatedValue - totalInvested
    const roi = totalInvested > 0 ? (unrealisedPL / totalInvested) * 100 : 0

    // Determine provider
    let provider: PortfolioOverview['kpis']['provider'] = 'none'
    if (providers.size === 0) {
      provider = 'none'
    } else if (providers.size === 1) {
      provider = Array.from(providers)[0] as any
    } else {
      provider = 'mixed'
    }

    // 7. Calculate 7-day delta (percentage change in unrealised P/L)
    // Fetch portfolio value from 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    const { data: portfolioValue7d } = await supabase
      .from('portfolio_value_daily')
      .select('value_base_gbp')
      .eq('user_id', user.id)
      .eq('day', sevenDaysAgoStr)
      .single()

    let unrealisedPLDelta7d: number | null = null
    if (portfolioValue7d && portfolioValue7d.value_base_gbp && totalInvested > 0) {
      const value7d = parseFloat(portfolioValue7d.value_base_gbp)
      const unrealisedPL7d = value7d - totalInvested
      const delta = unrealisedPL - unrealisedPL7d
      unrealisedPLDelta7d = unrealisedPL7d !== 0 ? (delta / Math.abs(unrealisedPL7d)) * 100 : null
    }

    // 8. Calculate category breakdown (prefer StockX → fallback to other providers)
    // PHASE 3.11: Exclude items with invalid StockX mappings
    const categoryMap = new Map<string, number>()
    inventory.forEach((item) => {
      const category = item.category || 'uncategorized'

      // Priority 1: Check for StockX price
      const stockxIds = inventoryToStockxIds.get(item.id)
      let value = 0

      if (stockxIds) {
        // PHASE 3.11: Skip items with invalid mappings
        const isInvalidMapping = stockxIds.mappingStatus === 'stockx_404' || stockxIds.mappingStatus === 'invalid'
        if (isInvalidMapping) {
          return // Skip invalid mappings - don't include in category breakdown
        }

        const stockxKey = `${stockxIds.productId}:${stockxIds.variantId}`
        const stockxPrice = stockxPriceMap.get(stockxKey)
        if (stockxPrice) {
          const price = stockxPrice.last_sale_price || stockxPrice.lowest_ask || stockxPrice.highest_bid
          if (price) {
            value = price
            categoryMap.set(category, (categoryMap.get(category) || 0) + value)
            return
          }
        }
      }

      // Priority 2: Fallback to other market providers
      const size = item.size_uk || item.size || null
      const priceKey = `${item.sku}:${size || 'null'}`
      const priceData = item.sku ? priceMap.get(priceKey) : null
      value = priceData?.price || item.purchase_total || item.purchase_price || 0
      categoryMap.set(category, (categoryMap.get(category) || 0) + value)
    })

    const totalCategoryValue = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0)
    const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([category, value]) => ({
        category,
        value,
        percentage: totalCategoryValue > 0 ? (value / totalCategoryValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5) // Top 5 categories

    // 6. Fetch 30-day series from portfolio_value_daily
    const { data: portfolioValues, error: valuesError } = await supabase
      .from('portfolio_value_daily')
      .select('day, value_base_gbp')
      .eq('user_id', user.id)
      .gte('day', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('day', { ascending: true })

    if (valuesError) {
      logger.warn('[Portfolio Overview] Error fetching portfolio values', {
        message: valuesError.message,
      })
    }

    // Convert to series30d format (null-pad missing days)
    const series30d: Array<{ date: string; value: number | null }> = []
    const valueMap = new Map<string, number>()
    portfolioValues?.forEach((pv: any) => {
      valueMap.set(pv.day, parseFloat(pv.value_base_gbp))
    })

    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      series30d.push({
        date: dateStr,
        value: valueMap.get(dateStr) || null,
      })
    }

    const response: PortfolioOverview = {
      isEmpty: false,
      kpis: {
        estimatedValue: totalEstimatedValue,
        invested: totalInvested,
        unrealisedPL,
        unrealisedPLDelta7d,
        roi,
        missingPricesCount: missingPrices.length,
        provider,
      },
      series30d,
      categoryBreakdown,
      missingItems: missingPrices.map((item) => ({
        id: item.id,
        sku: item.sku,
        size_uk: item.size,
        reason: item.reason,
      })),
      meta: {
        pricesAsOf: (latestPriceTimestamp || new Date()).toISOString(),
      },
    }

    // Cache for 60s
    cache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + 60 * 1000,
    })

    logger.apiRequest(
      '/api/portfolio/overview',
      { currency, user_id: user.id },
      Date.now() - startTime,
      {
        itemCount: inventory.length,
        missingPricesCount: missingPrices.length,
        seriesLength: series30d.length,
        nonNullPoints: series30d.filter((s) => s.value !== null).length,
      }
    )

    return NextResponse.json(response)
  } catch (error: any) {
    logger.error('[Portfolio Overview] Error', {
      message: error.message,
      stack: error.stack,
    })

    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
