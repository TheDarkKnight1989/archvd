'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface RepricingSuggestion {
  itemId: string
  sku: string
  brand?: string | null
  model?: string | null
  colorway?: string | null
  size_uk?: string | null
  image_url?: string | null

  // Current state
  currentPrice: number
  purchaseCost: number
  daysInInventory: number

  // Market data
  marketLowestAsk?: number | null
  marketHighestBid?: number | null

  // Suggestion
  suggestedPrice: number
  priceChange: number
  priceChangePercent: number
  expectedMargin: number

  // Reasoning
  reason: string
  urgency: 'high' | 'medium' | 'low'
  confidence: 'high' | 'medium' | 'low'
}

export interface RepricingRules {
  // Age-based rules
  aggressiveAfterDays: number // Default: 180
  moderateAfterDays: number // Default: 90

  // Margin protection
  minimumMarginPercent: number // Default: 5%
  targetMarginPercent: number // Default: 20%

  // Market-based
  beatLowestAskBy: number // Default: 5 (beat by £5)
  matchHighestBid: boolean // Default: false

  // General
  enabled: boolean
}

const DEFAULT_RULES: RepricingRules = {
  aggressiveAfterDays: 180,
  moderateAfterDays: 90,
  minimumMarginPercent: 5,
  targetMarginPercent: 20,
  beatLowestAskBy: 5,
  matchHighestBid: false,
  enabled: true,
}

export function useRepricingSuggestions(userId?: string, rules: Partial<RepricingRules> = {}, refreshKey?: number) {
  const [suggestions, setSuggestions] = useState<RepricingSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const activeRules = { ...DEFAULT_RULES, ...rules }

  useEffect(() => {
    if (!userId || !activeRules.enabled) {
      setLoading(false)
      return
    }

    async function fetchAndCalculateSuggestions() {
      try {
        setLoading(true)

        // Step 1: Fetch available inventory (active, listed, worn)
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('Inventory')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['active', 'listed', 'worn'])
          .order('purchase_date', { ascending: true })

        if (inventoryError) throw inventoryError
        if (!inventoryData || inventoryData.length === 0) {
          setSuggestions([])
          setError(null)
          return
        }

        // Step 2: Fetch StockX mappings (inventory_market_links is StockX-only, no provider column)
        const { data: stockxMappings } = await supabase
          .from('inventory_market_links')
          .select('item_id, stockx_product_id, stockx_variant_id')
          .in('item_id', inventoryData.map(i => i.id))

        // Step 3: Fetch Alias mappings
        const { data: aliasMappings } = await supabase
          .from('inventory_alias_links')
          .select('inventory_id, alias_catalog_id')
          .in('inventory_id', inventoryData.map(i => i.id))

        // Step 4: Fetch StockX market data
        const stockxVariantIds = stockxMappings?.map(m => m.stockx_variant_id).filter(Boolean) || []
        const { data: stockxMarketData } = stockxVariantIds.length > 0
          ? await supabase
              .from('stockx_market_latest')
              .select('variant_id, lowest_ask, highest_bid')
              .in('variant_id', stockxVariantIds)
          : { data: null }

        // Step 5: Fetch Alias market data (prices are in cents, need to convert)
        const aliasCatalogIds = aliasMappings?.map(m => m.alias_catalog_id).filter(Boolean) || []
        const { data: aliasMarketData } = aliasCatalogIds.length > 0
          ? await supabase
              .from('alias_market_snapshots')
              .select('catalog_id, lowest_ask_cents, highest_bid_cents')
              .in('catalog_id', aliasCatalogIds)
              .order('snapshot_at', { ascending: false })
          : { data: null }

        // Create lookup maps
        const stockxMarketMap = new Map(
          stockxMarketData?.map(d => [d.variant_id, { lowestAsk: d.lowest_ask, highestBid: d.highest_bid }]) || []
        )
        const aliasMarketMap = new Map(
          aliasMarketData?.map(d => [
            d.catalog_id,
            {
              lowestAsk: d.lowest_ask_cents ? d.lowest_ask_cents / 100 : null,
              highestBid: d.highest_bid_cents ? d.highest_bid_cents / 100 : null
            }
          ]) || []
        )
        const stockxMappingMap = new Map(
          stockxMappings?.map(m => [m.item_id, m]) || []
        )
        const aliasMappingMap = new Map(
          aliasMappings?.map(m => [m.inventory_id, m]) || []
        )

        const now = new Date()
        const calculatedSuggestions: RepricingSuggestion[] = []

        for (const item of inventoryData) {
          // Calculate days in inventory
          const purchaseDate = item.purchase_date ? new Date(item.purchase_date) : new Date(item.created_at)
          const daysInInventory = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))

          // Skip items that don't need repricing (< 30 days old)
          if (daysInInventory < 30) continue

          // Calculate purchase cost
          const purchaseCost = item.purchase_price + (item.tax || 0) + (item.shipping || 0)

          // Get market data from all platforms
          let marketLowestAsk: number | null = null
          let marketHighestBid: number | null = null

          // Check StockX market data
          const stockxMapping = stockxMappingMap.get(item.id)
          if (stockxMapping?.stockx_variant_id) {
            const stockxMarket = stockxMarketMap.get(stockxMapping.stockx_variant_id)
            if (stockxMarket?.lowestAsk) {
              marketLowestAsk = marketLowestAsk === null ? stockxMarket.lowestAsk : Math.min(marketLowestAsk, stockxMarket.lowestAsk)
            }
            if (stockxMarket?.highestBid) {
              marketHighestBid = marketHighestBid === null ? stockxMarket.highestBid : Math.max(marketHighestBid, stockxMarket.highestBid)
            }
          }

          // Check Alias market data
          const aliasMapping = aliasMappingMap.get(item.id)
          if (aliasMapping?.alias_catalog_id) {
            const aliasMarket = aliasMarketMap.get(aliasMapping.alias_catalog_id)
            if (aliasMarket?.lowestAsk) {
              marketLowestAsk = marketLowestAsk === null ? aliasMarket.lowestAsk : Math.min(marketLowestAsk, aliasMarket.lowestAsk)
            }
            if (aliasMarket?.highestBid) {
              marketHighestBid = marketHighestBid === null ? aliasMarket.highestBid : Math.max(marketHighestBid, aliasMarket.highestBid)
            }
          }

          // Calculate suggested price
          const suggestion = calculateRepricingSuggestion(
            item,
            purchaseCost,
            daysInInventory,
            marketLowestAsk,
            marketHighestBid,
            activeRules
          )

          if (suggestion) {
            calculatedSuggestions.push(suggestion)
          }
        }

        // Sort by urgency (high -> medium -> low) and then by price change
        calculatedSuggestions.sort((a, b) => {
          const urgencyOrder = { high: 0, medium: 1, low: 2 }
          if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
            return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
          }
          return Math.abs(b.priceChange) - Math.abs(a.priceChange)
        })

        setSuggestions(calculatedSuggestions)
        setError(null)
      } catch (err) {
        console.error('[useRepricingSuggestions] Error:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchAndCalculateSuggestions()
  }, [userId, activeRules.enabled, refreshKey])

  return { suggestions, loading, error }
}

function calculateRepricingSuggestion(
  item: any,
  purchaseCost: number,
  daysInInventory: number,
  marketLowestAsk: number | null,
  marketHighestBid: number | null,
  rules: RepricingRules
): RepricingSuggestion | null {
  const currentPrice = item.custom_market_value || purchaseCost * 1.2 // Assume 20% markup if no price set

  let suggestedPrice = currentPrice
  let reason = ''
  let urgency: 'high' | 'medium' | 'low' = 'low'
  let confidence: 'high' | 'medium' | 'low' = 'medium'

  // Determine urgency based on age
  if (daysInInventory >= rules.aggressiveAfterDays) {
    urgency = 'high'
  } else if (daysInInventory >= rules.moderateAfterDays) {
    urgency = 'medium'
  }

  // Calculate minimum price (cost + minimum margin)
  const minimumPrice = purchaseCost * (1 + rules.minimumMarginPercent / 100)

  // Strategy 1: Dead stock (180+ days) - aggressive markdown
  if (daysInInventory >= rules.aggressiveAfterDays) {
    // Try to beat market by significant amount
    if (marketLowestAsk) {
      suggestedPrice = marketLowestAsk - (rules.beatLowestAskBy * 2)
      reason = `Dead stock (${daysInInventory}d old). Beat market by £${rules.beatLowestAskBy * 2} for quick sale`
      confidence = marketLowestAsk ? 'high' : 'medium'
    } else {
      // No market data - markdown 20%
      suggestedPrice = currentPrice * 0.8
      reason = `Dead stock (${daysInInventory}d old). 20% markdown to move quickly`
      confidence = 'low'
    }
  }
  // Strategy 2: Stale inventory (91-179 days) - moderate markdown
  else if (daysInInventory >= rules.moderateAfterDays) {
    if (marketLowestAsk) {
      suggestedPrice = marketLowestAsk - rules.beatLowestAskBy
      reason = `Stale inventory (${daysInInventory}d old). Beat market lowest ask`
      confidence = 'high'
    } else if (marketHighestBid && rules.matchHighestBid) {
      suggestedPrice = marketHighestBid
      reason = `Stale inventory. Match highest bid for instant sale`
      confidence = 'high'
    } else {
      // 10% markdown
      suggestedPrice = currentPrice * 0.9
      reason = `Stale inventory (${daysInInventory}d old). 10% markdown`
      confidence = 'low'
    }
  }
  // Strategy 3: Aging inventory (31-90 days) - competitive pricing
  else {
    if (marketLowestAsk && currentPrice > marketLowestAsk) {
      suggestedPrice = marketLowestAsk - rules.beatLowestAskBy
      reason = `Price too high vs market. Beat lowest ask for competitiveness`
      confidence = 'high'
    } else {
      // No change needed for fresh inventory at market price
      return null
    }
  }

  // Enforce minimum margin
  if (suggestedPrice < minimumPrice) {
    suggestedPrice = minimumPrice
    reason += ` (capped at ${rules.minimumMarginPercent}% minimum margin)`
    confidence = 'medium'
  }

  // Calculate metrics
  const priceChange = suggestedPrice - currentPrice
  const priceChangePercent = (priceChange / currentPrice) * 100
  const expectedMargin = ((suggestedPrice - purchaseCost) / suggestedPrice) * 100

  // Only suggest if there's a meaningful change (> £1 or > 2%)
  if (Math.abs(priceChange) < 1 && Math.abs(priceChangePercent) < 2) {
    return null
  }

  return {
    itemId: item.id,
    sku: item.sku,
    brand: item.brand,
    model: item.model,
    colorway: item.colorway,
    size_uk: item.size_uk,
    image_url: item.image_url,
    currentPrice,
    purchaseCost,
    daysInInventory,
    marketLowestAsk,
    marketHighestBid,
    suggestedPrice,
    priceChange,
    priceChangePercent,
    expectedMargin,
    reason,
    urgency,
    confidence,
  }
}
