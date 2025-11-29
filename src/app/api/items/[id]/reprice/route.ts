/**
 * Reprice Item API
 * Updates item's custom market value based on repricing suggestions
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      )
    }

    const { id: itemId } = await params

    // Parse request body
    const body = await request.json()
    const { new_price, reason } = body

    if (!new_price || typeof new_price !== 'number') {
      return NextResponse.json(
        { error: 'Invalid new_price' },
        { status: 400 }
      )
    }

    // Verify item exists and belongs to user
    const { data: existingItem, error: fetchError } = await supabase
      .from('Inventory')
      .select('id, user_id, sku, purchase_price, tax, shipping, custom_market_value')
      .eq('id', itemId)
      .single()

    if (fetchError || !existingItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    if (existingItem.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this item' },
        { status: 403 }
      )
    }

    // Calculate cost and margin
    const cost = existingItem.purchase_price + (existingItem.tax || 0) + (existingItem.shipping || 0)
    const margin = new_price > 0 ? ((new_price - cost) / new_price) * 100 : 0

    // Warn if margin is very low (< 5%)
    if (margin < 5) {
      console.warn(`[Reprice] Low margin warning for item ${itemId}: ${margin.toFixed(1)}%`)
    }

    // Update custom_market_value
    const { data: updatedItem, error: updateError } = await supabase
      .from('Inventory')
      .update({
        custom_market_value: new_price,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single()

    if (updateError) {
      console.error('[Reprice] Update error:', JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        {
          error: 'Failed to reprice item',
          details: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      )
    }

    console.log(`[Reprice] Successfully repriced item ${itemId}: ${existingItem.custom_market_value || 'none'} -> ${new_price}. Reason: ${reason || 'N/A'}`)

    return NextResponse.json({
      success: true,
      item: updatedItem,
      old_price: existingItem.custom_market_value,
      new_price,
      margin: margin.toFixed(2),
    })

  } catch (error: any) {
    console.error('[Reprice] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
