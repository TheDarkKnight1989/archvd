/**
 * Market Page v1 - SKU-based Product Market View
 * Route: /portfolio/market/[slug]?itemId=xyz (itemId optional)
 *
 * Shows:
 * - Hero section with product image and details
 * - StockX stat card (GBP) - KEYED ON ITEMID ONLY, uses same data source as inventory table
 * - Alias stat card (USD)
 * - Your position block (if itemId provided) with P/L and listing buttons
 *
 * IMPORTANT: StockX card behavior
 * - Does NOT use slug to find data
 * - If itemId is present:
 *   1. Look up inventory row by itemId
 *   2. Use existing StockX mapping from inventory_market_links
 *   3. Pull prices from stockx_market_latest (same table as inventory table)
 *   4. Show lowest ask, highest bid, last sold in GBP
 * - If no StockX mapping OR no market snapshot: show "No StockX data"
 * - If itemId is missing: show "Link this product to inventory to see StockX data"
 */

import { notFound } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { getCatalogItemBySlug } from '@/lib/services/alias/catalog'
import { parseSkuFromSlug, validateSlug } from '@/lib/utils/slug'
import { Button } from '@/components/ui/button'
import { PlatformBadge } from '@/components/platform/PlatformBadge'
import { formatMoney } from '@/lib/format/money'
import { createAliasClient } from '@/lib/services/alias/client'
import { listAvailabilitiesForCatalog, type AliasAvailabilityVariant } from '@/lib/services/alias/pricing'
import { SizeRunComparisonTable } from './_components/SizeRunComparisonTable'
import { SyncStockxButton } from './_components/SyncStockxButton'
import { CollapsibleSection } from './_components/CollapsibleSection'

interface MarketPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ itemId?: string }>
}

interface InventoryWithPricing {
  id: string
  sku: string
  brand: string
  model: string
  colorway?: string | null
  size_uk: string
  purchase_price: number
  purchase_date?: string | null

  // StockX data
  stockx_lowest_ask?: number | null
  stockx_highest_bid?: number | null
  stockx_last_sale?: number | null
  stockx_currency?: string | null
  stockx_last_synced_at?: string | null

  // Alias data
  alias_lowest_ask?: number | null
  alias_highest_bid?: number | null
  alias_last_sold?: number | null
  alias_currency?: string | null

  // Image data
  image_url?: string | null
  stockx_image_url?: string | null
  alias_image_url?: string | null
}

async function getInventoryItem(itemId: string): Promise<InventoryWithPricing | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
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

  // Fetch inventory item
  const { data: item, error } = await supabase
    .from('Inventory')
    .select(`
      id,
      sku,
      brand,
      model,
      colorway,
      size_uk,
      purchase_price,
      purchase_date,
      image_url
    `)
    .eq('id', itemId)
    .single()

  if (error || !item) {
    console.error('[Market Page] Failed to fetch inventory item:', error)
    return null
  }

  // ============================================================================
  // STOCKX DATA (keyed on itemId only, NOT slug)
  // IMPORTANT: Uses same data source as inventory table (stockx_market_latest)
  // This ensures market page StockX prices ALWAYS match inventory table prices
  // ============================================================================

  console.log('[Market Page DEBUG] Looking up StockX mapping for itemId:', itemId)

  // Fetch StockX mapping (same as useInventoryV3)
  const { data: stockxMapping, error: stockxMappingError } = await supabase
    .from('inventory_market_links')
    .select('item_id, stockx_product_id, stockx_variant_id, stockx_listing_id, mapping_status, last_sync_success_at')
    .eq('item_id', itemId)
    .maybeSingle()

  console.log('[Market Page DEBUG] StockX mapping query result:', {
    itemId,
    found: !!stockxMapping,
    mapping: stockxMapping,
    error: stockxMappingError,
  })

  // Fetch StockX market data from stockx_market_latest (same table as inventory table)
  let stockxData = null
  if (stockxMapping?.stockx_product_id && stockxMapping?.stockx_variant_id) {
    // Fetch ALL currency snapshots for this product/variant (same as useInventoryV3)
    // NOTE: last_sale column was removed in migration 20251120_remove_last_sale_price.sql
    const { data: stockxPrices, error: stockxPriceError } = await supabase
      .from('stockx_market_latest')
      .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid, snapshot_at')
      .eq('stockx_product_id', stockxMapping.stockx_product_id)
      .eq('stockx_variant_id', stockxMapping.stockx_variant_id)

    console.log('[Market Page DEBUG] StockX prices fetched:', {
      productId: stockxMapping.stockx_product_id,
      variantId: stockxMapping.stockx_variant_id,
      found: stockxPrices?.length || 0,
      currencies: stockxPrices?.map(p => p.currency_code) || [],
      prices: stockxPrices,
      error: stockxPriceError,
      errorCode: stockxPriceError?.code,
      errorMessage: stockxPriceError?.message,
      errorDetails: stockxPriceError?.details,
      errorHint: stockxPriceError?.hint,
    })

    // TEMPORARY: Check if data exists in stockx_products table instead
    const { data: legacyPrice, error: legacyError } = await supabase
      .from('stockx_products')
      .select('stockx_product_id, lowest_ask, highest_bid, last_sale, currency, image_url')
      .eq('stockx_product_id', stockxMapping.stockx_product_id)
      .maybeSingle()

    console.log('[Market Page DEBUG] Legacy stockx_products check:', {
      found: !!legacyPrice,
      price: legacyPrice,
      error: legacyError,
    })

    // Apply currency fallback logic (same as useInventoryV3)
    // Priority: GBP -> USD -> EUR
    let stockxPrice = null
    let selectedCurrency = null

    if (stockxPrices && stockxPrices.length > 0) {
      // Try GBP first
      stockxPrice = stockxPrices.find(p => p.currency_code === 'GBP')
      if (stockxPrice) {
        selectedCurrency = 'GBP'
      } else {
        // Fallback to USD, then EUR
        const fallbackOrder = ['USD', 'EUR']
        for (const currency of fallbackOrder) {
          stockxPrice = stockxPrices.find(p => p.currency_code === currency)
          if (stockxPrice) {
            selectedCurrency = currency
            break
          }
        }
      }
    }

    if (stockxPrice) {
      // NOTE: All prices in stockx_market_latest are stored in major units (same as useInventoryV3)
      stockxData = {
        lowest_ask: stockxPrice.lowest_ask,
        highest_bid: stockxPrice.highest_bid,
        last_sale: null, // Removed in migration 20251120_remove_last_sale_price.sql
        currency: stockxPrice.currency_code,
        snapshot_at: stockxPrice.snapshot_at,
      }

      console.log('[Market Page] ✅ StockX data found for itemId:', itemId, {
        productId: stockxMapping.stockx_product_id,
        variantId: stockxMapping.stockx_variant_id,
        lowestAsk: stockxData.lowest_ask,
        highestBid: stockxData.highest_bid,
        currency: stockxData.currency,
        selectedCurrency,
      })
    } else {
      console.log('[Market Page] ❌ No price data in stockx_market_latest for:', {
        productId: stockxMapping.stockx_product_id,
        variantId: stockxMapping.stockx_variant_id,
        availableCurrencies: stockxPrices?.map(p => p.currency_code) || [],
      })
    }

    // Fetch StockX product image from catalog
    const { data: stockxProduct } = await supabase
      .from('stockx_products')
      .select('image_url')
      .eq('stockx_product_id', stockxMapping.stockx_product_id)
      .maybeSingle()

    if (stockxProduct && stockxData) {
      stockxData = {
        ...stockxData,
        image_url: stockxProduct.image_url,
      }
    }
  } else {
    console.log('[Market Page] ❌ No StockX mapping found for itemId:', itemId, {
      mappingExists: !!stockxMapping,
      hasProductId: !!stockxMapping?.stockx_product_id,
      hasVariantId: !!stockxMapping?.stockx_variant_id,
    })
  }

  // Fetch Alias market data for this specific size
  const sizeUk = parseFloat(item.size_uk)
  const usSize = sizeUk + 1 // Convert UK to US

  const { data: aliasLink } = await supabase
    .from('inventory_alias_links')
    .select('alias_catalog_id')
    .eq('inventory_id', itemId)
    .maybeSingle()

  let aliasCatalogId = aliasLink?.alias_catalog_id

  // If no link exists, try to find Alias catalog by SKU match
  if (!aliasCatalogId && item.sku) {
    console.log('[Market Page] No Alias link, searching by SKU:', item.sku)

    const { data: aliasCatalog } = await supabase
      .from('alias_catalog_items')
      .select('catalog_id, image_url')
      .eq('sku', item.sku.toUpperCase().replace(/[-\s]/g, ' ').trim())
      .maybeSingle()

    if (aliasCatalog) {
      console.log('[Market Page] Found Alias catalog by SKU:', aliasCatalog.catalog_id)
      aliasCatalogId = aliasCatalog.catalog_id
      ;(item as any).alias_image_url = aliasCatalog.image_url
    }
  }

  let aliasData = null
  if (aliasCatalogId) {
    const { data: snapshot } = await supabase
      .from('alias_market_snapshots')
      .select('*')
      .eq('catalog_id', aliasCatalogId)
      .eq('size', usSize)
      .eq('currency', 'USD')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (snapshot) {
      aliasData = {
        lowest_ask: snapshot.lowest_ask_cents ? snapshot.lowest_ask_cents / 100 : null,
        highest_bid: snapshot.highest_bid_cents ? snapshot.highest_bid_cents / 100 : null,
        last_sold: snapshot.last_sold_price_cents ? snapshot.last_sold_price_cents / 100 : null,
        currency: 'USD',
      }
    }

    // Fetch Alias catalog image if we don't already have it
    if (!(item as any).alias_image_url) {
      const { data: aliasCatalog } = await supabase
        .from('alias_catalog_items')
        .select('image_url')
        .eq('catalog_id', aliasCatalogId)
        .maybeSingle()

      if (aliasCatalog) {
        ;(item as any).alias_image_url = aliasCatalog.image_url
      }
    }
  }

  return {
    ...item,
    stockx_lowest_ask: stockxData?.lowest_ask ?? null,
    stockx_highest_bid: stockxData?.highest_bid ?? null,
    stockx_last_sale: stockxData?.last_sale ?? null,
    stockx_currency: stockxData?.currency ?? null,
    stockx_image_url: stockxData?.image_url ?? null,
    stockx_last_synced_at: stockxMapping?.last_sync_success_at ?? null,
    alias_lowest_ask: aliasData?.lowest_ask ?? null,
    alias_highest_bid: aliasData?.highest_bid ?? null,
    alias_last_sold: aliasData?.last_sold ?? null,
    alias_currency: aliasData?.currency ?? null,
  }
}

/**
 * Fetch Alias size run availabilities for a catalog item
 * Tries to use catalog_id first, then falls back to SKU lookup
 * Returns null if neither is available or if there's an error
 */
async function getAliasSizeRunPricing(
  catalogId: string | null,
  sku?: string | null
): Promise<AliasAvailabilityVariant[] | null> {
  let targetCatalogId = catalogId

  // If no catalog_id provided, try to find by SKU
  if (!targetCatalogId && sku) {
    console.log('[Market Page] No Alias catalog_id, searching by SKU for size run:', sku)

    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const { data: aliasCatalog } = await supabase
      .from('alias_catalog_items')
      .select('catalog_id')
      .eq('sku', sku.toUpperCase().replace(/[-\s]/g, ' ').trim())
      .maybeSingle()

    if (aliasCatalog) {
      console.log('[Market Page] Found Alias catalog by SKU for size run:', aliasCatalog.catalog_id)
      targetCatalogId = aliasCatalog.catalog_id
    }
  }

  if (!targetCatalogId) {
    console.log('[Market Page] No Alias catalog_id available for size run')
    return null;
  }

  try {
    const client = createAliasClient();
    const availabilities = await listAvailabilitiesForCatalog(client, targetCatalogId);

    // Sort by size ascending
    return availabilities.sort((a, b) => a.size - b.size);
  } catch (error) {
    console.error('[Market Page] Error fetching Alias size run pricing:', error);
    return null;
  }
}

/**
 * StockX size run variant
 */
interface StockXSizeRunVariant {
  size: number // US size
  lowestAsk: number | null // GBP
  highestBid: number | null // GBP
}

/**
 * Fetch StockX size run for all sizes of a product
 * Uses stockx_market_latest table joined with stockx_variants for size info
 * Filters to GBP currency
 */
async function getStockXSizeRunPricing(
  stockxProductId: string | null
): Promise<StockXSizeRunVariant[] | null> {
  if (!stockxProductId) {
    return null;
  }

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    // Fetch all variants for this product in GBP
    // Join with stockx_variants to get size information
    const { data: variants, error } = await supabase
      .from('stockx_market_latest')
      .select(`
        stockx_variant_id,
        currency_code,
        lowest_ask,
        highest_bid,
        stockx_variants!inner(variant_value)
      `)
      .eq('stockx_product_id', stockxProductId)
      .eq('currency_code', 'GBP')

    if (error) {
      console.error('[Market Page] Error fetching StockX size run:', error)
      return null
    }

    if (!variants || variants.length === 0) {
      console.log('[Market Page] No StockX variants found for product:', stockxProductId)
      return null
    }

    console.log(`[Market Page] Found ${variants.length} StockX variants (GBP) for product:`, stockxProductId)

    // Transform to simplified format
    // variant_value is a string like "10.5" (US size)
    const sizeRun: StockXSizeRunVariant[] = variants
      .filter((v: any) => v.stockx_variants?.variant_value)
      .map((v: any) => {
        // Parse size from variant_value (e.g., "10.5" -> 10.5)
        const sizeStr = v.stockx_variants.variant_value
        const size = parseFloat(sizeStr)

        // Skip if size is NaN (e.g., non-numeric sizes like "M", "OS")
        if (isNaN(size)) {
          return null
        }

        return {
          size,
          lowestAsk: v.lowest_ask,
          highestBid: v.highest_bid,
        }
      })
      .filter((v): v is StockXSizeRunVariant => v !== null)
      .sort((a, b) => a.size - b.size) // Sort by size ascending

    console.log(`[Market Page] Returning ${sizeRun.length} StockX variants with valid numeric sizes`)

    return sizeRun
  } catch (error) {
    console.error('[Market Page] Error fetching StockX size run pricing:', error)
    return null
  }
}

/**
 * Combined size run variant
 */
interface CombinedSizeRunVariant {
  size: number // US size
  stockxAsk: number | null // GBP
  stockxBid: number | null // GBP
  aliasAsk: number | null // USD
  aliasBid: number | null // USD
  average: number | null // GBP (simple midpoint helper)
}

/**
 * Fetch and merge StockX + Alias size run data
 * Returns a unified list of sizes with data from both platforms
 */
async function getCombinedSizeRunPricing(
  stockxProductId: string | null,
  aliasCatalogId: string | null,
  sku?: string | null
): Promise<CombinedSizeRunVariant[] | null> {
  // Fetch both in parallel
  const [stockxData, aliasData] = await Promise.all([
    getStockXSizeRunPricing(stockxProductId),
    getAliasSizeRunPricing(aliasCatalogId, sku),
  ])

  // If both are null, return null
  if (!stockxData && !aliasData) {
    return null
  }

  // Build a unified size index
  const sizeMap = new Map<number, CombinedSizeRunVariant>()

  // Add StockX data
  if (stockxData) {
    for (const variant of stockxData) {
      sizeMap.set(variant.size, {
        size: variant.size,
        stockxAsk: variant.lowestAsk,
        stockxBid: variant.highestBid,
        aliasAsk: null,
        aliasBid: null,
        average: null,
      })
    }
  }

  // Add/merge Alias data
  if (aliasData) {
    for (const variant of aliasData) {
      const existing = sizeMap.get(variant.size)
      if (existing) {
        // Merge with existing StockX data
        existing.aliasAsk = variant.lowestAskCents ? variant.lowestAskCents / 100 : null
        existing.aliasBid = variant.highestBidCents ? variant.highestBidCents / 100 : null
      } else {
        // Create new entry for Alias-only size
        sizeMap.set(variant.size, {
          size: variant.size,
          stockxAsk: null,
          stockxBid: null,
          aliasAsk: variant.lowestAskCents ? variant.lowestAskCents / 100 : null,
          aliasBid: variant.highestBidCents ? variant.highestBidCents / 100 : null,
          average: null,
        })
      }
    }
  }

  // Calculate average (simple midpoint of best visible bids in GBP)
  // For simplicity, just use StockX bid if available (avoid FX complexity)
  for (const variant of sizeMap.values()) {
    const bids = [variant.stockxBid, variant.aliasBid].filter(b => b !== null) as number[]
    if (bids.length > 0) {
      // For now, just use StockX bid as the average (simplest approach)
      variant.average = variant.stockxBid
    }
  }

  // Convert to sorted array
  const combined = Array.from(sizeMap.values()).sort((a, b) => a.size - b.size)

  console.log(`[Market Page] Combined size run: ${combined.length} sizes (StockX: ${stockxData?.length || 0}, Alias: ${aliasData?.length || 0})`)

  return combined
}

export default async function MarketPage({ params, searchParams }: MarketPageProps) {
  const { slug } = await params
  const { itemId } = await searchParams

  // Validate slug format
  if (!validateSlug(slug)) {
    console.error(`[Market Page] Invalid slug format: ${slug}`)
    notFound()
  }

  // Look up catalog item by slug
  let catalogItem = await getCatalogItemBySlug(slug)

  // If not found by slug, try looking up by SKU
  if (!catalogItem) {
    const sku = parseSkuFromSlug(slug)
    if (!sku) {
      console.error(`[Market Page] Could not parse SKU from slug: ${slug}`)
      notFound()
    }

    console.log(`[Market Page] No catalog item found for slug: ${slug}, trying SKU: ${sku}`)

    // Try to find by SKU instead
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    // Normalize SKU for matching (remove hyphens and spaces, make lowercase)
    const normalizedSku = sku.replace(/[-\s]/g, '').toLowerCase()

    // Get all catalog items and find by normalized SKU match
    // Try Alias catalog first
    const { data: allCatalog } = await supabase
      .from('alias_catalog_items')
      .select('*')

    const catalogBySku = allCatalog?.find((item) => {
      const itemSku = (item.sku || '').replace(/[-\s]/g, '').toLowerCase()
      return itemSku === normalizedSku
    })

    if (catalogBySku) {
      console.log(`[Market Page] Found catalog item in alias_catalog_items by SKU: ${catalogBySku.sku}`)
      catalogItem = catalogBySku as any
    } else {
      // Fallback: Check product_catalog for StockX products
      console.log(`[Market Page] Not found in alias_catalog_items, checking product_catalog...`)
      const { data: productCatalog } = await supabase
        .from('product_catalog')
        .select('*')

      const productBySku = productCatalog?.find((item) => {
        const itemSku = (item.sku || '').replace(/[-\s]/g, '').toLowerCase()
        return itemSku === normalizedSku
      })

      if (productBySku) {
        console.log(`[Market Page] Found catalog item in product_catalog by SKU: ${productBySku.sku}`)
        catalogItem = productBySku as any
      } else {
        // Final fallback: Check stockx_products directly
        console.log(`[Market Page] Not found in product_catalog, checking stockx_products...`)
        const { data: stockxProduct } = await supabase
          .from('stockx_products')
          .select('*')

        const stockxBySku = stockxProduct?.find((item) => {
          const itemSku = (item.style_id || '').replace(/[-\s]/g, '').toLowerCase()
          return itemSku === normalizedSku
        })

        if (stockxBySku) {
          console.log(`[Market Page] Found product in stockx_products by style_id: ${stockxBySku.style_id}`)
          // Map stockx_products schema to expected catalogItem format
          catalogItem = {
            id: stockxBySku.id,
            sku: stockxBySku.style_id,
            brand: stockxBySku.brand,
            model: stockxBySku.title,
            name: stockxBySku.title,
            product_type: 'sneakers',
            stockx_product_id: stockxBySku.stockx_product_id,
            created_at: stockxBySku.created_at,
            updated_at: stockxBySku.updated_at,
          } as any
        } else {
          // STABILISATION MODE: Auto-heal disabled
          // Product must exist in catalog before accessing market page
          console.error(`[Market Page] ❌ No catalog item found for SKU: ${sku}`)
          console.error(`[Market Page] Checked: alias_catalog_items, product_catalog, stockx_products`)
          console.error(`[Market Page] Auto-heal is disabled. Product must be added via Add Item flow first.`)
          notFound()
        }
      }
    }
  }

  // Optionally fetch user's inventory position
  let inventoryItem: InventoryWithPricing | null = null
  if (itemId) {
    inventoryItem = await getInventoryItem(itemId)
  }

  // STABILISATION MODE: NO auto-refresh logic
  // Market page uses ONLY DB - no StockX API calls
  // Data is refreshed via manual sync button or background jobs (outside this page)

  // Fetch StockX product ID for size run
  // Try to find by itemId first, then by SKU match
  let stockxProductId: string | null = null

  const cookieStore = await cookies()
  const supabase = createServerClient(
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

  if (itemId) {
    // Look up by inventory item mapping
    const { data: mapping } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id')
      .eq('item_id', itemId)
      .maybeSingle()

    stockxProductId = mapping?.stockx_product_id || null
  }

  // If no itemId or no mapping found, try to find StockX product by SKU/styleId match
  if (!stockxProductId && catalogItem?.sku) {
    console.log('[Market Page] No itemId mapping, looking up StockX product by SKU:', catalogItem.sku)

    const { data: stockxProduct } = await supabase
      .from('stockx_products')
      .select('stockx_product_id')
      .eq('style_id', catalogItem.sku.toUpperCase().replace(/[-\s]/g, ' ').trim())
      .maybeSingle()

    if (stockxProduct) {
      console.log('[Market Page] Found StockX product by SKU match:', stockxProduct.stockx_product_id)
      stockxProductId = stockxProduct.stockx_product_id
    } else {
      console.log('[Market Page] No StockX product found for SKU:', catalogItem.sku)
    }
  }

  // Fetch combined StockX + Alias size run pricing
  // Note: This queries stockx_market_latest view (DB only, no API calls)
  const combinedSizeRunPricing = await getCombinedSizeRunPricing(
    stockxProductId,
    catalogItem?.catalog_id,
    catalogItem?.sku
  )

  // PHASE 2.4: Fetch debug info for StockX variant and snapshot counts
  let stockxVariantCount = 0
  let stockxSnapshotCount = 0

  if (stockxProductId) {
    // Count variants for this product
    const { count: variantCount } = await supabase
      .from('stockx_variants')
      .select('*', { count: 'exact', head: true })
      .eq('stockx_product_id', stockxProductId)

    stockxVariantCount = variantCount || 0

    // Count snapshots for this product (GBP currency)
    const { count: snapshotCount } = await supabase
      .from('stockx_market_latest')
      .select('*', { count: 'exact', head: true })
      .eq('stockx_product_id', stockxProductId)
      .eq('currency_code', 'GBP')

    stockxSnapshotCount = snapshotCount || 0
  }

  // Determine which image to show (Alias first, then catalog, then StockX)
  const imageUrl =
    inventoryItem?.alias_image_url ||
    catalogItem?.image_url ||
    inventoryItem?.stockx_image_url ||
    inventoryItem?.image_url ||
    null

  // Calculate P/L if we have inventory data
  let plVsStockx: number | null = null
  let plVsAlias: number | null = null
  let plVsStockxPct: number | null = null
  let plVsAliasPct: number | null = null

  if (inventoryItem) {
    if (inventoryItem.stockx_lowest_ask) {
      plVsStockx = inventoryItem.stockx_lowest_ask - inventoryItem.purchase_price
      plVsStockxPct = (plVsStockx / inventoryItem.purchase_price) * 100
    }
    if (inventoryItem.alias_lowest_ask) {
      plVsAlias = inventoryItem.alias_lowest_ask - inventoryItem.purchase_price
      plVsAliasPct = (plVsAlias / inventoryItem.purchase_price) * 100
    }
  }

  return (
    <div className="container max-w-5xl py-6 space-y-8">
      {/* DEBUG HEADING - Commented out for production UX */}
      {/* <div className="bg-red-500 text-white p-4 rounded-lg font-bold text-xl">
        🔍 MARKET PAGE DEBUG – slug: {slug} – itemId: {itemId || 'none'}
      </div> */}

      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portfolio/inventory" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>
        </Button>

        {/* PHASE 3: Manual Sync Button */}
        {stockxProductId && (
          <SyncStockxButton stockxProductId={stockxProductId} />
        )}
      </div>

      {/* Hero Section */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Product Image */}
        {imageUrl && (
          <div className="w-full md:w-64 h-64 bg-elev-1 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
            <img
              src={imageUrl}
              alt={catalogItem?.product_name}
              className="object-contain w-full h-full"
            />
          </div>
        )}

        {/* Product Details */}
        <div className="flex-1 space-y-3">
          <h1 className="text-sm font-medium text-muted uppercase tracking-wide">
            Market View
          </h1>
          <h2 className="text-3xl font-bold text-fg">
            {catalogItem?.brand || ''} {catalogItem?.product_name}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            {catalogItem?.sku && (
              <span className="font-mono bg-soft px-2 py-1 rounded">
                {catalogItem.sku.toUpperCase()}
              </span>
            )}
            {inventoryItem && (
              <span className="font-medium">
                UK {inventoryItem.size_uk}
              </span>
            )}
          </div>

          {catalogItem?.colorway && (
            <p className="text-base text-fg font-semibold">
              {catalogItem.colorway}
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
              Link this product to inventory to see StockX data
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

              {inventoryItem.stockx_last_sale && (
                <div className="flex justify-between items-baseline pt-2 border-t border-border">
                  <span className="text-sm text-muted">Last Sold</span>
                  <span className="text-sm font-medium text-muted">
                    {formatMoney(inventoryItem.stockx_last_sale, inventoryItem.stockx_currency || 'GBP')}
                  </span>
                </div>
              )}

              {/* Last Synced Timestamp */}
              {inventoryItem.stockx_last_synced_at && (
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Last synced:</span>
                    <span className="font-medium mono">
                      {(() => {
                        const date = new Date(inventoryItem.stockx_last_synced_at)
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
                          year: 'numeric',
                        })
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">
              No StockX data
            </p>
          )}
        </div>

        {/* Alias Card */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-fg">Alias</h3>
            <PlatformBadge platform="alias" size="sm" />
          </div>

          {inventoryItem ? (
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
            </div>
          ) : (
            <p className="text-sm text-muted">
              Add this item to your inventory to see pricing for your size
            </p>
          )}
        </div>
      </div>

      {/* Your Position Block (only if inventory item provided) - MOVED UP FOR BETTER UX */}
      {inventoryItem && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <h3 className="text-lg font-semibold text-fg">Your Position</h3>

          {/* Purchase Price */}
          <div className="flex justify-between items-baseline pb-4 border-b border-border">
            <span className="text-sm text-muted">Purchase Price</span>
            <span className="text-xl font-semibold text-fg">
              {formatMoney(inventoryItem.purchase_price, 'GBP')}
            </span>
          </div>

          {/* P/L Grid */}
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

          {/* Listing Actions */}
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

      {/* Size Run Comparison Table - Collapsible for better UX */}
      {combinedSizeRunPricing && combinedSizeRunPricing.length > 0 && (
        <CollapsibleSection title="All Sizes - Market Data Comparison" defaultOpen={false}>
          <div className="space-y-2">
            <SizeRunComparisonTable
              variants={combinedSizeRunPricing}
              userSizeUS={inventoryItem ? parseFloat(inventoryItem.size_uk) + 1 : null}
            />

            {/* Debug info showing variant and snapshot counts */}
            {stockxProductId && (
              <div className="text-xs text-muted text-right px-4 py-2 bg-soft rounded-lg">
                StockX variants: {stockxVariantCount}, market snapshots: {stockxSnapshotCount} (GBP)
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

/**
 * Generate metadata for the page
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const catalogItem = await getCatalogItemBySlug(slug)

  if (!catalogItem) {
    return {
      title: 'Product Not Found',
    }
  }

  return {
    title: `${catalogItem.product_name} - Market View`,
    description: `View market data and pricing for ${catalogItem.product_name}${catalogItem.brand ? ` by ${catalogItem.brand}` : ''}`,
  }
}
