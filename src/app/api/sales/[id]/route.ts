/**
 * Sales Edit API - Updates sale details for data quality fixes
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

    // Verify item exists and belongs to user
    const { data: existingItem, error: fetchError } = await supabase
      .from('Inventory')
      .select('id, user_id, status')
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

    if (existingItem.status !== 'sold') {
      return NextResponse.json(
        { error: 'Item is not marked as sold' },
        { status: 400 }
      )
    }

    // Build update payload from body
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    // Only update fields that are provided
    if (body.sold_price !== undefined) {
      updatePayload.sold_price = body.sold_price
      updatePayload.sale_price = body.sold_price // Backwards compatibility
    }

    if (body.sold_date !== undefined) {
      updatePayload.sold_date = body.sold_date
      updatePayload.sale_date = body.sold_date // Backwards compatibility
    }

    if (body.platform !== undefined) {
      updatePayload.platform = body.platform
    }

    if (body.sales_fee !== undefined) {
      updatePayload.sales_fee = body.sales_fee
    }

    if (body.purchase_price !== undefined) {
      updatePayload.purchase_price = body.purchase_price
    }

    if (body.notes !== undefined) {
      updatePayload.notes = body.notes
    }

    console.log('[Edit Sale] Updating item with payload:', JSON.stringify(updatePayload, null, 2))

    // Update item
    const { data: updatedItem, error: updateError } = await supabase
      .from('Inventory')
      .update(updatePayload)
      .eq('id', itemId)
      .select()
      .single()

    if (updateError) {
      console.error('[Edit Sale] Update error:', JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        {
          error: 'Failed to update sale',
          details: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
    })

  } catch (error: any) {
    console.error('[Edit Sale] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
