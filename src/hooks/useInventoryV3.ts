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

      // 4. Fetch latest market prices from stockx_latest_prices
      const { data: stockxPrices, error: stockxPricesError } = await supabase
        .from('stockx_latest_prices')
        .select('sku, size, currency, lowest_ask, highest_bid, last_sale, as_of')

      if (stockxPricesError) {
        console.warn('[useInventoryV3] Failed to fetch StockX prices:', stockxPricesError)
      }

      // 5. Fetch 30-day sparkline data from market_price_daily_medians
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: sparklineData, error: sparklineError } = await supabase
        .from('market_price_daily_medians')
        .select('sku, size, price_date, median_price')
        .gte('price_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('price_date', { ascending: true })

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

      const stockxPriceMap = new Map<string, any>()
      if (stockxPrices) {
        for (const price of stockxPrices) {
          const key = `${price.sku}:${price.size || ''}`
          stockxPriceMap.set(key, price)
        }
      }

      const sparklineMap = new Map<string, Array<{ date: string; price: number | null }>>()
      if (sparklineData) {
        for (const point of sparklineData) {
          const key = `${point.sku}:${point.size || ''}`
          if (!sparklineMap.has(key)) {
            sparklineMap.set(key, [])
          }
          sparklineMap.get(key)!.push({
            date: point.price_date,
            price: point.median_price,
          })
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

        // Get market price
        const priceKey = `${item.sku}:${item.size_uk || ''}`
        const stockxPrice = stockxPriceMap.get(priceKey)

        // CURRENCY HANDLING:
        // Primary path: Provider already gave us prices in user's currency (GBP for this account)
        // Backup path: Only use FX conversion when stored currency !== user currency
        const rawMarketPrice = stockxPrice?.last_sale || stockxPrice?.lowest_ask || item.market_value || null
        const marketCurrency = stockxPrice?.currency as 'GBP' | 'EUR' | 'USD' | null | undefined

        let marketPrice = rawMarketPrice
        let highestBid = stockxPrice?.highest_bid || null

        // Only convert if currencies don't match
        if (rawMarketPrice && marketCurrency && marketCurrency !== userCurrency) {
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
            convertedPrice: rawMarketPrice * rate
          })

          marketPrice = rawMarketPrice * rate
          if (highestBid) {
            highestBid = highestBid * rate
          }
        } else if (marketCurrency) {
          console.log(`[useInventoryV3] No conversion needed for ${item.sku}:`, {
            price: rawMarketPrice,
            currency: marketCurrency,
            userCurrency,
            match: marketCurrency === userCurrency
          })
        }

        const marketProvider = stockxPrice ? 'stockx' : (item.market_source || null)
        const marketUpdatedAt = stockxPrice?.as_of || item.market_price_updated_at || null

        // Get sparkline data
        const spark30d = sparklineMap.get(priceKey) || []

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
