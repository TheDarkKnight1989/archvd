import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { StockxCatalogService } from '@/lib/services/stockx/catalog'
import { syncSingleInventoryItemFromStockx, refreshStockxMarketLatestView } from '@/lib/providers/stockx-worker'
import { findVariantBySize } from '@/lib/stockx/findVariantBySize'

/**
 * POST /api/stockx/map-item
 *
 * Attempts to map an inventory item to StockX product/variant
 * Uses SKU + size to search StockX catalog
 *
 * Request body: { itemId: string }
 *
 * Response:
 * - 200: { success: true, productId, variantId }
 * - 404: { code: 'NOT_FOUND', message: '...' }
 * - 400: { code: 'AMBIGUOUS_MATCH', message: '...', matches: [...] }
 * - 400: { code: 'NO_SIZE_MATCH', message: '...', availableSizes: [...] }
 */
export async function POST(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { itemId } = body

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    }

    console.log('[StockX Map Item] Mapping item:', { itemId, userId: user.id })

    // 1. Fetch inventory item (with RLS check)
    const { data: item, error: itemError } = await supabase
      .from('Inventory')
      .select('id, sku, size, size_uk, brand, model')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single()

    if (itemError || !item) {
      console.error('[StockX Map Item] Item not found:', itemError)
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Inventory item not found' },
        { status: 404 }
      )
    }

    console.log('[StockX Map Item] Found item:', {
      sku: item.sku,
      size: item.size_uk || item.size,
      brand: item.brand,
      model: item.model,
    })

    // 2. Search StockX for product by SKU
    const catalogService = new StockxCatalogService(user.id)
    const searchResults = await catalogService.searchProducts(item.sku, { limit: 5 })

    if (searchResults.length === 0) {
      console.warn('[StockX Map Item] No products found for SKU:', item.sku)
      return NextResponse.json(
        {
          code: 'NOT_FOUND',
          message: `No StockX products found for SKU "${item.sku}". The product may not exist on StockX.`,
        },
        { status: 404 }
      )
    }

    console.log('[StockX Map Item] Found products:', searchResults.map(p => ({
      productId: p.productId,
      styleId: p.styleId,
      title: p.productName,
    })))

    // 3. Check for exact SKU match
    const exactMatches = searchResults.filter(
      p => p.styleId.toLowerCase() === item.sku.toLowerCase()
    )

    let selectedProduct
    if (exactMatches.length === 1) {
      selectedProduct = exactMatches[0]
      console.log('[StockX Map Item] Found exact SKU match:', selectedProduct.productId)
    } else if (exactMatches.length > 1) {
      console.warn('[StockX Map Item] Multiple exact matches found')
      return NextResponse.json(
        {
          code: 'AMBIGUOUS_MATCH',
          message: `Multiple StockX products found with SKU "${item.sku}". Cannot automatically determine the correct match.`,
          matches: exactMatches.map(p => ({
            productId: p.productId,
            styleId: p.styleId,
            title: p.productName,
          })),
        },
        { status: 400 }
      )
    } else {
      // No exact SKU matches found - refuse to map
      // FIX: Removed dangerous fallback that accepted non-matching products
      console.warn('[StockX Map Item] No exact SKU match found')
      return NextResponse.json(
        {
          code: 'NO_EXACT_MATCH',
          message: `Found ${searchResults.length} StockX product(s) for search term "${item.sku}", but none have an exact SKU match. Cannot automatically map without exact match.`,
          matches: searchResults.map(p => ({
            productId: p.productId,
            styleId: p.styleId,
            title: p.productName,
          })),
        },
        { status: 400 }
      )
    }

    // 4. Fetch variants for the selected product
    const variants = await catalogService.getProductVariants(selectedProduct.productId)

    if (variants.length === 0) {
      console.warn('[StockX Map Item] No variants found for product:', selectedProduct.productId)
      return NextResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Product found but has no size variants available.`,
        },
        { status: 404 }
      )
    }

    console.log('[StockX Map Item] Found variants:', variants.map(v => ({
      variantId: v.variantId,
      size: v.variantValue,
      sizeChart: v.sizeChart,
    })))

    // 5. Match variant by size using StockX's sizeChart metadata
    const targetSize = item.size_uk || item.size
    const assumedSizeSystem = item.size_uk ? 'UK' : 'US' // Assume size_uk field contains UK sizes

    console.log('[StockX Map Item] Matching size:', {
      targetSize,
      assumedSizeSystem,
      variantsWithSizeChart: variants.filter(v => v.sizeChart).length,
      brand: selectedProduct.brand,
      title: selectedProduct.productName,
    })

    const matchingVariant = findVariantBySize(
      targetSize,
      assumedSizeSystem,
      variants,
      selectedProduct.brand,
      selectedProduct.productName
    )

    if (!matchingVariant) {
      console.warn('[StockX Map Item] No size match:', {
        targetSize,
        assumedSizeSystem,
        availableSizes: variants.map(v => ({
          value: v.variantValue,
          displayOptions: v.sizeChart?.displayOptions || [],
        })),
      })
      return NextResponse.json(
        {
          code: 'NO_SIZE_MATCH',
          message: `Product found but size "${targetSize}" (${assumedSizeSystem}) is not available.`,
          availableSizes: variants.map(v => v.variantValue).sort(),
          sizeChartInfo: variants.slice(0, 3).map(v => ({
            variantValue: v.variantValue,
            displayOptions: v.sizeChart?.displayOptions || [],
          })),
        },
        { status: 400 }
      )
    }

    console.log('[StockX Map Item] Found matching variant:', {
      variantId: matchingVariant.variantId,
      size: matchingVariant.variantValue,
    })

    // 6. Create inventory_market_links entry
    const serviceSupabase = createServiceClient()
    const { error: linkError } = await serviceSupabase
      .from('inventory_market_links')
      .upsert({
        item_id: item.id,
        stockx_product_id: selectedProduct.productId,
        stockx_variant_id: matchingVariant.variantId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'item_id',
      })

    if (linkError) {
      console.error('[StockX Map Item] Failed to create link:', linkError)
      return NextResponse.json(
        { error: 'Failed to create mapping link' },
        { status: 500 }
      )
    }

    console.log('[StockX Map Item] Mapping created successfully:', {
      itemId: item.id,
      productId: selectedProduct.productId,
      variantId: matchingVariant.variantId,
    })

    // 7. Sync market data immediately after mapping (Phase 2.8)
    console.log('[StockX Map Item] Syncing market data for mapped item...')

    try {
      await syncSingleInventoryItemFromStockx({
        inventoryItemId: item.id,
        userId: user.id,
      })

      console.log('[StockX Map Item] Market data synced successfully')
    } catch (syncError: any) {
      console.error('[StockX Map Item] Failed to sync market data:', syncError)
      // Don't fail the mapping request if sync fails
    }

    // 8. Refresh materialized view to ensure latest data is available
    console.log('[StockX Map Item] Refreshing stockx_market_latest view...')

    try {
      await refreshStockxMarketLatestView({ dryRun: false })
      console.log('[StockX Map Item] View refreshed successfully')
    } catch (refreshError: any) {
      console.error('[StockX Map Item] Failed to refresh view:', refreshError)
      // Don't fail the mapping request if refresh fails
    }

    // 9. Query stockx_market_latest for fresh market data
    const { data: marketData } = await serviceSupabase
      .from('stockx_market_latest')
      .select('last_sale_price, lowest_ask, highest_bid, currency_code, snapshot_at')
      .eq('stockx_product_id', selectedProduct.productId)
      .eq('stockx_variant_id', matchingVariant.variantId)
      .maybeSingle()

    console.log('[StockX Map Item] Market data retrieved:', marketData)

    return NextResponse.json({
      success: true,
      product: {
        productId: selectedProduct.productId,
        styleId: selectedProduct.styleId,
        title: selectedProduct.productName,
      },
      variant: {
        variantId: matchingVariant.variantId,
        size: matchingVariant.variantValue,
      },
      marketData: marketData ? {
        lastSale: marketData.last_sale_price,
        lowestAsk: marketData.lowest_ask,
        highestBid: marketData.highest_bid,
        currencyCode: marketData.currency_code,
        snapshotAt: marketData.snapshot_at,
      } : null,
    })
  } catch (error: any) {
    console.error('[StockX Map Item] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to map item' },
      { status: 500 }
    )
  }
}
