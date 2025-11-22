/**
 * Check StockX Mapping API
 * GET /api/items/[id]/stockx-mapping
 * Returns whether an item has a StockX mapping
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 5 // 5 second timeout

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get inventory item details (SKU + size)
    const { data: item, error: itemError } = await supabase
      .from('Inventory')
      .select('sku, size_uk, size')
      .eq('id', id)
      .single()

    if (itemError || !item) {
      console.error('[Check Mapping] Item not found:', itemError)
      return NextResponse.json({
        mapped: false,
        productId: null,
        variantId: null,
        listingId: null,
        error: 'Item not found',
      })
    }

    const { sku, size_uk, size } = item
    const itemSize = size_uk || size

    console.log('[Check Mapping] Item:', { id, sku, itemSize })

    // Check if we have price data in stockx_market_prices for this SKU/size
    // This is the SCALABLE solution - works for ALL products with price data
    const { data: priceData, error: priceError } = await supabase
      .from('stockx_market_prices')
      .select('sku, size, last_sale, lowest_ask, highest_bid, currency, as_of')
      .eq('sku', sku)
      .eq('size', itemSize)
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (priceError) {
      console.error('[Check Mapping] Price lookup error:', priceError)
    }

    console.log('[Check Mapping] Price data:', priceData)

    // If we have price data, item is "mapped" - return SKU/size for live API calls
    // Don't return cached priceData - let the modal fetch live data
    if (priceData) {
      return NextResponse.json({
        mapped: true,
        productId: sku, // Use SKU as product ID for API calls
        variantId: itemSize, // Use size as variant ID
        listingId: null,
        source: 'direct',
      })
    }

    // No price data available
    return NextResponse.json({
      mapped: false,
      productId: null,
      variantId: null,
      listingId: null,
      source: null,
    })
  } catch (error: any) {
    console.error('[Check Mapping] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
