/**
 * Sales Edit API - V4 ONLY
 * Updates sale details in inventory_v4_sales table.
 * No V3 table references.
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

    const { id: saleId } = await params

    // Parse request body
    const body = await request.json()

    // Verify sale exists and belongs to user (V4 ONLY)
    const { data: existingSale, error: fetchError } = await supabase
      .from('inventory_v4_sales')
      .select('id, user_id')
      .eq('id', saleId)
      .single()

    if (fetchError || !existingSale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      )
    }

    if (existingSale.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this sale' },
        { status: 403 }
      )
    }

    // Build update payload from body
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    // Only update fields that are provided
    if (body.sold_price !== undefined) {
      updatePayload.sold_price = body.sold_price
    }

    if (body.sold_date !== undefined) {
      updatePayload.sold_date = body.sold_date
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

    console.log('[Edit Sale V4] Updating sale with payload:', JSON.stringify(updatePayload, null, 2))

    // Update V4 sale record
    const { data: updatedSale, error: updateError } = await supabase
      .from('inventory_v4_sales')
      .update(updatePayload)
      .eq('id', saleId)
      .select()
      .single()

    if (updateError) {
      console.error('[Edit Sale V4] Update error:', JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        {
          error: 'Failed to update sale',
          details: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      )
    }

    console.log('[Edit Sale V4] Sale updated successfully')

    return NextResponse.json({
      success: true,
      sale: updatedSale,
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Edit Sale V4] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}
