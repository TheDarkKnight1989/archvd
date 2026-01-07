/**
 * Market Page - V4 ONLY
 * Route: /portfolio/market/[slug]?itemId=xyz (itemId optional)
 *
 * Shows:
 * - Hero section with product image and details
 * - StockX stat card (GBP) - from inventory_v4_stockx_market_data
 * - Alias stat card (USD) - from inventory_v4_alias_market_data
 * - Your position block (if itemId provided) with P/L and listing buttons
 *
 * V4 Tables Used:
 * - inventory_v4_items (user items)
 * - inventory_v4_style_catalog (product metadata)
 * - inventory_v4_stockx_products / inventory_v4_stockx_variants / inventory_v4_stockx_market_data
 * - inventory_v4_alias_products / inventory_v4_alias_variants / inventory_v4_alias_market_data
 */

import { notFound } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { parseSkuFromSlug, validateSlug } from '@/lib/utils/slug'
import { Button } from '@/components/ui/button'
import { PlatformBadge } from '@/components/platform/PlatformBadge'
import { formatMoney } from '@/lib/format/money'
import { SyncStockxButton } from './_components/SyncStockxButton'

interface MarketPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ itemId?: string }>
}

interface V4InventoryWithPricing {
  id: string
  style_id: string
  size: string
  purchase_price: number
  purchase_date?: string | null
  brand?: string | null
  model?: string | null
  colorway?: string | null
  image_url?: string | null

  // StockX data (from V4 tables)
  stockx_lowest_ask?: number | null
  stockx_highest_bid?: number | null
  stockx_currency?: string | null
  stockx_last_synced_at?: string | null

  // Alias data (from V4 tables)
  alias_lowest_ask?: number | null
  alias_highest_bid?: number | null
  alias_last_sold?: number | null
  alias_currency?: string | null
  alias_last_synced_at?: string | null
}

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

async function getV4InventoryItem(itemId: string): Promise<V4InventoryWithPricing | null> {
  const supabase = await getSupabase()

  // Fetch V4 inventory item with style catalog join
  const { data: item, error } = await supabase
    .from('inventory_v4_items')
    .select(`
      id,
      style_id,
      size,
      purchase_price,
      purchase_date,
      inventory_v4_style_catalog (
        style_id,
        brand,
        name,
        colorway,
        primary_image_url,
        product_category
      )
    `)
    .eq('id', itemId)
    .single()

  if (error || !item) {
    console.error('[Market Page V4] Item not found:', error)
    return null
  }

  const style = (item as any).inventory_v4_style_catalog
  const styleId = item.style_id

  // Fetch StockX market data from V4
  let stockxData = null
  const { data: stockxVariant } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('variant_id, size_us')
    .eq('style_id', styleId)
    .eq('size_us', parseFloat(item.size) + 1) // UK to US conversion
    .maybeSingle()

  if (stockxVariant) {
    const { data: stockxMarket } = await supabase
      .from('inventory_v4_stockx_market_data')
      .select('lowest_ask, highest_bid, currency, recorded_at')
      .eq('variant_id', stockxVariant.variant_id)
      .eq('currency', 'GBP')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (stockxMarket) {
      stockxData = {
        lowest_ask: stockxMarket.lowest_ask,
        highest_bid: stockxMarket.highest_bid,
        currency: stockxMarket.currency,
        recorded_at: stockxMarket.recorded_at,
      }
    }
  }

  // Fetch Alias market data from V4
  let aliasData = null
  const { data: aliasVariant } = await supabase
    .from('inventory_v4_alias_variants')
    .select('variant_id, size_us')
    .eq('style_id', styleId)
    .eq('size_us', parseFloat(item.size) + 1) // UK to US conversion
    .maybeSingle()

  if (aliasVariant) {
    const { data: aliasMarket } = await supabase
      .from('inventory_v4_alias_market_data')
      .select('lowest_ask_cents, highest_bid_cents, last_sold_cents, currency, recorded_at')
      .eq('variant_id', aliasVariant.variant_id)
      .eq('currency', 'USD')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (aliasMarket) {
      aliasData = {
        lowest_ask: aliasMarket.lowest_ask_cents ? aliasMarket.lowest_ask_cents / 100 : null,
        highest_bid: aliasMarket.highest_bid_cents ? aliasMarket.highest_bid_cents / 100 : null,
        last_sold: aliasMarket.last_sold_cents ? aliasMarket.last_sold_cents / 100 : null,
        currency: aliasMarket.currency,
        recorded_at: aliasMarket.recorded_at,
      }
    }
  }

  return {
    id: item.id,
    style_id: item.style_id,
    size: item.size,
    purchase_price: item.purchase_price || 0,
    purchase_date: item.purchase_date,
    brand: style?.brand || null,
    model: style?.name || null,
    colorway: style?.colorway || null,
    image_url: style?.primary_image_url || null,
    stockx_lowest_ask: stockxData?.lowest_ask ?? null,
    stockx_highest_bid: stockxData?.highest_bid ?? null,
    stockx_currency: stockxData?.currency ?? null,
    stockx_last_synced_at: stockxData?.recorded_at ?? null,
    alias_lowest_ask: aliasData?.lowest_ask ?? null,
    alias_highest_bid: aliasData?.highest_bid ?? null,
    alias_last_sold: aliasData?.last_sold ?? null,
    alias_currency: aliasData?.currency ?? 'USD',
    alias_last_synced_at: aliasData?.recorded_at ?? null,
  }
}

async function getStyleCatalogBySku(sku: string) {
  const supabase = await getSupabase()

  const { data } = await supabase
    .from('inventory_v4_style_catalog')
    .select('*')
    .eq('style_id', sku.toUpperCase())
    .maybeSingle()

  return data
}

/**
 * V4 Size Run Variant
 */
interface V4SizeRunVariant {
  size_us: number
  stockx_ask: number | null
  stockx_bid: number | null
  alias_ask: number | null
  alias_bid: number | null
}

async function getV4CombinedSizeRun(styleId: string): Promise<V4SizeRunVariant[]> {
  const supabase = await getSupabase()
  const sizeMap = new Map<number, V4SizeRunVariant>()

  // Fetch StockX variants and market data
  const { data: stockxVariants } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('variant_id, size_us')
    .eq('style_id', styleId)

  if (stockxVariants) {
    for (const variant of stockxVariants) {
      const { data: market } = await supabase
        .from('inventory_v4_stockx_market_data')
        .select('lowest_ask, highest_bid')
        .eq('variant_id', variant.variant_id)
        .eq('currency', 'GBP')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const size = parseFloat(variant.size_us)
      if (!isNaN(size)) {
        sizeMap.set(size, {
          size_us: size,
          stockx_ask: market?.lowest_ask ?? null,
          stockx_bid: market?.highest_bid ?? null,
          alias_ask: null,
          alias_bid: null,
        })
      }
    }
  }

  // Fetch Alias variants and market data
  const { data: aliasVariants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('variant_id, size_us')
    .eq('style_id', styleId)

  if (aliasVariants) {
    for (const variant of aliasVariants) {
      const { data: market } = await supabase
        .from('inventory_v4_alias_market_data')
        .select('lowest_ask_cents, highest_bid_cents')
        .eq('variant_id', variant.variant_id)
        .eq('currency', 'USD')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const size = parseFloat(variant.size_us)
      if (!isNaN(size)) {
        const existing = sizeMap.get(size)
        if (existing) {
          existing.alias_ask = market?.lowest_ask_cents ? market.lowest_ask_cents / 100 : null
          existing.alias_bid = market?.highest_bid_cents ? market.highest_bid_cents / 100 : null
        } else {
          sizeMap.set(size, {
            size_us: size,
            stockx_ask: null,
            stockx_bid: null,
            alias_ask: market?.lowest_ask_cents ? market.lowest_ask_cents / 100 : null,
            alias_bid: market?.highest_bid_cents ? market.highest_bid_cents / 100 : null,
          })
        }
      }
    }
  }

  return Array.from(sizeMap.values()).sort((a, b) => a.size_us - b.size_us)
}

function formatTimeSince(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

export default async function MarketPage({ params, searchParams }: MarketPageProps) {
  const { slug } = await params
  const { itemId } = await searchParams

  // Validate slug format
  if (!validateSlug(slug)) {
    console.error(`[Market Page V4] Invalid slug format: ${slug}`)
    notFound()
  }

  // Parse SKU from slug
  const sku = parseSkuFromSlug(slug)
  if (!sku) {
    console.error(`[Market Page V4] Could not parse SKU from slug: ${slug}`)
    notFound()
  }

  // Look up in V4 style catalog
  const styleCatalog = await getStyleCatalogBySku(sku)

  if (!styleCatalog) {
    console.error(`[Market Page V4] Style not found in V4 catalog: ${sku}`)
    notFound()
  }

  // Fetch inventory item if itemId provided
  let inventoryItem: V4InventoryWithPricing | null = null
  if (itemId) {
    inventoryItem = await getV4InventoryItem(itemId)
  }

  // Fetch combined size run from V4
  const sizeRun = await getV4CombinedSizeRun(styleCatalog.style_id)

  // Calculate P/L if we have inventory data
  let plVsStockx: number | null = null
  let plVsAlias: number | null = null
  let plVsStockxPct: number | null = null
  let plVsAliasPct: number | null = null

  if (inventoryItem) {
    if (inventoryItem.stockx_lowest_ask) {
      plVsStockx = inventoryItem.stockx_lowest_ask - inventoryItem.purchase_price
      plVsStockxPct = inventoryItem.purchase_price > 0 ? (plVsStockx / inventoryItem.purchase_price) * 100 : null
    }
    if (inventoryItem.alias_lowest_ask) {
      plVsAlias = inventoryItem.alias_lowest_ask - inventoryItem.purchase_price
      plVsAliasPct = inventoryItem.purchase_price > 0 ? (plVsAlias / inventoryItem.purchase_price) * 100 : null
    }
  }

  const imageUrl = styleCatalog.primary_image_url || inventoryItem?.image_url

  return (
    <div className="container max-w-5xl py-6 space-y-8">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portfolio/inventory" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>
        </Button>

        <SyncStockxButton sku={styleCatalog.style_id} />
      </div>

      {/* Hero Section */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {imageUrl && (
          <div className="w-full md:w-64 h-64 bg-elev-1 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
            <img
              src={imageUrl}
              alt={styleCatalog.name}
              className="object-contain w-full h-full"
            />
          </div>
        )}

        <div className="flex-1 space-y-3">
          <h1 className="text-sm font-medium text-muted uppercase tracking-wide">
            Market View
          </h1>
          <h2 className="text-3xl font-bold text-fg">
            {styleCatalog.brand || ''} {styleCatalog.name}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className="font-mono bg-soft px-2 py-1 rounded">
              {styleCatalog.style_id}
            </span>
            {inventoryItem && (
              <span className="font-medium">
                UK {inventoryItem.size}
              </span>
            )}
          </div>

          {styleCatalog.colorway && (
            <p className="text-base text-fg font-semibold">
              {styleCatalog.colorway}
            </p>
          )}
        </div>
      </div>

      {/* Market Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* StockX Card */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-fg">StockX</h3>
            <PlatformBadge platform="stockx" size="sm" />
          </div>

          {!inventoryItem ? (
            <p className="text-sm text-muted">
              Add this item to your inventory to see StockX data for your size
            </p>
          ) : inventoryItem.stockx_lowest_ask || inventoryItem.stockx_highest_bid ? (
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted">Lowest Ask</span>
                <span className="text-2xl font-bold text-fg">
                  {inventoryItem.stockx_lowest_ask
                    ? formatMoney(inventoryItem.stockx_lowest_ask, inventoryItem.stockx_currency || 'GBP')
                    : '—'
                  }
                </span>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted">Highest Bid</span>
                <span className="text-lg font-medium text-fg">
                  {inventoryItem.stockx_highest_bid
                    ? formatMoney(inventoryItem.stockx_highest_bid, inventoryItem.stockx_currency || 'GBP')
                    : '—'
                  }
                </span>
              </div>

              {inventoryItem.stockx_last_synced_at && (
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Updated: {formatTimeSince(inventoryItem.stockx_last_synced_at)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">
              No StockX data available
            </p>
          )}
        </div>

        {/* Alias Card */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-fg">Alias</h3>
            <PlatformBadge platform="alias" size="sm" />
          </div>

          {!inventoryItem ? (
            <p className="text-sm text-muted">
              Add this item to your inventory to see pricing for your size
            </p>
          ) : inventoryItem.alias_lowest_ask || inventoryItem.alias_highest_bid ? (
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted">Lowest Ask</span>
                <span className="text-2xl font-bold text-fg">
                  {inventoryItem.alias_lowest_ask
                    ? formatMoney(inventoryItem.alias_lowest_ask, 'USD')
                    : '—'
                  }
                </span>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted">Highest Offer</span>
                <span className="text-lg font-medium text-fg">
                  {inventoryItem.alias_highest_bid
                    ? formatMoney(inventoryItem.alias_highest_bid, 'USD')
                    : '—'
                  }
                </span>
              </div>

              {inventoryItem.alias_last_sold && (
                <div className="flex justify-between items-baseline pt-2 border-t border-border">
                  <span className="text-sm text-muted">Last Sold</span>
                  <span className="text-sm font-medium text-muted">
                    {formatMoney(inventoryItem.alias_last_sold, 'USD')}
                  </span>
                </div>
              )}

              {inventoryItem.alias_last_synced_at && (
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Updated: {formatTimeSince(inventoryItem.alias_last_synced_at)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">
              No Alias data available
            </p>
          )}
        </div>
      </div>

      {/* Your Position Block */}
      {inventoryItem && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <h3 className="text-lg font-semibold text-fg">Your Position</h3>

          <div className="flex justify-between items-baseline pb-4 border-b border-border">
            <span className="text-sm text-muted">Purchase Price</span>
            <span className="text-xl font-semibold text-fg">
              {formatMoney(inventoryItem.purchase_price, 'GBP')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* StockX P/L */}
            <div className="bg-soft rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted">vs StockX</span>
                <PlatformBadge platform="stockx" size="xs" />
              </div>
              {plVsStockx !== null ? (
                <>
                  <div className={`text-2xl font-bold ${plVsStockx >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {plVsStockx >= 0 ? '+' : ''}{formatMoney(plVsStockx, 'GBP')}
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    {plVsStockx >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={plVsStockx >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {plVsStockxPct?.toFixed(1)}%
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">No StockX data</p>
              )}
            </div>

            {/* Alias P/L */}
            <div className="bg-soft rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted">vs Alias</span>
                <PlatformBadge platform="alias" size="xs" />
              </div>
              {plVsAlias !== null ? (
                <>
                  <div className={`text-2xl font-bold ${plVsAlias >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {plVsAlias >= 0 ? '+' : ''}{formatMoney(plVsAlias, 'USD')}
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    {plVsAlias >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={plVsAlias >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {plVsAliasPct?.toFixed(1)}%
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">No Alias data</p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
            <Button className="flex-1" variant="default">
              List on StockX
            </Button>
            <Button className="flex-1" variant="default">
              List on Alias
            </Button>
          </div>
        </div>
      )}

      {/* Size Run Table */}
      {sizeRun.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-fg">All Sizes</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted">US Size</th>
                  <th className="text-right py-2 px-3 font-medium text-muted">StockX Ask</th>
                  <th className="text-right py-2 px-3 font-medium text-muted">StockX Bid</th>
                  <th className="text-right py-2 px-3 font-medium text-muted">Alias Ask</th>
                  <th className="text-right py-2 px-3 font-medium text-muted">Alias Bid</th>
                </tr>
              </thead>
              <tbody>
                {sizeRun.map((variant) => {
                  const isUserSize = inventoryItem && parseFloat(inventoryItem.size) + 1 === variant.size_us
                  return (
                    <tr
                      key={variant.size_us}
                      className={`border-b border-border/50 ${isUserSize ? 'bg-soft font-semibold' : ''}`}
                    >
                      <td className="py-2 px-3">{variant.size_us}</td>
                      <td className="text-right py-2 px-3">
                        {variant.stockx_ask ? formatMoney(variant.stockx_ask, 'GBP') : '—'}
                      </td>
                      <td className="text-right py-2 px-3">
                        {variant.stockx_bid ? formatMoney(variant.stockx_bid, 'GBP') : '—'}
                      </td>
                      <td className="text-right py-2 px-3">
                        {variant.alias_ask ? formatMoney(variant.alias_ask, 'USD') : '—'}
                      </td>
                      <td className="text-right py-2 px-3">
                        {variant.alias_bid ? formatMoney(variant.alias_bid, 'USD') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sku = parseSkuFromSlug(slug)

  if (!sku) {
    return { title: 'Product Not Found' }
  }

  const styleCatalog = await getStyleCatalogBySku(sku)

  if (!styleCatalog) {
    return { title: 'Product Not Found' }
  }

  return {
    title: `${styleCatalog.name} - Market View`,
    description: `View market data and pricing for ${styleCatalog.name}${styleCatalog.brand ? ` by ${styleCatalog.brand}` : ''}`,
  }
}
