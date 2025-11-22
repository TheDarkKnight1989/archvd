/**
 * useInventoryV3 - Fetch and enrich inventory data for InventoryTableV3
 *
 * DATA FLOW:
 * 1. Fetch Inventory items (filtered by user via RLS)
 * 2. Fetch inventory_market_links (maps items → StockX product/variant)
 * 3. Fetch stockx_products (for catalog images)
 * 4. Fetch stockx_listings (active listings for mapped items)
 * 5. Fetch stockx_market_latest (current market prices per currency)
 * 6. Fetch market_price_daily_medians (30-day sparkline data)
 * 7. Enrich each item with market data, listings, images, P/L calculations
 *
 * CURRENCY HANDLING:
 * - Fetches user's base_currency from profiles (defaults to GBP)
 * - Prefers prices in user currency, falls back to USD/EUR/GBP with FX conversion
 * - All amounts in DB (stockx_listings.amount, stockx_market_latest.*) are in major units
 *
 * WHY: Provide type-safe, fully computed data for V3 table rendering with NO service layer coupling
 */

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getProductImage } from '@/lib/product/getProductImage'
import type { EnrichedLineItem } from '@/lib/portfolio/types'

// ============================================================================
// CONSTANTS
// ============================================================================

// WHY: Default StockX seller fee (can be overridden via API in future)
const STOCKX_SELLER_FEE_PCT = 0.10

// TEMP: Hardcoded FX rates for currency conversion
// TODO: Move to fx_rates table with timestamp-based lookups
const FX_RATES: Record<string, Record<string, number>> = {
  'USD': { 'GBP': 0.79, 'EUR': 0.92 },
  'EUR': { 'GBP': 0.86, 'USD': 1.09 },
  'GBP': { 'USD': 1.27, 'EUR': 1.16 }
}

// ============================================================================
// HOOK
// ============================================================================

export function useInventoryV3() {
  const [items, setItems] = useState<EnrichedLineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = async () => {
    try {
      setLoading(true)

      // ========================================================================
      // 1. GET USER'S BASE CURRENCY
      // ========================================================================

      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id

      let userCurrency: 'GBP' | 'EUR' | 'USD' = 'GBP' // Default
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('base_currency')
          .eq('id', userId)
          .single()

        userCurrency = (profile?.base_currency as 'GBP' | 'EUR' | 'USD') || 'GBP'
      }

      console.log('[useInventoryV3] User currency:', userCurrency)

      // ========================================================================
      // 2. FETCH INVENTORY ITEMS (RLS-filtered by user)
      // ========================================================================

      const { data: inventoryData, error: inventoryError } = await supabase
        .from('Inventory')
        .select('*')
        .in('status', ['active', 'listed', 'worn'])
        .order('created_at', { ascending: false })

      if (inventoryError) throw inventoryError

      // ========================================================================
      // 3. FETCH STOCKX MAPPINGS
      // NOTE: inventory_market_links are inherently user-scoped via item_id FK
      // PHASE 3.11: Include mapping_status to detect broken/invalid mappings
      // ========================================================================

      const { data: stockxMappings, error: stockxMappingsError} = await supabase
        .from('inventory_market_links')
        .select('item_id, stockx_product_id, stockx_variant_id, stockx_listing_id, mapping_status, last_sync_success_at, last_sync_error')

      if (stockxMappingsError) {
        console.warn('[useInventoryV3] Failed to fetch StockX mappings:', stockxMappingsError)
      }

      // ========================================================================
      // 4. FETCH STOCKX PRODUCT CATALOG (for images)
      // ========================================================================

      const { data: stockxProducts, error: stockxProductsError } = await supabase
        .from('stockx_products')
        .select('stockx_product_id, image_url, thumb_url')

      if (stockxProductsError) {
        console.warn('[useInventoryV3] Failed to fetch StockX products:', stockxProductsError)
      }

      // ========================================================================
      // 5. FETCH STOCKX LISTINGS (active listings for mapped items)
      // BUG FIX: Query by stockx_listing_id (external ID), not id (internal UUID)
      // ========================================================================

      const listingIds = stockxMappings
        ?.filter(m => m.stockx_listing_id)
        .map(m => m.stockx_listing_id)
        .filter(Boolean) || []

      let stockxListings: any[] = []
      let stockxListingsError = null

      if (listingIds.length > 0) {
        const result = await supabase
          .from('stockx_listings')
          .select('id, stockx_listing_id, amount, currency_code, status, expires_at')
          .in('stockx_listing_id', listingIds)  // FIX: Query by external ID
        stockxListings = result.data || []
        stockxListingsError = result.error
      }

      if (stockxListingsError) {
        console.warn('[useInventoryV3] Failed to fetch StockX listings:', stockxListingsError)
      }

      // ========================================================================
      // 6. FETCH STOCKX MARKET PRICES (latest snapshot per currency)
      // NOTE: Prices stored in major units (e.g., 150.00 = £150.00)
      // ========================================================================

      const { data: stockxPrices, error: stockxPricesError } = await supabase
        .from('stockx_market_latest')
        .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid, snapshot_at')

      console.log('[useInventoryV3] StockX prices fetched:', {
        count: stockxPrices?.length || 0,
        error: stockxPricesError,
        sample: stockxPrices?.[0]
      })

      if (stockxPricesError) {
        console.warn('[useInventoryV3] Failed to fetch StockX market prices:', stockxPricesError)
      }

      // ========================================================================
      // 7. FETCH SPARKLINE DATA (30-day price history)
      // KEY FORMAT: "${sku}:${size_uk || ''}" - maintained for consistency
      // ========================================================================

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: sparklineData, error: sparklineError } = await supabase
        .from('market_price_daily_medians')
        .select('sku, size_uk, day, median')
        .gte('day', thirtyDaysAgo.toISOString().split('T')[0])
        .order('day', { ascending: true })

      if (sparklineError) {
        console.warn('[useInventoryV3] Failed to fetch sparkline data:', sparklineError)
      }

      // ========================================================================
      // 8. BUILD LOOKUP MAPS FOR JOINS
      // ========================================================================

      const stockxMappingMap = new Map<string, any>()
      if (stockxMappings) {
        for (const mapping of stockxMappings) {
          stockxMappingMap.set(mapping.item_id, mapping)
        }
      }

      const stockxProductsMap = new Map<string, { imageUrl?: string | null; thumbUrl?: string | null }>()
      if (stockxProducts) {
        for (const product of stockxProducts) {
          stockxProductsMap.set(product.stockx_product_id, {
            imageUrl: product.image_url,
            thumbUrl: product.thumb_url,
          })
        }
      }

      // Map by compound key: "${stockx_product_id}:${stockx_variant_id}:${currency_code}"
      const stockxPriceMap = new Map<string, any>()
      if (stockxPrices) {
        for (const price of stockxPrices) {
          const key = `${price.stockx_product_id}:${price.stockx_variant_id}:${price.currency_code}`
          stockxPriceMap.set(key, price)
        }
      }

      // Sparkline key format: "${sku}:${size_uk || ''}"
      const sparklineMap = new Map<string, Array<{ date: string; price: number | null }>>()
      if (sparklineData) {
        for (const point of sparklineData) {
          const key = `${point.sku}:${point.size_uk || ''}`
          if (!sparklineMap.has(key)) {
            sparklineMap.set(key, [])
          }
          sparklineMap.get(key)!.push({
            date: point.day,
            price: point.median,
          })
        }
      }

      // BUG FIX: Key by stockx_listing_id (external ID), not id (internal UUID)
      const stockxListingMap = new Map<string, any>()
      if (stockxListings) {
        for (const listing of stockxListings) {
          stockxListingMap.set(listing.stockx_listing_id, listing)
        }
      }

      // ========================================================================
      // 9. ENRICH INVENTORY ITEMS
      // ========================================================================

      console.log('[useInventoryV3] Starting enrichment:', {
        inventoryCount: inventoryData?.length || 0,
        stockxMappingsCount: stockxMappings?.length || 0,
        priceMapSize: stockxPriceMap.size
      })

      const enrichedItems: EnrichedLineItem[] = (inventoryData || []).map((item: any) => {
        // ======================================================================
        // PRODUCT METADATA (from Inventory table)
        // ======================================================================

        const brand = item.brand || 'Unknown'
        const model = item.model || item.sku
        const colorway = item.colorway || null

        // ======================================================================
        // STOCKX MAPPING & MARKET DATA
        // ======================================================================

        const stockxMapping = stockxMappingMap.get(item.id)

        let stockxPrice = null
        let marketCurrency: 'GBP' | 'EUR' | 'USD' | null = null

        if (stockxMapping) {
          // Try user's currency first
          const priceKeyUser = `${stockxMapping.stockx_product_id}:${stockxMapping.stockx_variant_id}:${userCurrency}`
          stockxPrice = stockxPriceMap.get(priceKeyUser)

          console.log('[useInventoryV3] Price lookup for', item.sku, {
            priceKey: priceKeyUser,
            found: !!stockxPrice,
            mapSize: stockxPriceMap.size,
            mapKeys: Array.from(stockxPriceMap.keys()).slice(0, 3)
          })

          if (stockxPrice) {
            marketCurrency = userCurrency
          } else {
            // Fallback to other currencies (prefer USD, then EUR, then GBP)
            const fallbackCurrencies = ['USD', 'EUR', 'GBP'].filter(c => c !== userCurrency)
            for (const currency of fallbackCurrencies) {
              const priceKey = `${stockxMapping.stockx_product_id}:${stockxMapping.stockx_variant_id}:${currency}`
              const fallbackPrice = stockxPriceMap.get(priceKey)
              if (fallbackPrice) {
                stockxPrice = fallbackPrice
                marketCurrency = currency as 'GBP' | 'EUR' | 'USD'
                break
              }
            }
          }
        }

        // ======================================================================
        // EXTRACT & CONVERT MARKET DATA
        // NOTE: All prices in stockx_market_latest are stored in major units
        // ======================================================================

        const rawLowestAsk = stockxPrice?.lowest_ask || null
        const rawHighestBid = stockxPrice?.highest_bid || null

        // PHASE 3.8: Market price = lowest_ask ?? highest_bid ?? null
        // WHY: lowest_ask represents current market value (what buyers pay)
        // WHY: highest_bid represents instant sell price (what sellers receive)
        // Portfolio valuation should use lowest_ask as primary market price
        const rawMarketPrice = rawLowestAsk ?? rawHighestBid ?? null

        let marketPrice = rawMarketPrice
        let lowestAsk = rawLowestAsk
        let highestBid = rawHighestBid

        // CURRENCY CONVERSION: Apply FX rates if currencies don't match
        if (marketCurrency && marketCurrency !== userCurrency) {
          const rate = FX_RATES[marketCurrency]?.[userCurrency] || 1.0

          console.log(`[useInventoryV3] Currency conversion for ${item.sku}:`, {
            rawPrice: rawMarketPrice,
            rawCurrency: marketCurrency,
            userCurrency,
            rate,
            convertedPrice: rawMarketPrice ? rawMarketPrice * rate : null
          })

          // Convert all market data fields
          if (marketPrice) marketPrice = marketPrice * rate
          if (lowestAsk) lowestAsk = lowestAsk * rate
          if (highestBid) highestBid = highestBid * rate
        } else if (marketCurrency) {
          console.log(`[useInventoryV3] Using StockX price for ${item.sku}:`, {
            price: rawMarketPrice,
            currency: marketCurrency,
            userCurrency,
            match: marketCurrency === userCurrency
          })
        }

        const marketProvider = stockxPrice ? 'stockx' : (item.market_source || null)
        const marketUpdatedAt = stockxPrice?.snapshot_at || item.market_price_updated_at || null

        // ======================================================================
        // SPARKLINE DATA
        // KEY FORMAT: "${sku}:${size_uk || ''}"
        // ======================================================================

        const sparklineKey = `${item.sku}:${item.size_uk || ''}`
        const spark30d = sparklineMap.get(sparklineKey) || []

        // ======================================================================
        // IMAGE RESOLUTION (Priority order)
        // 1. Inventory.image_url (local upload)
        // 2. StockX product image (from catalog)
        // 3. getProductImage fallback (placeholder)
        // ======================================================================

        const stockxProduct = stockxMapping ? stockxProductsMap.get(stockxMapping.stockx_product_id) : null

        let imageUrl: string | null = null
        let imageSource: 'local' | 'stockx' | null = null

        if (item.image_url) {
          // Priority 1: Local image
          imageUrl = item.image_url
          imageSource = 'local'
        } else if (stockxProduct?.imageUrl || stockxProduct?.thumbUrl) {
          // Priority 2: StockX catalog image
          imageUrl = stockxProduct.imageUrl || stockxProduct.thumbUrl || null
          imageSource = 'stockx'
        }

        // Priority 3: Fallback placeholder
        const imageResolved = imageUrl
          ? { src: imageUrl, alt: `${brand} ${model}` }
          : getProductImage({
              marketImageUrl: null,
              inventoryImageUrl: null,
              provider: marketProvider as any,
              brand,
              model,
              colorway,
              sku: item.sku,
            })

        // ======================================================================
        // FINANCIAL CALCULATIONS
        // ======================================================================

        const qty = 1 // WHY: Assuming qty=1 for now (can enhance with actual qty field)
        const invested = (item.purchase_price || 0) + (item.tax || 0) + (item.shipping || 0)
        const avgCost = invested / qty

        // TOTAL VALUE PRIORITY:
        // 1) Market price (from StockX latest snapshot)
        // 2) Custom market value (manual user override)
        // 3) Invested amount (minimum fallback)
        const total = marketPrice
          ? marketPrice * qty
          : item.custom_market_value
            ? item.custom_market_value * qty
            : invested

        // P/L CALCULATION:
        // Based on whatever value is used for total
        // Only show P/L if current value differs from invested
        const currentValue = marketPrice || item.custom_market_value || invested
        const pl = currentValue !== invested ? currentValue - invested : null
        const performancePct = pl !== null && invested > 0 ? (pl / invested) * 100 : null

        // ======================================================================
        // INSTANT SELL CALCULATION
        // Based on highest_bid (already converted to user currency)
        // BUG FIX: Remove /100 - amounts already in major units
        // ======================================================================

        const instantSellGross = highestBid
        const instantSellNet = highestBid
          ? Math.round(highestBid * (1 - STOCKX_SELLER_FEE_PCT) * 100) / 100
          : null

        // ======================================================================
        // STOCKX LISTING DATA
        // ======================================================================

        const stockxData: EnrichedLineItem['stockx'] = (() => {
          if (!stockxMapping) {
            return { mapped: false }
          }

          // Lookup listing by external stockx_listing_id
          const listing = stockxMapping.stockx_listing_id
            ? stockxListingMap.get(stockxMapping.stockx_listing_id)
            : null

          return {
            mapped: true,
            productId: stockxMapping.stockx_product_id,
            variantId: stockxMapping.stockx_variant_id,
            listingId: listing?.stockx_listing_id || null,
            listingStatus: listing?.status || null,
            askPrice: listing?.amount || null, // FIX: Already in major units
            expiresAt: listing?.expires_at || null,
            // Market data (converted to user currency)
            lowestAsk: lowestAsk,
            highestBid: highestBid,
            // PHASE 3.11: Mapping health status
            mappingStatus: stockxMapping.mapping_status || 'ok',
            lastSyncSuccessAt: stockxMapping.last_sync_success_at || null,
            lastSyncError: stockxMapping.last_sync_error || null,
          }
        })()

        // ======================================================================
        // RETURN ENRICHED ITEM
        // ======================================================================

        return {
          id: item.id,
          brand,
          model,
          colorway,
          sku: item.sku,
          size_uk: item.size_uk,
          image: {
            src: imageResolved.src,
            alt: imageResolved.alt,
          },
          imageSource,
          purchaseDate: item.purchase_date,
          qty,
          invested,
          avgCost,
          market: {
            price: marketPrice,
            lowestAsk,
            currency: userCurrency, // All prices converted to user currency
            provider: marketProvider as any,
            updatedAt: marketUpdatedAt,
            spark30d,
          },
          instantSell: {
            gross: instantSellGross,
            net: instantSellNet,
            currency: userCurrency, // All prices converted to user currency
            provider: highestBid ? 'stockx' : null,
            updatedAt: highestBid ? marketUpdatedAt : null,
            feePct: STOCKX_SELLER_FEE_PCT,
          },
          total,
          pl,
          performancePct,
          links: {
            productUrl: `/product/${item.sku}`,
          },
          status: item.status,
          category: item.category,
          stockx: stockxData,
        }
      })

      setItems(enrichedItems)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inventory')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  return {
    items,
    loading,
    error,
    refetch: fetchItems,
  }
}

// ============================================================================
// STOCKX SYNC HELPER
// ============================================================================

/**
 * Sync a single inventory item with StockX
 *
 * WHY: Provides UI components a simple function to trigger StockX sync
 * DIRECTIVE COMPLIANT: Only calls API route, never imports worker/service code
 *
 * @param inventoryItemId - UUID of inventory item to sync
 * @returns Sync result with StockX mapping and market data status
 */
export async function syncItemWithStockx(inventoryItemId: string): Promise<{
  status: 'ok' | 'error'
  itemId?: string
  stockx?: {
    productId: string | null
    variantId: string | null
    listingId: string | null
  }
  market?: {
    currenciesProcessed: string[]
    snapshotsCreated: number
  }
  error?: string
}> {
  try {
    const response = await fetch('/api/stockx/sync/item', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inventoryItemId }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        status: 'error',
        error: data.error || 'Failed to sync with StockX',
      }
    }

    return data
  } catch (error: any) {
    return {
      status: 'error',
      error: error.message || 'Network error',
    }
  }
}

/**
 * Sync all inventory items with StockX (bulk operation)
 *
 * WHY: Provides UI components a simple function to trigger full inventory sync
 * DIRECTIVE COMPLIANT: Only calls API route, never imports worker/service code
 *
 * @param options - Sync options (mode, limit, cursor, dryRun)
 * @returns Sync result with pagination support and detailed item-level status
 */
export async function syncInventoryWithStockx(options?: {
  mode?: 'mapped-only' | 'auto-discover'
  limit?: number
  cursor?: string | null
  dryRun?: boolean
}): Promise<{
  status: 'ok' | 'error'
  userId?: string
  mode?: 'mapped-only' | 'auto-discover'
  pagination?: {
    limit: number
    cursor: string | null
    nextCursor: string | null
  }
  summary?: {
    totalItemsScanned: number
    totalItemsSynced: number
    totalItemsSkipped: number
    totalErrors: number
  }
  items?: Array<{
    inventoryItemId: string
    status: 'synced' | 'skipped' | 'error'
    reason?: string
    mappingExists: boolean
  }>
  error?: string
}> {
  try {
    const response = await fetch('/api/stockx/sync/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options || {}),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        status: 'error',
        error: data.error || 'Failed to sync inventory with StockX',
      }
    }

    return data
  } catch (error: any) {
    return {
      status: 'error',
      error: error.message || 'Network error',
    }
  }
}
