'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getProductImage } from '@/lib/product/getProductImage'
import type { EnrichedLineItem } from '@/lib/portfolio/types'

// WHY: Default StockX seller fee (can be overridden via API in future)
const STOCKX_SELLER_FEE_PCT = 0.10

/**
 * useInventoryV3 - Fetch and enrich inventory data for InventoryTableV3
 * WHY: Provide type-safe, fully computed data for V3 table rendering
 */
export function useInventoryV3() {
  const [items, setItems] = useState<EnrichedLineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = async () => {
    try {
      setLoading(true)

      // 0. Get user's base currency preference
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

      // 1. Fetch inventory items
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('Inventory')
        .select('*')
        .in('status', ['active', 'listed', 'worn'])
        .order('created_at', { ascending: false })

      if (inventoryError) throw inventoryError

      // 2. Fetch market links to get provider product SKUs
      const { data: marketLinks, error: marketLinksError } = await supabase
        .from('inventory_market_links')
        .select('inventory_id, provider, provider_product_sku')

      if (marketLinksError) {
        console.warn('[useInventoryV3] Failed to fetch market links:', marketLinksError)
      }

      // 3. Fetch market products for brand/model/image
      const marketSkus = marketLinks?.map(link => link.provider_product_sku).filter(Boolean) || []
      const { data: marketProducts, error: marketProductsError } = await supabase
        .from('market_products')
        .select('sku, brand, model, colorway, image_url, provider')
        .in('sku', marketSkus.length > 0 ? marketSkus : ['__none__'])

      if (marketProductsError) {
        console.warn('[useInventoryV3] Failed to fetch market products:', marketProductsError)
      }

      // 4. Fetch inventory → StockX mappings (includes listing ID if item is listed)
      const { data: stockxMappings, error: stockxMappingsError} = await supabase
        .from('inventory_market_links')
        .select('item_id, stockx_product_id, stockx_variant_id, stockx_listing_id')

      if (stockxMappingsError) {
        console.warn('[useInventoryV3] Failed to fetch StockX mappings:', stockxMappingsError)
      }

      // 4b. Fetch StockX listing details for items that have listings
      const listingIds = stockxMappings
        ?.filter(m => m.stockx_listing_id)
        .map(m => m.stockx_listing_id)
        .filter(Boolean) || []

      const { data: stockxListings, error: stockxListingsError } = await supabase
        .from('stockx_listings')
        .select('id, stockx_listing_id, amount, currency_code, status, expires_at')
        .in('id', listingIds.length > 0 ? listingIds : ['__none__'])

      if (stockxListingsError) {
        console.warn('[useInventoryV3] Failed to fetch StockX listings:', stockxListingsError)
      }

      // 5. Fetch StockX market prices from stockx_market_latest (materialized view)
      // Build list of (product_id, variant_id, currency) to query
      const stockxQueries = new Set<string>()
      if (stockxMappings) {
        stockxMappings.forEach(mapping => {
          // Query all 3 currencies for each product/variant
          ;['USD', 'GBP', 'EUR'].forEach(currency => {
            stockxQueries.add(`${mapping.stockx_product_id}:${mapping.stockx_variant_id}:${currency}`)
          })
        })
      }

      // Fetch StockX market prices
      const { data: stockxPrices, error: stockxPricesError } = await supabase
        .from('stockx_market_latest')
        .select('stockx_product_id, stockx_variant_id, currency_code, last_sale_price, lowest_ask, highest_bid, snapshot_at')

      if (stockxPricesError) {
        console.warn('[useInventoryV3] Failed to fetch StockX market prices:', stockxPricesError)
      }

      // 5. Fetch 30-day sparkline data from market_price_daily_medians
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

      // Build maps for joining
      const marketLinkMap = new Map<string, any>()
      if (marketLinks) {
        for (const link of marketLinks) {
          marketLinkMap.set(link.inventory_id, link)
        }
      }

      const marketProductMap = new Map<string, any>()
      if (marketProducts) {
        for (const product of marketProducts) {
          marketProductMap.set(product.sku, product)
        }
      }

      const stockxMappingMap = new Map<string, any>()
      if (stockxMappings) {
        for (const mapping of stockxMappings) {
          stockxMappingMap.set(mapping.item_id, mapping)
        }
      }

      const stockxPriceMap = new Map<string, any>()
      if (stockxPrices) {
        for (const price of stockxPrices) {
          const key = `${price.stockx_product_id}:${price.stockx_variant_id}:${price.currency_code}`
          stockxPriceMap.set(key, price)
        }
      }

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

      const stockxListingMap = new Map<string, any>()
      if (stockxListings) {
        for (const listing of stockxListings) {
          stockxListingMap.set(listing.id, listing)
        }
      }

      // 6. Compose EnrichedLineItem[]
      const enrichedItems: EnrichedLineItem[] = (inventoryData || []).map((item: any) => {
        // Get market link
        const marketLink = marketLinkMap.get(item.id)
        const marketSku = marketLink?.provider_product_sku
        const marketProduct = marketSku ? marketProductMap.get(marketSku) : null

        // Hydrate brand/model/colorway from market_products if missing
        const brand = item.brand || marketProduct?.brand || 'Unknown'
        const model = item.model || marketProduct?.model || item.sku
        const colorway = item.colorway || marketProduct?.colorway || null

        // Get StockX mapping for this inventory item
        const stockxMapping = stockxMappingMap.get(item.id)

        // Get StockX market price (prefer user's currency, fallback to USD → convert)
        let stockxPrice = null
        let marketCurrency: 'GBP' | 'EUR' | 'USD' | null = null

        if (stockxMapping) {
          // Try to get price in user's currency first
          const priceKeyUser = `${stockxMapping.stockx_product_id}:${stockxMapping.stockx_variant_id}:${userCurrency}`
          stockxPrice = stockxPriceMap.get(priceKeyUser)

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

        // Extract individual market data fields
        const rawLastSale = stockxPrice?.last_sale_price || null
        const rawLowestAsk = stockxPrice?.lowest_ask || null
        const rawHighestBid = stockxPrice?.highest_bid || null

        // Market value logic: last_sale_price → lowest_ask → highest_bid → fallback to item.market_value
        const rawMarketPrice = rawLastSale || rawLowestAsk || rawHighestBid || item.market_value || null

        let marketPrice = rawMarketPrice
        let lastSale = rawLastSale
        let lowestAsk = rawLowestAsk
        let highestBid = rawHighestBid

        // CURRENCY CONVERSION: Only convert if currencies don't match
        if (marketCurrency && marketCurrency !== userCurrency) {
          // Use hardcoded FX rate for now (TODO: fetch from fx_rates table)
          const fxRates: Record<string, Record<string, number>> = {
            'USD': { 'GBP': 0.79, 'EUR': 0.92 },
            'EUR': { 'GBP': 0.86, 'USD': 1.09 },
            'GBP': { 'USD': 1.27, 'EUR': 1.16 }
          }

          const rate = fxRates[marketCurrency]?.[userCurrency] || 1.0

          console.log(`[useInventoryV3] Currency conversion for ${item.sku}:`, {
            rawPrice: rawMarketPrice,
            rawCurrency: marketCurrency,
            userCurrency,
            rate,
            convertedPrice: rawMarketPrice ? rawMarketPrice * rate : null
          })

          // Convert all market data fields
          if (marketPrice) marketPrice = marketPrice * rate
          if (lastSale) lastSale = lastSale * rate
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

        // Get sparkline data (legacy key format for market_price_daily_medians)
        const sparklineKey = `${item.sku}:${item.size_uk || ''}`
        const spark30d = sparklineMap.get(sparklineKey) || []

        // Resolve image using fallback chain
        const imageResolved = getProductImage({
          marketImageUrl: marketProduct?.image_url,
          inventoryImageUrl: item.image_url,
          provider: marketProvider as any,
          brand,
          model,
          colorway,
          sku: item.sku,
        })

        // Compute values
        const qty = 1 // WHY: Assuming qty=1 for now (can enhance with actual qty field)
        const invested = (item.purchase_price || 0) + (item.tax || 0) + (item.shipping || 0)
        const avgCost = invested / qty

        // BUG FIX #1 & #2: Total should fallback to custom_market_value or invested
        // Priority: 1) market price, 2) custom value, 3) invested amount (minimum)
        const total = marketPrice
          ? marketPrice * qty
          : item.custom_market_value
            ? item.custom_market_value * qty
            : invested

        // BUG FIX #1: P/L should use custom_market_value when no market price
        // Calculate P/L based on whatever value we're using for total
        const currentValue = marketPrice || item.custom_market_value || invested
        const pl = currentValue !== invested ? currentValue - invested : null
        const performancePct = pl !== null && invested > 0 ? (pl / invested) * 100 : null

        // Compute instant sell net payout (already converted to user currency)
        const instantSellGross = highestBid
        const instantSellNet = highestBid ? Math.round(highestBid * (1 - STOCKX_SELLER_FEE_PCT) * 100) / 100 : null

        // Build StockX data
        const stockxData: EnrichedLineItem['stockx'] = (() => {
          if (!stockxMapping) {
            return { mapped: false }
          }

          // Item is mapped to StockX
          const listing = stockxMapping.stockx_listing_id
            ? stockxListingMap.get(stockxMapping.stockx_listing_id)
            : null

          return {
            mapped: true,
            productId: stockxMapping.stockx_product_id,
            variantId: stockxMapping.stockx_variant_id,
            listingId: listing?.stockx_listing_id || null,
            listingStatus: listing?.status || null,
            askPrice: listing?.amount ? listing.amount / 100 : null, // Convert cents to dollars
            expiresAt: listing?.expires_at || null,
          }
        })()

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
          purchaseDate: item.purchase_date,
          qty,
          invested,
          avgCost,
          market: {
            price: marketPrice,
            lastSale,
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
