import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/stockx/debug/mappings
 *
 * Debug endpoint to see StockX mapping coverage for inventory items.
 * Shows which items have:
 * - StockX product/variant mappings
 * - Market price data
 * - Product images
 */
export async function GET(request: Request) {
  try {
    // Get authenticated user (bypass for testing)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || 'fbcde760-820b-4eaf-949f-534a8130d44b'

    // Use service client for queries
    const serviceSupabase = createServiceClient()

    // Get currency from query params
    const { searchParams } = new URL(request.url)
    const currency = searchParams.get('currency') || 'GBP'

    // 1. Fetch active portfolio items (same filter as useInventoryV3)
    const { data: inventory, error: inventoryError } = await serviceSupabase
      .from('Inventory')
      .select('id, sku, size, size_uk, status')
      .eq('user_id', userId)
      .in('status', ['active', 'listed', 'worn'])
      .order('created_at', { ascending: false })

    if (inventoryError) {
      return NextResponse.json({ error: inventoryError.message }, { status: 500 })
    }

    // 2. Fetch all StockX mappings for these items
    const inventoryIds = inventory.map(item => item.id)
    const { data: mappings } = await serviceSupabase
      .from('inventory_market_links')
      .select('item_id, stockx_product_id, stockx_variant_id')
      .in('item_id', inventoryIds)

    // Create mapping lookup
    const mappingLookup = new Map()
    mappings?.forEach(m => {
      mappingLookup.set(m.item_id, {
        stockx_product_id: m.stockx_product_id,
        stockx_variant_id: m.stockx_variant_id,
      })
    })

    // 3. Fetch StockX products (to check for images)
    const stockxProductIds = [...new Set(mappings?.map(m => m.stockx_product_id) || [])]
    const { data: stockxProducts } = await serviceSupabase
      .from('stockx_products')
      .select('stockx_product_id, style_id, image_url, thumb_url')
      .in('stockx_product_id', stockxProductIds)

    // Create product image lookup
    const productImageLookup = new Map()
    stockxProducts?.forEach(p => {
      productImageLookup.set(p.stockx_product_id, {
        style_id: p.style_id,
        has_image: !!(p.image_url || p.thumb_url),
        image_url: p.image_url,
        thumb_url: p.thumb_url,
      })
    })

    // 4. Fetch market prices (to check for market data)
    // IMPORTANT: stockx_market_latest returns amounts in MAJOR currency units (e.g., 150.0 = £150.00)
    // - Do NOT divide by 100
    // - Filter by currency_code to get prices in user's preferred currency
    // - Use DbStockxMarketLatest type from @/lib/stockx/dbTypes for type safety
    const variantKeys = mappings?.map(m => ({ product_id: m.stockx_product_id, variant_id: m.stockx_variant_id })) || []
    const { data: marketPrices } = await serviceSupabase
      .from('stockx_market_latest')
      .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, snapshot_at')
      .eq('currency_code', currency)
      .in('stockx_product_id', stockxProductIds)

    // Create market price lookup
    const marketPriceLookup = new Map()
    marketPrices?.forEach(p => {
      const key = `${p.stockx_product_id}:${p.stockx_variant_id}:${p.currency_code}`
      marketPriceLookup.set(key, {
        lowest_ask: p.lowest_ask,  // Already in major units (no /100 needed)
        snapshot_at: p.snapshot_at,
      })
    })

    // 5. Build debug output
    const debugResults = inventory.map(item => {
      const mapping = mappingLookup.get(item.id)

      if (!mapping) {
        return {
          itemId: item.id,
          sku: item.sku,
          size: item.size_uk || item.size,
          stockx_product_id: null,
          stockx_variant_id: null,
          hasMapping: false,
          hasMarketSnapshot: false,
          hasImage: false,
          marketData: null,
          imageData: null,
        }
      }

      const productInfo = productImageLookup.get(mapping.stockx_product_id)
      const marketKey = `${mapping.stockx_product_id}:${mapping.stockx_variant_id}:${currency}`
      const marketData = marketPriceLookup.get(marketKey)

      return {
        itemId: item.id,
        sku: item.sku,
        size: item.size_uk || item.size,
        stockx_product_id: mapping.stockx_product_id,
        stockx_variant_id: mapping.stockx_variant_id,
        hasMapping: true,
        hasMarketSnapshot: !!marketData,
        hasImage: productInfo?.has_image || false,
        marketData: marketData ? {
          lowest_ask: marketData.lowest_ask,
          snapshot_at: marketData.snapshot_at,
        } : null,
        imageData: productInfo ? {
          style_id: productInfo.style_id,
          image_url: productInfo.image_url,
          thumb_url: productInfo.thumb_url,
        } : null,
      }
    })

    // 6. Calculate summary stats
    const summary = {
      total: debugResults.length,
      withMapping: debugResults.filter(r => r.hasMapping).length,
      withMarketData: debugResults.filter(r => r.hasMarketSnapshot).length,
      withImages: debugResults.filter(r => r.hasImage).length,
      missingMapping: debugResults.filter(r => !r.hasMapping).length,
      missingMarketData: debugResults.filter(r => r.hasMapping && !r.hasMarketSnapshot).length,
      missingImages: debugResults.filter(r => r.hasMapping && !r.hasImage).length,
    }

    return NextResponse.json({
      summary,
      currency,
      items: debugResults,
    })
  } catch (error: any) {
    console.error('[StockX Debug] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Debug query failed' },
      { status: 500 }
    )
  }
}
