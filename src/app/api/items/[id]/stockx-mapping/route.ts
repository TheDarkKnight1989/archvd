/**
 * Check StockX Mapping API
 * GET /api/items/[id]/stockx-mapping
 * Returns whether an item has a StockX mapping
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check if mapping exists
    const { data: mapping, error } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id')
      .eq('item_id', id)
      .eq('provider', 'stockx')
      .maybeSingle()

    if (error) {
      console.error('[Check Mapping] Error:', error)
    }

    return NextResponse.json({
      mapped: !!mapping,
      productId: mapping?.stockx_product_id || null,
      variantId: mapping?.stockx_variant_id || null,
    })
  } catch (error: any) {
    console.error('[Check Mapping] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
