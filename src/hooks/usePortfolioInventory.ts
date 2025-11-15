'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { InventoryItem } from './useInventory'

export type EnrichedInventoryItem = InventoryItem & {
  // Computed fields
  invested: number
  profit: number | null
  performance_pct: number | null
  market_source: string

  // Enriched data
  image_url?: string
  full_title: string
  sparkline_data: { date: string; value: number }[]

  // Alias mapping status
  alias_mapping_status?: 'mapped' | 'unmatched' | 'unmapped' | null
  alias_product_sku?: string | null
  alias_product_id?: string | null

  // StockX market data
  stockx_mapping_status?: 'mapped' | 'unmapped' | null
  stockx_product_sku?: string | null
  stockx_lowest_ask?: number | null
  stockx_last_sale?: number | null
  stockx_price_as_of?: string | null
}

export function usePortfolioInventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = async () => {
    try {
      setLoading(true)

      // Fetch all inventory items
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('Inventory')
        .select('*')
        .in('status', ['active', 'listed', 'worn'])
        .order('created_at', { ascending: false })

      if (inventoryError) throw inventoryError

      // Fetch ALL market links (not just Alias) to hydrate product data
      const { data: marketLinks, error: marketLinksError } = await supabase
        .from('inventory_market_links')
        .select('inventory_id, provider, provider_product_id, provider_product_sku')

      if (marketLinksError) {
        console.warn('[usePortfolioInventory] Failed to fetch market links:', marketLinksError)
      }

      // Fetch market products to hydrate brand/model/image
      const marketProductSkus = marketLinks?.map(link => link.provider_product_sku).filter(Boolean) || []
      const { data: marketProducts, error: marketProductsError } = await supabase
        .from('market_products')
        .select('sku, brand, model, colorway, image_url, provider')
        .in('sku', marketProductSkus.length > 0 ? marketProductSkus : ['__none__'])

      if (marketProductsError) {
        console.warn('[usePortfolioInventory] Failed to fetch market products:', marketProductsError)
      }

      // Fetch Alias mapping status from inventory_market_links (legacy)
      const aliasLinks = marketLinks?.filter(link => link.provider === 'alias')

      // Fetch StockX mapping status from inventory_market_links
      const { data: stockxLinks, error: stockxError } = await supabase
        .from('inventory_market_links')
        .select('inventory_id, provider_product_sku')
        .eq('provider', 'stockx')

      if (stockxError) {
        console.warn('[usePortfolioInventory] Failed to fetch StockX links:', stockxError)
      }

      // Fetch unmatched SKUs
      const { data: unmatchedSkus, error: unmatchedError } = await supabase
        .from('alias_unmatched_log')
        .select('inventory_id')
        .is('resolved_at', null)

      if (unmatchedError) {
        console.warn('[usePortfolioInventory] Failed to fetch unmatched SKUs:', unmatchedError)
      }

      // Fetch StockX latest prices
      const { data: stockxPrices, error: stockxPricesError } = await supabase
        .from('stockx_latest_prices')
        .select('sku, size, lowest_ask, last_sale, as_of')

      if (stockxPricesError) {
        console.warn('[usePortfolioInventory] Failed to fetch StockX prices:', stockxPricesError)
      }

      // Build maps for alias data
      const aliasLinkMap = new Map<string, any>()
      if (aliasLinks) {
        for (const link of aliasLinks) {
          aliasLinkMap.set(link.inventory_id, {
            product_id: link.provider_product_id,
            product_sku: link.provider_product_sku,
          })
        }
      }

      // Build maps for StockX data
      const stockxLinkMap = new Map<string, any>()
      if (stockxLinks) {
        for (const link of stockxLinks) {
          stockxLinkMap.set(link.inventory_id, {
            product_sku: link.provider_product_sku,
          })
        }
      }

      const unmatchedSet = new Set<string>()
      if (unmatchedSkus) {
        for (const unmatched of unmatchedSkus) {
          unmatchedSet.add(unmatched.inventory_id)
        }
      }

      // Build StockX price map (key: sku + size)
      const stockxPriceMap = new Map<string, any>()
      if (stockxPrices) {
        for (const price of stockxPrices) {
          const key = `${price.sku}:${price.size}`
          stockxPriceMap.set(key, price)
        }
      }

      // Fetch Pokémon market values from tcg_portfolio_latest_prices
      const { data: pokemonPrices, error: pokemonError } = await supabase
        .from('tcg_portfolio_latest_prices')
        .select('*')

      if (pokemonError) {
        console.warn('[usePortfolioInventory] Failed to fetch Pokémon prices:', pokemonError)
      }

      // Build a map of SKU -> market data for Pokémon items
      const pokemonPriceMap = new Map<string, any>()
      if (pokemonPrices) {
        for (const price of pokemonPrices) {
          if (!pokemonPriceMap.has(price.sku)) {
            pokemonPriceMap.set(price.sku, [])
          }
          pokemonPriceMap.get(price.sku)!.push(price)
        }
      }

      // Build map of market products by SKU for hydration
      const marketProductMap = new Map<string, any>()
      if (marketProducts) {
        for (const product of marketProducts) {
          marketProductMap.set(product.sku, product)
        }
      }

      // Build map of inventory_id -> market product SKU for linking
      const inventoryToMarketMap = new Map<string, string>()
      if (marketLinks) {
        for (const link of marketLinks) {
          inventoryToMarketMap.set(link.inventory_id, link.provider_product_sku)
        }
      }

      // Merge Pokémon market values and Alias status into inventory items
      const mergedItems = (inventoryData || []).map((item: InventoryItem) => {
        let enrichedItem = { ...item }

        // HYDRATION: Fill missing brand/model/image from market_products if available
        const marketSku = inventoryToMarketMap.get(item.id)
        const marketProduct = marketSku ? marketProductMap.get(marketSku) : null

        if (marketProduct) {
          // Only hydrate if the field is missing or empty
          if (!enrichedItem.brand) {
            enrichedItem.brand = marketProduct.brand
          }
          if (!enrichedItem.model) {
            enrichedItem.model = marketProduct.model
          }
          if (!enrichedItem.colorway) {
            enrichedItem.colorway = marketProduct.colorway
          }
          if (!enrichedItem.image_url) {
            enrichedItem.image_url = marketProduct.image_url
          }
        }

        // Add Pokémon pricing if applicable
        if (item.category === 'pokemon') {
          const pokemonPriceData = pokemonPriceMap.get(item.sku)
          if (pokemonPriceData && pokemonPriceData.length > 0) {
            const primarySource = pokemonPriceData[0]
            enrichedItem = {
              ...enrichedItem,
              market_value: primarySource.market_value,
              market_source: primarySource.source,
              market_updated_at: primarySource.market_updated_at,
            }
          }
        }

        // Add Alias mapping status
        const aliasLink = aliasLinkMap.get(item.id)
        if (aliasLink) {
          enrichedItem = {
            ...enrichedItem,
            alias_mapping_status: 'mapped' as const,
            alias_product_id: aliasLink.product_id,
            alias_product_sku: aliasLink.product_sku,
          }
        } else if (unmatchedSet.has(item.id)) {
          enrichedItem = {
            ...enrichedItem,
            alias_mapping_status: 'unmatched' as const,
            alias_product_id: null,
            alias_product_sku: null,
          }
        } else {
          enrichedItem = {
            ...enrichedItem,
            alias_mapping_status: 'unmapped' as const,
            alias_product_id: null,
            alias_product_sku: null,
          }
        }

        // Add StockX mapping status and pricing
        const stockxLink = stockxLinkMap.get(item.id)
        if (stockxLink) {
          const priceKey = `${stockxLink.product_sku}:${item.size}`
          const stockxPrice = stockxPriceMap.get(priceKey)

          enrichedItem = {
            ...enrichedItem,
            stockx_mapping_status: 'mapped' as const,
            stockx_product_sku: stockxLink.product_sku,
            stockx_lowest_ask: stockxPrice?.lowest_ask || null,
            stockx_last_sale: stockxPrice?.last_sale || null,
            stockx_price_as_of: stockxPrice?.as_of || null,
          }

          // Update market_value if StockX has data and no market_value is set
          if (stockxPrice?.last_sale && !enrichedItem.market_value) {
            enrichedItem = {
              ...enrichedItem,
              market_value: stockxPrice.last_sale,
              market_source: 'stockx',
            }
          }
        } else {
          enrichedItem = {
            ...enrichedItem,
            stockx_mapping_status: 'unmapped' as const,
            stockx_product_sku: null,
            stockx_lowest_ask: null,
            stockx_last_sale: null,
            stockx_price_as_of: null,
          }
        }

        return enrichedItem
      })

      setItems(mergedItems)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch items')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  // Enrich items with computed fields
  const enrichedItems: EnrichedInventoryItem[] = useMemo(() => {
    return items.map((item) => {
      // Calculate invested (buy + tax + ship)
      const invested = item.purchase_total || (
        item.purchase_price +
        (item.tax || 0) +
        (item.shipping || 0)
      )

      // Calculate profit: (sold_price || market_value) - invested
      const currentValue = item.sold_price || item.market_value
      const profit = currentValue !== null && currentValue !== undefined
        ? currentValue - invested
        : null

      // Calculate performance %: profit / invested
      const performance_pct = profit !== null && invested > 0
        ? profit / invested
        : null

      // Get market source from meta
      const market_source = item.market_meta?.sources_used?.[0] || '-'

      // Build full title
      const full_title = [item.brand, item.model, item.colorway]
        .filter(Boolean)
        .join(' • ')

      // Generate sparkline data (mock for now - can be enhanced with real time series)
      const sparkline_data = generateMockSparkline(
        item.market_value || item.purchase_price,
        14
      )

      return {
        ...item,
        invested,
        profit,
        performance_pct,
        market_source,
        full_title,
        sparkline_data,
      }
    })
  }, [items])

  return {
    items: enrichedItems,
    loading,
    error,
    refetch: fetchItems,
  }
}

// Generate mock sparkline data (14 days)
function generateMockSparkline(
  currentPrice: number,
  days: number
): { date: string; value: number }[] {
  const data: { date: string; value: number }[] = []
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * dayMs)
    // Add slight random variation (±5%)
    const variation = 0.95 + Math.random() * 0.1
    const value = currentPrice * variation

    data.push({
      date: date.toISOString(),
      value: Math.max(0, value),
    })
  }

  return data
}
