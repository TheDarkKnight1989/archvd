/**
 * useInventoryV4 - Fetch and enrich V4 inventory data with unified market pricing
 *
 * DATA FLOW:
 * 1. Fetch inventory_v4_items (filtered by user via RLS)
 * 2. Join with inventory_v4_style_catalog for product info
 * 3. Fetch market data via get_unified_market_data_batch RPC
 * 4. Calculate ArchvdPriceWithFees for each item
 *
 * CURRENCY HANDLING:
 * - StockX returns GBP, Alias returns USD
 * - All prices converted to user's preferred currency via useCurrency hook
 * - Fee-adjusted net proceeds calculated per platform
 *
 * BEST PRICE:
 * - Compares fee-adjusted net proceeds across StockX and Alias
 * - Recommends platform with highest payout
 */

'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useCurrency, type Currency } from '@/hooks/useCurrency'
import { useUserSettings } from '@/hooks/useUserSettings'
import type { AliasRegionId } from '@/hooks/useUserSettings'
import {
  calculateArchvdPriceWithFees,
  getDefaultFxRates,
  buildFeeProfile,
  type ArchvdPriceWithFees,
  type FxRates,
  type FeeProfile,
  type UnifiedMarketInput,
  type CostInput,
  DEFAULT_FEE_PROFILE,
} from '@/lib/pricing-v4'
import type {
  InventoryV4Item,
  InventoryV4ItemFull,
  InventoryV4Listing,
  StyleCatalogV4,
} from '@/lib/inventory-v4/types'
import { convertToUsSize } from '@/lib/utils/size-conversion'

// =============================================================================
// TYPES
// =============================================================================

export interface UseInventoryV4Options {
  /** Filter by status (default: active items) */
  statuses?: string[]
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
  /** Alias region override (default: uses user's settings, falls back to '1' = UK) */
  aliasRegion?: '1' | '2' | '3'
  /** Poll for sync completion and auto-refetch (default: true) */
  pollSyncStatus?: boolean
  /** Polling interval in ms (default: 5000) */
  pollIntervalMs?: number
}

export interface UseInventoryV4Return {
  items: InventoryV4ItemFull[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  /** Number of items with pending/processing syncs */
  pendingSyncs: number
  /** Whether sync polling is active */
  isSyncing: boolean
  /** Whether market data failed to load (items still returned, but without pricing) */
  marketDataUnavailable: boolean
}

interface ItemWithStyle {
  item: InventoryV4Item
  style: StyleCatalogV4
}

interface UnifiedMarketBatchRow {
  style_id: string
  size_display: string
  stockx_lowest_ask: number | null
  stockx_highest_bid: number | null
  stockx_currency: string | null
  alias_lowest_ask: number | null
  alias_highest_bid: number | null
  alias_last_sale: number | null
  alias_sales_72h: number | null
  alias_sales_30d: number | null
  alias_currency: string | null
  has_stockx: boolean
  has_alias: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Status is now physical state only. "Listed" is derived from listings table.
const DEFAULT_STATUSES = ['in_stock', 'consigned']

/**
 * Map region ID to StockX currency code
 * '1' (UK) → GBP, '2' (EU) → EUR, '3' (US) → USD
 */
function regionToCurrency(regionId: AliasRegionId): Currency {
  switch (regionId) {
    case '1': return 'GBP'
    case '2': return 'EUR'
    case '3': return 'USD'
    default: return 'GBP'
  }
}

/**
 * Normalize size string for consistent matching.
 * Handles: "10" vs "10.0" vs "10.00", trailing spaces
 * Does NOT strip W suffix - that's meaningful for women's sizes!
 */
function normalizeSize(size: string): string {
  const s = size.trim()
  // Normalize numeric format (10.0 -> 10) but preserve W/M suffix
  const match = s.match(/^([0-9.]+)([WM]?)$/i)
  if (match) {
    const numPart = match[1].includes('.') ? String(Number(match[1])) : match[1]
    return numPart + match[2].toUpperCase()
  }
  return s
}

// =============================================================================
// HOOK
// =============================================================================

export function useInventoryV4(
  options: UseInventoryV4Options = {}
): UseInventoryV4Return {
  const {
    statuses = DEFAULT_STATUSES,
    autoFetch = true,
    aliasRegion: aliasRegionOverride,
    pollSyncStatus = true,
    pollIntervalMs = 5000,
  } = options

  // Memoize statuses to prevent refetch loops when caller passes new array each render
  // Sort + dedupe so order doesn't matter
  const stableStatuses = useMemo(
    () => Array.from(new Set(statuses)).sort(),
    [statuses.slice().sort().join('|')]
  )

  const [items, setItems] = useState<InventoryV4ItemFull[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [pendingSyncs, setPendingSyncs] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [marketDataUnavailable, setMarketDataUnavailable] = useState(false)

  // Track style_ids for sync polling
  const styleIdsRef = useRef<string[]>([])

  // Get user settings with pre-computed region/currency mappings
  const {
    settings: userSettings,
    aliasRegionId: userAliasRegionId,
    stockxCurrency: userStockxCurrency,
  } = useUserSettings()

  // Alias region: use override if provided, otherwise use user settings
  const aliasRegion: AliasRegionId = aliasRegionOverride ?? userAliasRegionId

  // StockX currency: derive from aliasRegion (so override changes it too)
  // This ensures EU region shows EUR prices, US shows USD, UK shows GBP
  const stockxCurrency = aliasRegionOverride
    ? regionToCurrency(aliasRegionOverride)
    : userStockxCurrency

  // Display currency: match the region's currency for StockX
  // (Alias prices are always USD and get converted)
  const displayCurrency: Currency = regionToCurrency(aliasRegion)

  // Get currency context for FX rates (for Alias USD→display conversion)
  const { fxRates: currencyFxRates } = useCurrency()

  // Build FxRates object for pricing module
  // useCurrency provides: usd_per_gbp, eur_per_gbp, gbp_per_usd, gbp_per_eur, usd_per_eur, eur_per_usd
  // pricing-v4 needs: multipliers to convert FROM source currency TO display currency
  const fxRates = useMemo((): FxRates => {
    if (currencyFxRates) {
      // Build "X to display" multipliers based on display currency (derived from region)
      let gbpToUser: number
      let usdToUser: number
      let eurToUser: number

      if (displayCurrency === 'GBP') {
        gbpToUser = 1
        usdToUser = currencyFxRates.gbp_per_usd // USD → GBP
        eurToUser = currencyFxRates.gbp_per_eur // EUR → GBP
      } else if (displayCurrency === 'USD') {
        gbpToUser = currencyFxRates.usd_per_gbp // GBP → USD
        usdToUser = 1
        eurToUser = currencyFxRates.usd_per_eur // EUR → USD
      } else {
        // EUR
        gbpToUser = currencyFxRates.eur_per_gbp // GBP → EUR
        usdToUser = currencyFxRates.eur_per_usd // USD → EUR
        eurToUser = 1
      }

      return {
        gbpToUser,
        usdToUser,
        eurToUser,
        userCurrency: displayCurrency,
        timestamp: currencyFxRates.as_of,
      }
    }
    return getDefaultFxRates(displayCurrency)
  }, [currencyFxRates, displayCurrency])

  // Fee profile from user settings (seller level, shipping fees, etc.)
  // Uses buildFeeProfile to convert DB settings to FeeProfile format
  const feeProfile = useMemo<FeeProfile>(() => {
    if (!userSettings) return DEFAULT_FEE_PROFILE
    return buildFeeProfile({
      stockx_seller_level: userSettings.stockx_seller_level,
      stockx_shipping_fee: userSettings.stockx_shipping_fee,
      alias_region: userSettings.alias_region,
      alias_shipping_method: userSettings.alias_shipping_method,
    })
  }, [userSettings])

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      setMarketDataUnavailable(false)

      // ========================================================================
      // 0. VERIFY AUTHENTICATED USER (required for RLS)
      // ========================================================================
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        // No authenticated user - RLS will block queries anyway
        // Return empty result without error to avoid confusing UX
        console.log('[useInventoryV4] No authenticated user, skipping fetch')
        setItems([])
        return
      }

      // ========================================================================
      // 1. FETCH INVENTORY ITEMS WITH JOINED STYLE CATALOG
      // ========================================================================

      const { data: itemsData, error: itemsError } = await supabase
        .from('inventory_v4_items')
        .select(`
          *,
          style:inventory_v4_style_catalog (*)
        `)
        .in('status', stableStatuses)
        .order('created_at', { ascending: false })

      if (itemsError) {
        throw new Error(`Failed to fetch inventory: ${itemsError.message}`)
      }

      if (!itemsData || itemsData.length === 0) {
        setItems([])
        return
      }

      // Parse joined data
      const itemsWithStyles: ItemWithStyle[] = itemsData
        .filter((row) => row.style !== null)
        .map((row) => ({
          item: {
            id: row.id,
            user_id: row.user_id,
            style_id: row.style_id,
            size: row.size,
            size_unit: row.size_unit,
            purchase_price: row.purchase_price,
            purchase_currency: row.purchase_currency,
            purchase_date: row.purchase_date,
            condition: row.condition,
            status: row.status,
            consignment_location: row.consignment_location,
            purchase_source: row.purchase_source,
            notes: row.notes,
            created_at: row.created_at,
            updated_at: row.updated_at,
          } as InventoryV4Item,
          style: row.style as StyleCatalogV4,
        }))

      // ========================================================================
      // 2. FETCH LISTINGS FOR ITEMS
      // ========================================================================

      const itemIds = itemsWithStyles.map((i) => i.item.id)
      const listingsMap = new Map<string, InventoryV4Listing[]>()

      if (itemIds.length > 0) {
        const { data: listingsData, error: listingsError } = await supabase
          .from('inventory_v4_listings')
          .select('*')
          .in('item_id', itemIds)

        if (listingsError) {
          console.warn('[useInventoryV4] Listings fetch failed:', listingsError)
          // Continue without listings rather than failing completely
        } else if (listingsData) {
          // Group listings by item_id
          for (const row of listingsData) {
            const listing: InventoryV4Listing = {
              id: row.id,
              item_id: row.item_id,
              user_id: row.user_id,
              platform: row.platform,
              platform_name: row.platform_name,
              listed_price: row.listed_price,
              listed_currency: row.listed_currency,
              listing_url: row.listing_url,
              external_listing_id: row.external_listing_id,
              status: row.status,
              sold_price: row.sold_price,
              sold_at: row.sold_at,
              listed_at: row.listed_at,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }
            const existing = listingsMap.get(row.item_id) ?? []
            existing.push(listing)
            listingsMap.set(row.item_id, existing)
          }
        }
      }

      // ========================================================================
      // 3. FETCH MARKET DATA VIA BATCH RPC
      // ========================================================================

      // Extract unique style_ids and sizes
      // IMPORTANT: Convert sizes to US for StockX lookup (StockX stores US sizes)
      // Pass gender + brand for correct women's conversion (Nike UK 11 = US 13.5W)
      const styleIds = [...new Set(itemsWithStyles.map((i) => i.item.style_id))]

      // Build sizes array - for items with unknown gender, include BOTH men's and women's variants
      // This ensures we fetch market data for women's products even when gender isn't set
      const usSizesSet = new Set<string>()
      for (const { item, style } of itemsWithStyles) {
        // Always add the gender-specific conversion
        const primarySize = convertToUsSize(item.size, item.size_unit, style.gender, style.brand, style.name)
        usSizesSet.add(primarySize)

        // If gender is unknown, also add the men's size + W suffix (for women's products without gender set)
        if (!style.gender) {
          // IMPORTANT: Pass 'men' explicitly to get men's conversion without auto-detection
          // (Don't pass null+name because convertToUsSize would auto-detect gender from name)
          const mensSize = convertToUsSize(item.size, item.size_unit, 'men', style.brand, null)
          usSizesSet.add(mensSize + 'W') // Also fetch potential women's variant
          // And the women's conversion in case it's different
          const womensSize = convertToUsSize(item.size, item.size_unit, 'women', style.brand, style.name)
          usSizesSet.add(womensSize)
        }
      }
      const usSizes = [...usSizesSet]

      const marketDataMap = new Map<string, UnifiedMarketBatchRow>()

      if (styleIds.length > 0 && usSizes.length > 0) {
        console.log('[useInventoryV4] Fetching market data:', {
          styleIds: styleIds.slice(0, 3),
          usSizes: usSizes.slice(0, 10),
          totalStyles: styleIds.length,
          totalSizes: usSizes.length,
        })

        const { data: marketData, error: marketError } = await supabase.rpc(
          'get_unified_market_data_batch',
          {
            p_style_ids: styleIds,
            p_sizes: usSizes,
            p_alias_region: aliasRegion,
            p_consigned: false,
            p_stockx_currency: stockxCurrency,
          }
        )

        if (marketError) {
          console.warn('[useInventoryV4] Market data fetch failed:', marketError)
          // Continue without market data rather than failing completely
          setMarketDataUnavailable(true)
        } else if (marketData) {
          // Build lookup map: "styleId|usSize" -> market row
          // size_display from RPC is already US size
          for (const row of marketData as UnifiedMarketBatchRow[]) {
            const key = `${row.style_id}|${normalizeSize(row.size_display)}`
            marketDataMap.set(key, row)
          }
          console.log('[useInventoryV4] Market data loaded:', {
            rowCount: (marketData as UnifiedMarketBatchRow[]).length,
            keys: Array.from(marketDataMap.keys()).slice(0, 10),
          })
        }
      }

      // ========================================================================
      // 4. CALCULATE ARCHVD PRICE WITH FEES FOR EACH ITEM
      // ========================================================================

      const enrichedItems: InventoryV4ItemFull[] = itemsWithStyles.map(
        ({ item, style }) => {
          // Look up market data using US-converted size (gender + brand aware)
          let usSize = convertToUsSize(item.size, item.size_unit, style.gender, style.brand, style.name)
          let normalizedUsSize = normalizeSize(usSize)
          let marketKey = `${item.style_id}|${normalizedUsSize}`
          let marketRow = marketDataMap.get(marketKey)

          // Smart fallback: If no match and gender is null, check if product is actually women's
          // by looking at available variant sizes (they'll have "W" suffix)
          if (!marketRow && !style.gender) {
            const availableKeys = Array.from(marketDataMap.keys()).filter(k => k.startsWith(item.style_id))
            const allWomensSizes = availableKeys.length > 0 && availableKeys.every(k => k.endsWith('W'))

            if (allWomensSizes) {
              // Retry with women's conversion
              usSize = convertToUsSize(item.size, item.size_unit, 'women', style.brand, style.name)
              normalizedUsSize = normalizeSize(usSize)
              marketKey = `${item.style_id}|${normalizedUsSize}`
              marketRow = marketDataMap.get(marketKey)

              // If still no match, try adding W suffix to the men's size (in case user entered US size as UK)
              if (!marketRow) {
                const mensUsSize = convertToUsSize(item.size, item.size_unit, null, style.brand, style.name)
                const mensWithW = `${item.style_id}|${normalizeSize(mensUsSize)}W`
                marketRow = marketDataMap.get(mensWithW)
                if (marketRow) {
                  normalizedUsSize = `${normalizeSize(mensUsSize)}W`
                  marketKey = mensWithW
                  console.log('[useInventoryV4] Matched men\'s size with W suffix:', mensWithW)
                }
              }

              if (marketRow) {
                console.log('[useInventoryV4] Auto-detected women\'s product:', item.style_id)
              }
            }
          }

          // Debug logging for size conversion issues
          if (!marketRow && marketDataMap.size > 0) {
            console.log('[useInventoryV4] Size lookup miss:', {
              itemSize: item.size,
              sizeUnit: item.size_unit,
              gender: style.gender,
              brand: style.brand,
              convertedUsSize: usSize,
              normalizedUsSize,
              marketKey,
              availableKeys: Array.from(marketDataMap.keys()).filter(k => k.startsWith(item.style_id)).slice(0, 5),
            })
          }

          // Build UnifiedMarketInput
          const marketInput: UnifiedMarketInput = {
            styleId: item.style_id,
            size: item.size,
            sizeUnit: item.size_unit as 'US' | 'UK' | 'EU',
            stockx: marketRow?.has_stockx
              ? {
                  lowestAsk: marketRow.stockx_lowest_ask,
                  highestBid: marketRow.stockx_highest_bid,
                  currency: stockxCurrency, // Pass the actual currency from region
                }
              : null,
            alias: marketRow?.has_alias
              ? {
                  lowestAsk: marketRow.alias_lowest_ask,
                  highestBid: marketRow.alias_highest_bid,
                  lastSalePrice: marketRow.alias_last_sale,
                  salesLast72h: marketRow.alias_sales_72h,
                  salesLast30d: marketRow.alias_sales_30d,
                }
              : null,
          }

          // Build cost input
          const costInput: CostInput | null =
            item.purchase_price !== null
              ? {
                  amount: item.purchase_price,
                  currency: item.purchase_currency as Currency,
                }
              : null

          // Calculate pricing
          const marketData = calculateArchvdPriceWithFees(
            marketInput,
            costInput,
            { fxRates, feeProfile }
          )

          // Get listings for this item
          const listings = listingsMap.get(item.id) ?? []

          return {
            ...item,
            style,
            marketData,
            syncStatus: null, // Could be fetched separately if needed
            listings,
          }
        }
      )

      setItems(enrichedItems)

      // Update style IDs for sync polling
      styleIdsRef.current = [...new Set(enrichedItems.map((i) => i.style_id))]
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error('[useInventoryV4] Error:', error)
      setError(error)
    } finally {
      setIsLoading(false)
    }
  }, [stableStatuses, aliasRegion, stockxCurrency, fxRates, feeProfile])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchItems()
    }
  }, [autoFetch, fetchItems])

  // ==========================================================================
  // SYNC POLLING
  // ==========================================================================

  // Check sync status for current style IDs
  const checkSyncStatus = useCallback(async () => {
    if (styleIdsRef.current.length === 0) {
      setPendingSyncs(0)
      setIsSyncing(false)
      return 0
    }

    try {
      const { data, error: syncError } = await supabase
        .from('inventory_v4_sync_queue')
        .select('style_id, status')
        .in('style_id', styleIdsRef.current)
        .in('status', ['pending', 'processing'])

      if (syncError) {
        console.warn('[useInventoryV4] Sync status check failed:', syncError)
        return 0
      }

      const pendingCount = data?.length ?? 0
      setPendingSyncs(pendingCount)
      setIsSyncing(pendingCount > 0)
      return pendingCount
    } catch (err) {
      console.warn('[useInventoryV4] Sync status check error:', err)
      return 0
    }
  }, [])

  // Poll for sync completion
  useEffect(() => {
    if (!pollSyncStatus || styleIdsRef.current.length === 0) return

    let pollTimer: ReturnType<typeof setInterval> | null = null
    let isActive = true

    const startPolling = async () => {
      // Initial check
      const initialCount = await checkSyncStatus()

      // Only start polling if there are pending syncs
      if (initialCount > 0 && isActive) {
        pollTimer = setInterval(async () => {
          const count = await checkSyncStatus()

          // If all syncs complete, refetch and stop polling
          if (count === 0 && isActive) {
            if (pollTimer) clearInterval(pollTimer)
            pollTimer = null
            // Refetch to get fresh market data
            fetchItems()
          }
        }, pollIntervalMs)
      }
    }

    startPolling()

    return () => {
      isActive = false
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [pollSyncStatus, pollIntervalMs, checkSyncStatus, fetchItems])

  return {
    items,
    isLoading,
    error,
    refetch: fetchItems,
    pendingSyncs,
    isSyncing,
    marketDataUnavailable,
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the best price info for display
 */
export function getBestPriceDisplay(marketData: ArchvdPriceWithFees | null): {
  price: number | null
  platform: 'stockx' | 'alias' | null
  formatted: string
} {
  if (!marketData || marketData.bestNetProceeds === null) {
    return { price: null, platform: null, formatted: '—' }
  }

  return {
    price: marketData.bestNetProceeds,
    platform: marketData.bestPlatformToSell,
    formatted: formatCurrency(marketData.bestNetProceeds, marketData.currency),
  }
}

/**
 * Get profit/loss display
 */
export function getProfitDisplay(marketData: ArchvdPriceWithFees | null): {
  amount: number | null
  percent: number | null
  isProfit: boolean
  formatted: string
  percentFormatted: string
} {
  if (!marketData || marketData.realProfit === null) {
    return {
      amount: null,
      percent: null,
      isProfit: false,
      formatted: '—',
      percentFormatted: '—',
    }
  }

  const isProfit = marketData.realProfit >= 0
  const sign = isProfit ? '+' : ''

  return {
    amount: marketData.realProfit,
    percent: marketData.realProfitPercent,
    isProfit,
    formatted: `${sign}${formatCurrency(marketData.realProfit, marketData.currency)}`,
    percentFormatted:
      marketData.realProfitPercent !== null
        ? `${sign}${marketData.realProfitPercent.toFixed(1)}%`
        : '—',
  }
}

/**
 * Format currency value
 */
function formatCurrency(value: number, currency: string): string {
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
  const symbol = symbols[currency] ?? currency
  return `${symbol}${Math.abs(value).toFixed(2)}`
}
