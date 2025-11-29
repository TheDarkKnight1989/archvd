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
  full_title: string
  sparkline_data: { date: string; value: number }[]
}

export function usePortfolioInventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = async () => {
    try {
      setLoading(true)

      // Get current user and their currency preference
      const { data: { user } } = await supabase.auth.getUser()
      let userCurrency: 'GBP' | 'EUR' | 'USD' = 'GBP' // Default to GBP

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('currency_pref')
          .eq('id', user.id)
          .single()

        if (profile?.currency_pref) {
          userCurrency = profile.currency_pref as 'GBP' | 'EUR' | 'USD'
        }
      }

      // Fetch all inventory items
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('Inventory')
        .select('*')
        .in('status', ['active', 'listed', 'worn'])
        .order('created_at', { ascending: false })

      if (inventoryError) throw inventoryError

      // Fetch StockX mapping status from inventory_market_links
      // Note: All links in this table are StockX-only (no provider column)
      // PHASE 3.11: Include mapping_status to detect broken/invalid mappings
      const { data: stockxLinks, error: stockxError } = await supabase
        .from('inventory_market_links')
        .select('item_id, stockx_product_id, stockx_variant_id, stockx_listing_id, mapping_status, last_sync_success_at, last_sync_error')

      if (stockxError) {
        console.warn('[usePortfolioInventory] Failed to fetch StockX links:', stockxError)
      }

      // Fetch StockX listings for items that have them
      const listingIds = stockxLinks?.filter(link => link.stockx_listing_id).map(link => link.stockx_listing_id) || []

      let stockxListings: any[] = []
      let stockxListingsError = null

      if (listingIds.length > 0) {
        const result = await supabase
          .from('stockx_listings')
          .select('id, stockx_listing_id, amount, currency_code, status, expires_at')
          .in('stockx_listing_id', listingIds)  // Fix: Use stockx_listing_id (TEXT) not id (UUID)
        stockxListings = result.data || []
        stockxListingsError = result.error
      }

      if (stockxListingsError) {
        console.warn('[usePortfolioInventory] Failed to fetch StockX listings:', stockxListingsError)
      }

      // Fetch pending operations for active listings
      const activeListingIds = stockxListings?.filter(l => l.status !== 'COMPLETED' && l.status !== 'DELETED').map(l => l.stockx_listing_id) || []

      let pendingJobs: any[] = []
      let pendingJobsError = null

      if (activeListingIds.length > 0) {
        const result = await supabase
          .from('stockx_batch_job_items')
          .select('id, stockx_listing_id, batch_job_id, status, error_message')
          .in('stockx_listing_id', activeListingIds)
          .in('status', ['PENDING'])
        pendingJobs = result.data || []
        pendingJobsError = result.error
      }

      if (pendingJobsError) {
        console.warn('[usePortfolioInventory] Failed to fetch pending jobs:', pendingJobsError)
      }

      // Fetch unmatched SKUs
      const { data: unmatchedSkus, error: unmatchedError } = await supabase
        .from('alias_unmatched_log')
        .select('inventory_id')
        .is('resolved_at', null)

      if (unmatchedError) {
        console.warn('[usePortfolioInventory] Failed to fetch unmatched SKUs:', unmatchedError)
      }

      // Fetch StockX latest prices from stockx_market_latest materialized view
      // This view contains the most recent snapshot for each product/variant/currency
      const { data: stockxPrices, error: stockxPricesError } = await supabase
        .from('stockx_market_latest')
        .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid, snapshot_at')
        .eq('currency_code', userCurrency)

      if (stockxPricesError) {
        console.warn('[usePortfolioInventory] Failed to fetch StockX prices:', stockxPricesError)
      }

      // Build maps for StockX data
      const stockxLinkMap = new Map<string, any>()
      if (stockxLinks) {
        for (const link of stockxLinks) {
          stockxLinkMap.set(link.item_id, {
            product_id: link.stockx_product_id,
            variant_id: link.stockx_variant_id,
            listing_id: link.stockx_listing_id,
            // PHASE 3.11: Include mapping status fields
            mapping_status: link.mapping_status,
            last_sync_success_at: link.last_sync_success_at,
            last_sync_error: link.last_sync_error,
          })
        }
      }

      // Build map for StockX listings
      const stockxListingMap = new Map<string, any>()
      if (stockxListings) {
        for (const listing of stockxListings) {
          stockxListingMap.set(listing.stockx_listing_id, listing)  // Fix: Use stockx_listing_id (TEXT) as key
        }
      }

      // Build map for pending jobs
      const pendingJobMap = new Map<string, any>()
      if (pendingJobs) {
        for (const job of pendingJobs) {
          // Only keep the first pending job for each listing
          if (!pendingJobMap.has(job.target_listing_id)) {
            pendingJobMap.set(job.target_listing_id, {
              job_id: job.id,
              job_type: job.job_type,
              status: job.status,
              error_message: job.error_message,
            })
          }
        }
      }

      const unmatchedSet = new Set<string>()
      if (unmatchedSkus) {
        for (const unmatched of unmatchedSkus) {
          unmatchedSet.add(unmatched.inventory_id)
        }
      }

      // Build StockX price map (key: stockx_product_id:stockx_variant_id)
      // Prices are already filtered by user's currency
      // Each entry is the latest snapshot for that product/variant/currency combination
      const stockxPriceMap = new Map<string, any>()
      if (stockxPrices) {
        for (const price of stockxPrices) {
          const key = `${price.stockx_product_id}:${price.stockx_variant_id}`
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

      // Merge StockX data into inventory items
      const mergedItems = (inventoryData || []).map((item: InventoryItem) => {
        let enrichedItem = { ...item }

        // Skip market product hydration - no longer using market_products table
        // StockX data will be enriched separately if needed

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

        // Add StockX mapping status and pricing
        const stockxLink = stockxLinkMap.get(item.id)
        if (stockxLink) {
          // Look up price using stockx_product_id and stockx_variant_id from the mapping
          const priceKey = `${stockxLink.product_id}:${stockxLink.variant_id}`
          const stockxPrice = stockxPriceMap.get(priceKey)

          // Get listing data if exists
          const listing = stockxLink.listing_id ? stockxListingMap.get(stockxLink.listing_id) : null
          const pendingJob = listing?.stockx_listing_id ? pendingJobMap.get(listing.stockx_listing_id) : null

          // PHASE 3.11: Use actual mapping_status from database
          enrichedItem = {
            ...enrichedItem,
            stockx_mapping_status: stockxLink.mapping_status || 'ok',
            stockx_last_sync_success_at: stockxLink.last_sync_success_at || null,
            stockx_last_sync_error: stockxLink.last_sync_error || null,
            stockx_product_sku: item.sku,
            stockx_lowest_ask: stockxPrice?.lowest_ask || null,
            stockx_highest_bid: stockxPrice?.highest_bid || null,
            stockx_price_as_of: stockxPrice?.snapshot_at || null,
            // Add listing data
            stockx_listing_id: listing?.stockx_listing_id || null,
            stockx_listing_status: listing?.status || null,
            stockx_ask_price: listing?.amount ? listing.amount / 100 : null,  // Convert cents to pounds
            stockx_listing_expires_at: listing?.expires_at || null,
            stockx_listing_pending_operation: pendingJob || null,
          }

          // Update market_value from StockX if available
          // PHASE 3.8: Market price = lowest_ask ?? highest_bid ?? null
          // WHY: lowest_ask represents current market value (what buyers pay)
          if (stockxPrice) {
            const marketPrice = stockxPrice.lowest_ask ?? stockxPrice.highest_bid

            if (marketPrice) {
              enrichedItem = {
                ...enrichedItem,
                market_value: marketPrice,
                market_currency: stockxPrice.currency_code,
                market_source: 'stockx',
              }
            }
          }
        } else {
          enrichedItem = {
            ...enrichedItem,
            stockx_mapping_status: 'unmapped' as const,
            stockx_product_sku: null,
            stockx_lowest_ask: null,
            stockx_highest_bid: null,
            stockx_price_as_of: null,
            stockx_listing_id: null,
            stockx_listing_status: null,
            stockx_ask_price: null,
            stockx_listing_expires_at: null,
            stockx_listing_pending_operation: null,
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
