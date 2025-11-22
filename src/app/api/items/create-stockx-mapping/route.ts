/**
 * Create StockX Mapping API
 * POST /api/items/create-stockx-mapping
 * Creates a mapping between an inventory item and a StockX product/variant
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { detectBrand, detectGender, convertUkToUs } from '@/lib/utils/size-conversion'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const serviceSupabase = createServiceClient()

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { itemId, stockxProductId, stockxVariantId: providedVariantId } = body

    if (!itemId || !stockxProductId) {
      return NextResponse.json(
        { error: 'Missing required fields: itemId, stockxProductId' },
        { status: 400 }
      )
    }

    console.log('[Create Mapping]', { itemId, stockxProductId, providedVariantId })

    // Verify item belongs to user AND get size info
    const { data: item, error: itemError } = await supabase
      .from('Inventory')
      .select('id, user_id, size_uk, size_us, sku')
      .eq('id', itemId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get product info for brand detection
    const { data: product, error: productError } = await serviceSupabase
      .from('stockx_products')
      .select('brand, title, stockx_product_id')
      .eq('stockx_product_id', stockxProductId)
      .single()

    if (productError || !product) {
      console.error('[Create Mapping] Product not found:', stockxProductId)
      return NextResponse.json(
        { error: 'StockX product not found', details: 'Product must be synced to database first' },
        { status: 404 }
      )
    }

    // Auto-detect correct variant using size conversion
    let stockxVariantId = providedVariantId

    if (item.size_uk && !providedVariantId) {
      console.log('[Create Mapping] Auto-detecting variant from UK size:', item.size_uk)

      const brand = detectBrand(product.brand, product.title)
      const gender = detectGender(product.title)
      const usSize = convertUkToUs(parseFloat(item.size_uk), brand, gender)

      if (!usSize) {
        console.error('[Create Mapping] Cannot convert UK size:', {
          ukSize: item.size_uk,
          brand,
          gender,
        })
        return NextResponse.json(
          {
            error: 'Size conversion failed',
            details: `Cannot convert UK ${item.size_uk} for ${brand} ${gender}`,
          },
          { status: 400 }
        )
      }

      console.log('[Create Mapping] Size conversion:', {
        brand,
        gender,
        ukSize: item.size_uk,
        usSize,
      })

      // Find variant with matching US size
      const { data: variants, error: variantsError } = await serviceSupabase
        .from('stockx_variants')
        .select('stockx_variant_id, variant_value')
        .eq('stockx_product_id', stockxProductId)

      if (variantsError || !variants || variants.length === 0) {
        console.error('[Create Mapping] No variants found for product:', stockxProductId)
        return NextResponse.json(
          { error: 'No variants found', details: 'Product has no size variants in database' },
          { status: 404 }
        )
      }

      const matchingVariant = variants.find(
        (v) => parseFloat(v.variant_value) === usSize
      )

      if (!matchingVariant) {
        console.error('[Create Mapping] No matching variant found:', {
          usSize,
          availableSizes: variants.map((v) => v.variant_value),
        })
        return NextResponse.json(
          {
            error: 'Size not available',
            details: `US ${usSize} not found. Available: ${variants.map((v) => v.variant_value).join(', ')}`,
          },
          { status: 400 }
        )
      }

      stockxVariantId = matchingVariant.stockx_variant_id
      console.log('[Create Mapping] Auto-selected variant:', {
        variantId: stockxVariantId,
        usSize,
      })
    } else if (!stockxVariantId) {
      return NextResponse.json(
        { error: 'Missing variant ID and no UK size for auto-detection' },
        { status: 400 }
      )
    }

    // Try to get market data from the materialized view (cached market snapshots)
    // IMPORTANT: stockx_market_latest returns amounts in MAJOR currency units (e.g., 150.0 = £150.00)
    // - Do NOT divide by 100
    // - Query by stockx_product_id AND stockx_variant_id for specific variant pricing
    // - Use DbStockxMarketLatest type from @/lib/stockx/dbTypes for type safety
    const { data: marketSnapshot } = await supabase
      .from('stockx_market_latest')
      .select('last_sale_price, lowest_ask, highest_bid, currency_code')
      .eq('stockx_product_id', stockxProductId)
      .eq('stockx_variant_id', stockxVariantId)
      .maybeSingle()

    console.log('[Create Mapping] Market snapshot:', marketSnapshot)  // Prices already in major units

    // Check if mapping already exists (using service role to bypass RLS)
    const { data: existingMapping } = await serviceSupabase
      .from('inventory_market_links')
      .select('id')
      .eq('item_id', itemId)
      .maybeSingle()

    if (existingMapping) {
      // Update existing mapping (using service role to bypass RLS)
      const { error: updateError } = await serviceSupabase
        .from('inventory_market_links')
        .update({
          stockx_product_id: stockxProductId,
          stockx_variant_id: stockxVariantId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMapping.id)

      if (updateError) {
        console.error('[Create Mapping] Update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update mapping', details: updateError.message },
          { status: 500 }
        )
      }
    } else {
      // Create new mapping (using service role to bypass RLS)
      const { error: insertError } = await serviceSupabase
        .from('inventory_market_links')
        .insert({
          item_id: itemId,
          stockx_product_id: stockxProductId,
          stockx_variant_id: stockxVariantId,
        })

      if (insertError) {
        console.error('[Create Mapping] Insert error:', insertError)
        return NextResponse.json(
          { error: 'Failed to create mapping', details: insertError.message },
          { status: 500 }
        )
      }
    }

    console.log('[Create Mapping] Success', {
      itemId,
      stockxProductId,
      stockxVariantId,
      hasMarketData: !!marketSnapshot,
    })

    return NextResponse.json({
      success: true,
      mapping: {
        itemId,
        stockxProductId,
        stockxVariantId,
      },
      marketData: marketSnapshot
        ? {
            lastSale: marketSnapshot.last_sale_price,
            lowestAsk: marketSnapshot.lowest_ask,
            highestBid: marketSnapshot.highest_bid,
            currency: marketSnapshot.currency_code || 'USD',
          }
        : null,
    })
  } catch (error: any) {
    console.error('[Create Mapping] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
