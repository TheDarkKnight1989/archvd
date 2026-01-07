'use client'

/**
 * Market Data Inspector - Best in Class
 * Professional tool to compare StockX vs Alias/GOAT market data
 *
 * ⚠️  CRITICAL PAGE - DO NOT MODIFY WITHOUT TESTING ⚠️
 *
 * This page is intentionally self-contained with inline types and direct
 * Supabase queries. It has no external business logic dependencies.
 *
 * If you need to modify this page:
 * 1. Test with SKUs that have: StockX only, Alias only, both, neither
 * 2. Test with SKUs where stockx_url_key is null but stockx_product_id exists
 * 3. Verify all 3 regions work for both StockX and Alias
 *
 * Database tables used:
 * - inventory_v4_style_catalog (lookup by style_id)
 * - inventory_v4_stockx_products, _variants, _market_data
 * - inventory_v4_alias_products, _variants, _market_data
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  RefreshCw,
  Clock,
  Zap,
  ArrowRightLeft,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  History,
  Info,
  Globe,
  Settings2,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'

// ============================================================================
// Types
// ============================================================================

type DisplayCurrency = 'GBP' | 'USD' | 'EUR'

// Local FX rates - manually adjustable, later can fetch from real FX source
const FX_RATES: Record<string, number> = {
  'USD_GBP': 0.80,
  'EUR_GBP': 0.86,
  'GBP_GBP': 1.00,
  'USD_USD': 1.00,
  'GBP_USD': 1.25,
  'EUR_USD': 1.08,
  'USD_EUR': 0.93,
  'GBP_EUR': 1.16,
  'EUR_EUR': 1.00,
}

function convertToDisplayCurrency(
  amount: number | null | undefined,
  from: string | null | undefined,
  display: DisplayCurrency
): number | null {
  if (amount == null || !from) return null

  const upperFrom = from.toUpperCase()
  if (upperFrom === display) return amount // Same currency, no conversion

  const pair = `${upperFrom}_${display}`
  const rate = FX_RATES[pair]
  if (!rate) return null // no rate = show dash

  return +(amount * rate).toFixed(2)
}

function getDisplaySymbol(display: DisplayCurrency): string {
  if (display === 'GBP') return '£'
  if (display === 'EUR') return '€'
  if (display === 'USD') return '$'
  return display
}

// Map region to default currency
function regionToDefaultCurrency(regionId: string): DisplayCurrency {
  switch (regionId) {
    case '1': return 'GBP'
    case '2': return 'EUR'
    case '3': return 'USD'
    default: return 'GBP'
  }
}

interface StyleInfo {
  style_id: string
  brand: string | null
  name: string | null
  stockx_url_key: string | null
  stockx_product_id: string | null
  alias_catalog_id: string | null
}

interface StockXProduct {
  stockx_product_id: string
  title: string
}

interface StockXVariant {
  stockx_variant_id: string
  variant_value: string
}

interface StockXMarketData {
  stockx_variant_id: string
  lowest_ask: number | null
  highest_bid: number | null
  currency_code: string
  flex_lowest_ask: number | null
  earn_more: number | null
  sell_faster: number | null
  updated_at: string | null
}

interface AliasProduct {
  alias_catalog_id: string
  name: string
  main_picture_url: string | null
}

interface AliasVariant {
  id: number
  size_value: number
  size_display: string
  region_id: string
  consigned: boolean
}

interface AliasMarketData {
  alias_variant_id: number
  lowest_ask: number | null
  highest_bid: number | null
  last_sale_price: number | null
  currency_code: string
  updated_at: string | null
}

interface UnifiedSizeRow {
  size: string
  sizeNumeric: number
  stockx: {
    ask: number | null
    bid: number | null
    flex: number | null
    spread: number | null
    spreadPct: number | null
    updatedAt: string | null
    currency: string
  } | null
  alias: {
    newAsk: number | null
    newBid: number | null
    newLastSale: number | null
    consignedAsk: number | null
    consignedLastSale: number | null
    spread: number | null
    spreadPct: number | null
    updatedAt: string | null
    currency: string
  } | null
  comparison: {
    bestAsk: 'stockx' | 'alias' | 'tie' | null
    priceDiff: number | null
    priceDiffPct: number | null
    arbitrage: boolean
  }
}

interface MarketStats {
  stockxSizesWithData: number
  aliasSizesWithData: number
  avgStockxSpread: number | null
  avgAliasSpread: number | null
  arbitrageCount: number
  stockxFreshness: string | null
  aliasFreshness: string | null
}

// ============================================================================
// Utility Functions
// ============================================================================

const formatTimeAgo = (dateString: string | null) => {
  if (!dateString) return null
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

const RECENT_SEARCHES_KEY = 'market-inspector-recent'
const MAX_RECENT = 8

// ============================================================================
// Main Component
// ============================================================================

export default function MarketInspectorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [sku, setSku] = useState(searchParams.get('sku') || '')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState<'stockx' | 'alias' | null>(null)
  const [aliasRegion, setAliasRegion] = useState(searchParams.get('region') || '1') // Default to UK (region 1 in corrected mapping)
  const [stockxRegion, setStockxRegion] = useState(searchParams.get('sxRegion') || '1') // StockX region: 1=UK/GBP, 2=EU/EUR, 3=US/USD
  const [splitRegions, setSplitRegions] = useState(false) // Advanced mode: split provider regions
  const [copied, setCopied] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('GBP')

  // Data
  const [style, setStyle] = useState<StyleInfo | null>(null)
  const [stockxProduct, setStockxProduct] = useState<StockXProduct | null>(null)
  const [aliasProduct, setAliasProduct] = useState<AliasProduct | null>(null)
  const [unifiedData, setUnifiedData] = useState<UnifiedSizeRow[]>([])
  const [stats, setStats] = useState<MarketStats | null>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored))
      } catch {}
    }
  }, [])

  // Auto-load if SKU in URL
  useEffect(() => {
    const urlSku = searchParams.get('sku')
    const urlAliasRegion = searchParams.get('region') || '1'
    const urlStockxRegion = searchParams.get('sxRegion') || '1'
    if (urlSku && urlSku !== sku) {
      setSku(urlSku)
      setAliasRegion(urlAliasRegion)
      setStockxRegion(urlStockxRegion)
      loadMarketData(urlSku, urlAliasRegion, urlStockxRegion)
    }
  }, [searchParams])

  // Re-fetch when either region changes (and we already have a SKU loaded)
  useEffect(() => {
    if (style && sku) {
      loadMarketData(sku, aliasRegion, stockxRegion)
    }
  }, [aliasRegion, stockxRegion])

  // Save recent search
  const saveRecentSearch = (searchSku: string) => {
    const updated = [searchSku, ...recentSearches.filter((s) => s !== searchSku)].slice(
      0,
      MAX_RECENT
    )
    setRecentSearches(updated)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  }

  // Update URL
  const updateUrl = useCallback(
    (newSku: string, aliasReg: string, stockxReg: string) => {
      const params = new URLSearchParams()
      if (newSku) params.set('sku', newSku)
      if (aliasReg !== '1') params.set('region', aliasReg) // Omit when default (UK = region 1)
      if (stockxReg !== '1') params.set('sxRegion', stockxReg) // Omit when default (UK = GBP)
      router.replace(`/portfolio/admin/market-inspector?${params.toString()}`, { scroll: false })
    },
    [router]
  )

  // Map region ID to StockX currency code
  const regionToCurrency = (regionId: string): string => {
    switch (regionId) {
      case '1': return 'GBP'
      case '2': return 'EUR'
      case '3': return 'USD'
      default: return 'GBP'
    }
  }

  // Main data loader
  const loadMarketData = async (searchSku?: string, aliasReg?: string, stockxReg?: string) => {
    const targetSku = searchSku || sku.trim().toUpperCase()
    const targetAliasRegion = aliasReg || aliasRegion
    const targetStockxRegion = stockxReg || stockxRegion
    const targetStockxCurrency = regionToCurrency(targetStockxRegion)

    if (!targetSku) return

    setLoading(true)
    setError(null)

    try {
      // Update URL
      updateUrl(targetSku, targetAliasRegion, targetStockxRegion)
      saveRecentSearch(targetSku)

      // 1. Get style catalog entry
      const { data: styleData, error: styleError } = await supabase
        .from('inventory_v4_style_catalog')
        .select('style_id, brand, name, stockx_url_key, stockx_product_id, alias_catalog_id')
        .eq('style_id', targetSku)
        .maybeSingle()

      if (styleError) throw new Error(`Style lookup failed: ${styleError.message}`)

      if (!styleData) {
        setError(`SKU "${targetSku}" not found in style catalog`)
        setLoading(false)
        return
      }

      setStyle(styleData)

      // 2. Fetch StockX data
      const sxVariants: StockXVariant[] = []
      const sxMarketMap: Record<string, StockXMarketData> = {}

      // Check stockx_product_id, not stockx_url_key - url_key may be null even when product exists
      if (styleData.stockx_product_id) {
        const { data: sxProd } = await supabase
          .from('inventory_v4_stockx_products')
          .select('stockx_product_id, title')
          .eq('style_id', targetSku)
          .maybeSingle()

        if (sxProd) {
          setStockxProduct(sxProd)

          const { data: variants } = await supabase
            .from('inventory_v4_stockx_variants')
            .select('stockx_variant_id, variant_value')
            .eq('stockx_product_id', sxProd.stockx_product_id)

          if (variants) {
            sxVariants.push(...(variants as StockXVariant[]))
            const variantIds = variants.map((v) => v.stockx_variant_id)

            // Filter by selected StockX currency (GBP/EUR/USD)
            const { data: marketData } = await supabase
              .from('inventory_v4_stockx_market_data')
              .select(
                'stockx_variant_id, lowest_ask, highest_bid, currency_code, flex_lowest_ask, earn_more, sell_faster, updated_at'
              )
              .in('stockx_variant_id', variantIds)
              .eq('currency_code', targetStockxCurrency)

            if (marketData) {
              for (const m of marketData) {
                sxMarketMap[m.stockx_variant_id] = m as StockXMarketData
              }
            }
          }
        }
      }

      // 3. Fetch Alias data
      const alVariants: AliasVariant[] = []
      const alMarketMap: Record<number, AliasMarketData> = {}

      if (styleData.alias_catalog_id) {
        const { data: alProd } = await supabase
          .from('inventory_v4_alias_products')
          .select('alias_catalog_id, name, main_picture_url')
          .eq('alias_catalog_id', styleData.alias_catalog_id)
          .maybeSingle()

        if (alProd) {
          setAliasProduct(alProd)

          const { data: variants } = await supabase
            .from('inventory_v4_alias_variants')
            .select('id, size_value, size_display, region_id, consigned')
            .eq('alias_catalog_id', styleData.alias_catalog_id)
            .eq('region_id', targetAliasRegion)

          if (variants) {
            alVariants.push(...(variants as AliasVariant[]))
            const variantIds = variants.map((v) => v.id)

            const { data: marketData } = await supabase
              .from('inventory_v4_alias_market_data')
              .select(
                'alias_variant_id, lowest_ask, highest_bid, last_sale_price, currency_code, updated_at'
              )
              .in('alias_variant_id', variantIds)

            if (marketData) {
              for (const m of marketData) {
                alMarketMap[m.alias_variant_id] = m as AliasMarketData
              }
            }
          }
        }
      }

      // 4. Build unified data
      const sizeSet = new Set<string>()
      const sxSizeMap = new Map<string, { variant: StockXVariant; market: StockXMarketData | null }>()
      const alNewMap = new Map<number, { variant: AliasVariant; market: AliasMarketData | null }>()
      const alConMap = new Map<number, { variant: AliasVariant; market: AliasMarketData | null }>()

      for (const v of sxVariants) {
        sizeSet.add(v.variant_value)
        sxSizeMap.set(v.variant_value, { variant: v, market: sxMarketMap[v.stockx_variant_id] || null })
      }

      for (const v of alVariants) {
        sizeSet.add(v.size_display)
        const map = v.consigned ? alConMap : alNewMap
        map.set(v.size_value, { variant: v, market: alMarketMap[v.id] || null })
      }

      // Build unified rows
      const unified: UnifiedSizeRow[] = []
      let sxWithData = 0
      let alWithData = 0
      let totalSxSpread = 0
      let sxSpreadCount = 0
      let totalAlSpread = 0
      let alSpreadCount = 0
      let arbitrageCount = 0
      let latestSxUpdate: string | null = null
      let latestAlUpdate: string | null = null

      for (const sizeStr of Array.from(sizeSet).sort((a, b) => parseFloat(a) - parseFloat(b))) {
        const sizeNum = parseFloat(sizeStr)
        if (isNaN(sizeNum) || sizeNum < 3 || sizeNum > 20) continue

        const sx = sxSizeMap.get(sizeStr)
        const alNew = alNewMap.get(sizeNum)
        const alCon = alConMap.get(sizeNum)

        // StockX data
        let stockxRow: UnifiedSizeRow['stockx'] = null
        if (sx?.market) {
          const spread =
            sx.market.lowest_ask && sx.market.highest_bid
              ? sx.market.lowest_ask - sx.market.highest_bid
              : null
          const spreadPct =
            spread !== null && sx.market.lowest_ask
              ? (spread / sx.market.lowest_ask) * 100
              : null

          stockxRow = {
            ask: sx.market.lowest_ask,
            bid: sx.market.highest_bid,
            flex: sx.market.flex_lowest_ask,
            spread,
            spreadPct,
            updatedAt: sx.market.updated_at,
            currency: sx.market.currency_code || 'GBP',
          }

          if (sx.market.lowest_ask || sx.market.highest_bid) sxWithData++
          if (spread !== null) {
            totalSxSpread += spreadPct!
            sxSpreadCount++
          }
          if (sx.market.updated_at) {
            if (!latestSxUpdate || sx.market.updated_at > latestSxUpdate) {
              latestSxUpdate = sx.market.updated_at
            }
          }
        }

        // Alias data
        let aliasRow: UnifiedSizeRow['alias'] = null
        if (alNew || alCon) {
          const newMarket = alNew?.market
          const conMarket = alCon?.market
          const spread =
            newMarket?.lowest_ask && newMarket?.highest_bid
              ? newMarket.lowest_ask - newMarket.highest_bid
              : null
          const spreadPct =
            spread !== null && newMarket?.lowest_ask
              ? (spread / newMarket.lowest_ask) * 100
              : null

          aliasRow = {
            newAsk: newMarket?.lowest_ask || null,
            newBid: newMarket?.highest_bid || null,
            newLastSale: newMarket?.last_sale_price || null,
            consignedAsk: conMarket?.lowest_ask || null,
            consignedLastSale: conMarket?.last_sale_price || null,
            spread,
            spreadPct,
            updatedAt: newMarket?.updated_at || conMarket?.updated_at || null,
            currency: newMarket?.currency_code || conMarket?.currency_code || 'USD',
          }

          if (newMarket?.lowest_ask || newMarket?.highest_bid || conMarket?.lowest_ask) alWithData++
          if (spread !== null) {
            totalAlSpread += spreadPct!
            alSpreadCount++
          }
          const aliasUpdatedAt = aliasRow.updatedAt
          if (aliasUpdatedAt) {
            if (!latestAlUpdate || aliasUpdatedAt > latestAlUpdate) {
              latestAlUpdate = aliasUpdatedAt
            }
          }
        }

        // Comparison
        let comparison: UnifiedSizeRow['comparison'] = {
          bestAsk: null,
          priceDiff: null,
          priceDiffPct: null,
          arbitrage: false,
        }

        const sxAsk = stockxRow?.ask
        const alAsk = aliasRow?.newAsk

        if (sxAsk && alAsk) {
          const diff = sxAsk - alAsk
          const diffPct = (diff / Math.min(sxAsk, alAsk)) * 100

          comparison = {
            bestAsk: diff > 0 ? 'alias' : diff < 0 ? 'stockx' : 'tie',
            priceDiff: Math.abs(diff),
            priceDiffPct: Math.abs(diffPct),
            arbitrage: Math.abs(diffPct) >= 10, // 10%+ difference = arbitrage opportunity
          }

          if (comparison.arbitrage) arbitrageCount++
        }

        unified.push({
          size: sizeStr,
          sizeNumeric: sizeNum,
          stockx: stockxRow,
          alias: aliasRow,
          comparison,
        })
      }

      setUnifiedData(unified)
      setStats({
        stockxSizesWithData: sxWithData,
        aliasSizesWithData: alWithData,
        avgStockxSpread: sxSpreadCount > 0 ? totalSxSpread / sxSpreadCount : null,
        avgAliasSpread: alSpreadCount > 0 ? totalAlSpread / alSpreadCount : null,
        arbitrageCount,
        stockxFreshness: formatTimeAgo(latestSxUpdate),
        aliasFreshness: formatTimeAgo(latestAlUpdate),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Trigger sync
  const triggerSync = async (platform: 'stockx' | 'alias') => {
    if (!style) return
    setSyncing(platform)

    try {
      const endpoint =
        platform === 'stockx'
          ? `/api/sync/stockx?sku=${style.style_id}`
          : `/api/sync/alias?catalogId=${style.alias_catalog_id}`

      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')

      // Reload data
      await loadMarketData()
    } catch (err) {
      setError(`Sync failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setSyncing(null)
    }
  }

  // Copy share link
  const copyShareLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        loadMarketData()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sku, aliasRegion])

  // Get product image (only from Alias since StockX doesn't store images)
  const productImage = useMemo(() => {
    return aliasProduct?.main_picture_url || null
  }, [aliasProduct])

  // Explicit region definitions - order determines button display order
  // CORRECTED: Alias API region IDs appear to be INVERTED from documentation
  // Based on user testing: region_id=1 returns UK data, region_id=3 returns US data
  const regionButtons = [
    { id: '1', label: 'UK', flag: '🇬🇧', currency: 'GBP' as DisplayCurrency },
    { id: '2', label: 'EU', flag: '🇪🇺', currency: 'EUR' as DisplayCurrency },
    { id: '3', label: 'US', flag: '🇺🇸', currency: 'USD' as DisplayCurrency },
  ] as const
  const regionLabels: Record<string, string> = { '1': 'UK', '2': 'EU', '3': 'US' }
  const currencyOptions: { value: DisplayCurrency; label: string; symbol: string }[] = [
    { value: 'GBP', label: 'GBP', symbol: '£' },
    { value: 'EUR', label: 'EUR', symbol: '€' },
    { value: 'USD', label: 'USD', symbol: '$' },
  ]

  // Unified region change (default mode) - sets both providers and updates display currency
  const handleUnifiedRegionChange = (regionId: string) => {
    setAliasRegion(regionId)
    setStockxRegion(regionId)
    setDisplayCurrency(regionToDefaultCurrency(regionId))
  }

  // Get the unified region (only valid when both are same)
  const unifiedRegion = aliasRegion === stockxRegion ? aliasRegion : null

  // Normalized data with prices converted to display currency for proper comparison
  const normalizedData = useMemo(() => {
    return unifiedData.map((row) => {
      const sxCurrency = row.stockx?.currency || 'GBP'
      const alCurrency = row.alias?.currency || 'USD'

      const sxAsk = convertToDisplayCurrency(row.stockx?.ask, sxCurrency, displayCurrency)
      const alAsk = convertToDisplayCurrency(row.alias?.newAsk, alCurrency, displayCurrency)

      // Recalculate comparison in display currency
      let comparison = row.comparison
      if (sxAsk && alAsk) {
        const diff = sxAsk - alAsk
        const diffPct = (diff / Math.min(sxAsk, alAsk)) * 100

        comparison = {
          bestAsk: diff > 0 ? 'alias' : diff < 0 ? 'stockx' : 'tie',
          priceDiff: Math.abs(diff),
          priceDiffPct: Math.abs(diffPct),
          arbitrage: Math.abs(diffPct) >= 10,
        }
      }

      return {
        ...row,
        sxCurrency,
        alCurrency,
        normalized: {
          stockxAsk: sxAsk,
          stockxBid: convertToDisplayCurrency(row.stockx?.bid, sxCurrency, displayCurrency),
          stockxFlex: convertToDisplayCurrency(row.stockx?.flex, sxCurrency, displayCurrency),
          aliasAsk: alAsk,
          aliasBid: convertToDisplayCurrency(row.alias?.newBid, alCurrency, displayCurrency),
          aliasConsigned: convertToDisplayCurrency(row.alias?.consignedAsk, alCurrency, displayCurrency),
        },
        comparison,
      }
    })
  }, [unifiedData, displayCurrency])

  // Normalized stats
  const normalizedStats = useMemo(() => {
    if (!stats) return null

    let arbitrageCount = 0
    for (const row of normalizedData) {
      if (row.comparison.arbitrage) arbitrageCount++
    }

    return {
      ...stats,
      arbitrageCount,
    }
  }, [stats, normalizedData])

  // Get display currency label for header
  const getDisplayCurrencyLabel = () => {
    const opt = currencyOptions.find(o => o.value === displayCurrency)
    return opt ? `${opt.symbol} ${opt.label}` : displayCurrency
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Market Inspector
            </h1>
            <p className="text-sm text-gray-500 mt-1">Compare StockX vs Alias/GOAT pricing</p>
          </div>
          {style && (
            <Button variant="ghost" size="sm" onClick={copyShareLink} className="gap-2">
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Share'}
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Enter SKU (e.g., DD1391-100, BY1604)"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && loadMarketData()}
                  className="pl-10 font-mono bg-gray-800/50 border-gray-700 focus:border-blue-500 h-12 text-lg"
                />
              </div>
              <Button
                onClick={() => loadMarketData()}
                disabled={loading || !sku.trim()}
                className="h-12 px-8 bg-blue-600 hover:bg-blue-500"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Inspect
                  </>
                )}
              </Button>
            </div>

            {/* Recent Searches */}
            {recentSearches.length > 0 && !style && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <History className="h-3 w-3" /> Recent:
                </span>
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSku(s)
                      loadMarketData(s)
                    }}
                    className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 font-mono text-gray-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="bg-red-950/20 border-red-900/50">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <p className="text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {style && (
          <>
            {/* Product Hero */}
            <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
              <div className="flex flex-col md:flex-row">
                {/* Image */}
                <div className="w-full md:w-64 h-48 md:h-auto bg-gray-800 flex items-center justify-center p-4">
                  {productImage ? (
                    <img
                      src={productImage}
                      alt={style.name || style.style_id}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-gray-600 text-sm">No image</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500 uppercase tracking-wide">{style.brand}</p>
                      <h2 className="text-xl md:text-2xl font-bold mt-1">
                        {style.name || style.style_id}
                      </h2>
                      <p className="font-mono text-gray-400 mt-1">{style.style_id}</p>
                    </div>
                    <div className="flex gap-2">
                      {style.stockx_url_key && (
                        <a
                          href={`https://stockx.com/${style.stockx_url_key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-green-900/30 hover:bg-green-900/50 transition"
                        >
                          <span className="text-xs text-green-400 font-semibold">StockX</span>
                        </a>
                      )}
                      {style.alias_catalog_id && (
                        <a
                          href={`https://www.goat.com/sneakers/${style.alias_catalog_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 transition"
                        >
                          <span className="text-xs text-purple-400 font-semibold">GOAT</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Stats Row */}
                  {normalizedStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">StockX Sizes ({regionLabels[stockxRegion]})</p>
                        <p className="text-lg font-semibold text-green-400">
                          {normalizedStats.stockxSizesWithData}
                        </p>
                        {normalizedStats.stockxFreshness && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" /> {normalizedStats.stockxFreshness}
                          </p>
                        )}
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Alias Sizes ({regionLabels[aliasRegion]})</p>
                        <p className="text-lg font-semibold text-purple-400">
                          {normalizedStats.aliasSizesWithData}
                        </p>
                        {normalizedStats.aliasFreshness && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" /> {normalizedStats.aliasFreshness}
                          </p>
                        )}
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-gray-500">Avg Spread</p>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-gray-500 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-semibold mb-1">Bid-Ask Spread</p>
                                <p className="text-xs text-gray-400">
                                  The difference between the lowest ask and highest bid, shown as a percentage.
                                  Lower spread = more liquid market. Higher spread = bigger profit potential
                                  but harder to sell quickly.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-lg font-semibold text-amber-400">
                          {normalizedStats.avgStockxSpread !== null
                            ? `${normalizedStats.avgStockxSpread.toFixed(1)}%`
                            : '—'}
                        </p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-gray-500">Arbitrage Opps</p>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-gray-500 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-semibold mb-1">Arbitrage Opportunities</p>
                                <p className="text-xs text-gray-400">
                                  Sizes where StockX and Alias prices differ by 10% or more (when normalized to same currency).
                                  Buy on the cheaper platform, sell on the more expensive one.
                                  Yellow highlighted rows show these opportunities.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p
                          className={cn(
                            'text-lg font-semibold',
                            normalizedStats.arbitrageCount > 0 ? 'text-yellow-400' : 'text-gray-500'
                          )}
                        >
                          {normalizedStats.arbitrageCount > 0 && <Sparkles className="inline h-4 w-4 mr-1" />}
                          {normalizedStats.arbitrageCount}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Region Selector + Currency Toggle + Sync Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Default Mode: Unified Region Selector */}
                {!splitRegions && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-400 font-medium">Region:</span>
                    <div className="flex rounded-lg border border-gray-700 overflow-hidden">
                      {regionButtons.map(({ id, label, flag }) => (
                        <button
                          key={id}
                          onClick={() => handleUnifiedRegionChange(id)}
                          className={cn(
                            'px-3 py-1.5 text-sm font-medium transition-colors',
                            unifiedRegion === id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
                          )}
                        >
                          {flag} {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Advanced Mode: Split Provider Regions */}
                {splitRegions && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-400 font-medium">StockX:</span>
                      <div className="flex rounded-md border border-gray-700 overflow-hidden">
                        {regionButtons.map(({ id, label, flag }) => (
                          <button
                            key={id}
                            onClick={() => setStockxRegion(id)}
                            className={cn(
                              'px-2 py-1 text-xs font-medium transition-colors',
                              stockxRegion === id
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                            )}
                          >
                            {flag} {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-purple-400 font-medium">Alias:</span>
                      <div className="flex rounded-md border border-gray-700 overflow-hidden">
                        {regionButtons.map(({ id, label, flag }) => (
                          <button
                            key={id}
                            onClick={() => setAliasRegion(id)}
                            className={cn(
                              'px-2 py-1 text-xs font-medium transition-colors',
                              aliasRegion === id
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                            )}
                          >
                            {flag} {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Display Currency Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Currency:</span>
                  <div className="flex rounded-md border border-gray-700 overflow-hidden">
                    {currencyOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDisplayCurrency(opt.value)}
                        className={cn(
                          'px-2 py-1 text-xs font-medium transition-colors',
                          displayCurrency === opt.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                        )}
                      >
                        {opt.symbol} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced Mode Toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSplitRegions(!splitRegions)}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                          splitRegions
                            ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
                            : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/50'
                        )}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        {splitRegions ? 'Split' : 'Advanced'}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="font-semibold mb-1">Split Provider Regions</p>
                      <p className="text-xs text-gray-400">
                        Enable to set different regions for StockX and Alias independently.
                        Useful for cross-region arbitrage analysis.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerSync('stockx')}
                  disabled={syncing !== null || !style.stockx_product_id}
                  className="gap-2 h-8"
                >
                  {syncing === 'stockx' ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                  Sync StockX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerSync('alias')}
                  disabled={syncing !== null || !style.alias_catalog_id}
                  className="gap-2 h-8"
                >
                  {syncing === 'alias' ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                  Sync Alias
                </Button>
              </div>
            </div>

            {/* Main Data Table */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-blue-400" />
                    Price Comparison by Size
                  </div>
                  <span className="text-sm font-normal text-gray-500">
                    {getDisplayCurrencyLabel()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-2 text-gray-400 font-medium">Size <span className="text-gray-500 font-normal">(US)</span></th>
                        <th className="text-center py-3 px-2 text-green-400 font-medium bg-green-950/30 border-l border-green-900/30" colSpan={4}>
                          StockX ({regionLabels[stockxRegion]})
                        </th>
                        <th className="text-center py-3 px-2 text-purple-400 font-medium bg-purple-950/30 border-l border-purple-900/30" colSpan={4}>
                          Alias ({regionLabels[aliasRegion]})
                        </th>
                        <th className="text-center py-3 px-2 text-yellow-400 font-medium border-l border-gray-800">Best</th>
                      </tr>
                      <tr className="border-b border-gray-800/50 text-xs">
                        <th className="py-2 px-2"></th>
                        <th className="text-right py-2 px-2 text-green-400/60 bg-green-950/20 border-l border-green-900/30">Ask</th>
                        <th className="text-right py-2 px-2 text-green-400/60 bg-green-950/20">Bid</th>
                        <th className="text-right py-2 px-2 text-green-400/60 bg-green-950/20">Flex</th>
                        <th className="text-right py-2 px-2 text-green-400/60 bg-green-950/20">Spread</th>
                        <th className="text-right py-2 px-2 text-purple-400/60 bg-purple-950/20 border-l border-purple-900/30">Ask</th>
                        <th className="text-right py-2 px-2 text-purple-400/60 bg-purple-950/20">Bid</th>
                        <th className="text-right py-2 px-2 text-purple-400/60 bg-purple-950/20">Consigned</th>
                        <th className="text-right py-2 px-2 text-purple-400/60 bg-purple-950/20">Spread</th>
                        <th className="text-center py-2 px-2 text-gray-500 border-l border-gray-800">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalizedData.map((row) => {
                        const isBestStockx = row.comparison.bestAsk === 'stockx'
                        const isBestAlias = row.comparison.bestAsk === 'alias'
                        const isArbitrage = row.comparison.arbitrage

                        return (
                          <tr
                            key={row.size}
                            className={cn(
                              'border-b border-gray-800/30 hover:bg-gray-800/30 transition',
                              isArbitrage && 'bg-yellow-900/10'
                            )}
                          >
                            <td className="py-3 px-2 font-mono font-semibold">{row.size}</td>

                            {/* StockX - Normalized */}
                            <td
                              className={cn(
                                'py-3 px-2 text-right font-mono bg-green-950/10 border-l border-green-900/20',
                                isBestStockx ? 'text-green-400 font-semibold' : 'text-gray-300'
                              )}
                            >
                              {row.normalized.stockxAsk != null
                                ? `${getDisplaySymbol(displayCurrency)}${row.normalized.stockxAsk.toLocaleString()}`
                                : '—'}
                            </td>
                            <td className="py-3 px-2 text-right font-mono text-blue-400/70 bg-green-950/10">
                              {row.normalized.stockxBid != null
                                ? `${getDisplaySymbol(displayCurrency)}${row.normalized.stockxBid.toLocaleString()}`
                                : '—'}
                            </td>
                            <td className="py-3 px-2 text-right font-mono text-amber-400/70 bg-green-950/10">
                              {row.normalized.stockxFlex != null
                                ? `${getDisplaySymbol(displayCurrency)}${row.normalized.stockxFlex.toLocaleString()}`
                                : '—'}
                            </td>
                            <td className="py-3 px-2 text-right text-xs text-gray-500 bg-green-950/10">
                              {row.stockx?.spreadPct != null
                                ? `${row.stockx.spreadPct.toFixed(0)}%`
                                : '—'}
                            </td>

                            {/* Alias - Normalized */}
                            <td
                              className={cn(
                                'py-3 px-2 text-right font-mono bg-purple-950/10 border-l border-purple-900/20',
                                isBestAlias ? 'text-purple-400 font-semibold' : 'text-gray-300'
                              )}
                            >
                              {row.normalized.aliasAsk != null
                                ? `${getDisplaySymbol(displayCurrency)}${row.normalized.aliasAsk.toLocaleString()}`
                                : '—'}
                            </td>
                            <td className="py-3 px-2 text-right font-mono text-blue-400/70 bg-purple-950/10">
                              {row.normalized.aliasBid != null
                                ? `${getDisplaySymbol(displayCurrency)}${row.normalized.aliasBid.toLocaleString()}`
                                : '—'}
                            </td>
                            <td className="py-3 px-2 text-right font-mono text-amber-400/70 bg-purple-950/10">
                              {row.normalized.aliasConsigned != null
                                ? `${getDisplaySymbol(displayCurrency)}${row.normalized.aliasConsigned.toLocaleString()}`
                                : '—'}
                            </td>
                            <td className="py-3 px-2 text-right text-xs text-gray-500 bg-purple-950/10">
                              {row.alias?.spreadPct != null
                                ? `${row.alias.spreadPct.toFixed(0)}%`
                                : '—'}
                            </td>

                            {/* Comparison */}
                            <td className="py-3 px-2 text-center border-l border-gray-800/30">
                              {row.comparison.bestAsk && (
                                <div className="flex flex-col items-center">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-xs',
                                      isBestStockx && 'border-green-500/50 text-green-400',
                                      isBestAlias && 'border-purple-500/50 text-purple-400',
                                      isArbitrage && 'border-yellow-500/50 bg-yellow-900/30'
                                    )}
                                  >
                                    {isBestStockx ? 'SX' : isBestAlias ? 'AL' : '='}
                                    {row.comparison.priceDiffPct !== null && (
                                      <span className="ml-1">
                                        -{row.comparison.priceDiffPct.toFixed(0)}%
                                      </span>
                                    )}
                                  </Badge>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {normalizedData.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No size data available</p>
                    <p className="text-sm mt-2">Try syncing the product first</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-500/50"></span>
                <span>StockX best price</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-purple-500/50"></span>
                <span>Alias best price</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-yellow-500/50"></span>
                <span>Arbitrage (10%+ diff)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-500/50"></span>
                <span>Flex / Consigned</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-500/50"></span>
                <span>Highest Bid</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
