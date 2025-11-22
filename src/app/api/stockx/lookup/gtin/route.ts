/**
 * StockX GTIN/Barcode Lookup API
 * Looks up products by GTIN (UPC/EAN barcode)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCatalogService } from '@/lib/services/stockx/catalog'
import { createClient } from '@/lib/supabase/server'
import { isStockxMockMode } from '@/lib/config/stockx'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const gtin = searchParams.get('gtin')

    if (!gtin || typeof gtin !== 'string') {
      return NextResponse.json({ error: 'GTIN is required' }, { status: 400 })
    }

    console.log('[GTIN Lookup] Looking up:', gtin)

    // Check if StockX is in mock mode
    if (isStockxMockMode()) {
      return NextResponse.json(
        { error: 'StockX is in mock mode. Real API calls are disabled.' },
        { status: 503 }
      )
    }

    // First check our database
    const supabase = await createClient()
    const { data: existingVariant } = await supabase
      .from('stockx_variants')
      .select('*, stockx_products(*)')
      .contains('gtins', [gtin])
      .single()

    if (existingVariant) {
      console.log('[GTIN Lookup] Found in database')
      return NextResponse.json(
        {
          product: {
            sku: existingVariant.stockx_products.style_id,
            brand: existingVariant.stockx_products.brand,
            name: existingVariant.stockx_products.title,
            colorway: existingVariant.stockx_products.colorway,
            image_url: existingVariant.stockx_products.image_url || existingVariant.stockx_products.thumb_url,
            retail_price: existingVariant.stockx_products.retail_price,
          },
          variant: {
            size: existingVariant.variant_value,
            gtins: existingVariant.gtins,
          },
          source: 'database',
        },
        { status: 200 }
      )
    }

    // Lookup via StockX API
    const catalogService = getCatalogService()
    const result = await catalogService.lookupByGTIN(gtin)

    if (!result) {
      return NextResponse.json(
        { error: 'Product not found for this barcode' },
        { status: 404 }
      )
    }

    console.log('[GTIN Lookup] Found via StockX API:', result.product.styleId)

    // Cache in catalog_cache for faster future lookups
    await supabase.from('catalog_cache').upsert(
      {
        sku: result.product.styleId,
        brand: result.product.brand,
        model: result.product.productName,
        colorway: result.product.colorway,
        image_url: result.product.image,
        source: 'stockx_v2_gtin',
        confidence: 98,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'sku',
      }
    )

    return NextResponse.json(
      {
        product: {
          sku: result.product.styleId,
          brand: result.product.brand,
          name: result.product.productName,
          colorway: result.product.colorway,
          image_url: result.product.image,
          retail_price: result.product.retailPrice,
        },
        variant: {
          size: result.variant.variantValue,
          gtins: result.variant.gtins,
        },
        marketData: result.marketData
          ? {
              lowestAsk: result.marketData.lowestAsk,
              highestBid: result.marketData.highestBid,
              marketPrice: result.marketData.highestBid ?? result.marketData.lowestAsk ?? null,
              currency: result.marketData.currencyCode,
            }
          : null,
        source: 'stockx_v2',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[GTIN Lookup] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
