/**
 * Create StockX Mapping API
 * POST /api/items/create-stockx-mapping
 * Creates a mapping between an inventory item and a StockX product/variant
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { itemId, stockxProductId, stockxVariantId } = body

    if (!itemId || !stockxProductId || !stockxVariantId) {
      return NextResponse.json(
        { error: 'Missing required fields: itemId, stockxProductId, stockxVariantId' },
        { status: 400 }
      )
    }

    console.log('[Create Mapping]', { itemId, stockxProductId, stockxVariantId })

    // Verify item belongs to user
    const { data: item, error: itemError } = await supabase
      .from('Inventory')
      .select('id, user_id')
      .eq('id', itemId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if mapping already exists
    const { data: existingMapping } = await supabase
      .from('inventory_market_links')
      .select('id')
      .eq('item_id', itemId)
      .maybeSingle()

    if (existingMapping) {
      // Update existing mapping
      const { error: updateError } = await supabase
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
      // Create new mapping
      const { error: insertError } = await supabase
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

    // Fetch market data for this variant
    const { data: marketData } = await supabase
      .from('stockx_market_latest')
      .select('last_sale_price, lowest_ask, highest_bid, currency_code')
      .eq('stockx_product_id', stockxProductId)
      .eq('stockx_variant_id', stockxVariantId)
      .maybeSingle()

    console.log('[Create Mapping] Success', {
      itemId,
      stockxProductId,
      stockxVariantId,
      hasMarketData: !!marketData,
    })

    return NextResponse.json({
      success: true,
      mapping: {
        itemId,
        stockxProductId,
        stockxVariantId,
      },
      marketData: marketData
        ? {
            lastSale: marketData.last_sale_price,
            lowestAsk: marketData.lowest_ask,
            highestBid: marketData.highest_bid,
            currency: marketData.currency_code,
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
