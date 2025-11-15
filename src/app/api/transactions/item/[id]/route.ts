/**
 * PATCH /api/transactions/item/[id]
 * DELETE /api/transactions/item/[id]
 * WHY: Update or delete a transaction
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { qty, unit_price, fees, occurred_at, notes } = body

    // Build update object (only update provided fields)
    const updates: any = {}
    if (qty !== undefined) updates.qty = qty
    if (unit_price !== undefined) updates.unit_price = unit_price
    if (fees !== undefined) updates.fees = fees
    if (occurred_at !== undefined) updates.occurred_at = occurred_at
    if (notes !== undefined) updates.notes = notes

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update transaction
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this transaction
      .select()
      .single()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, transaction: data })
  } catch (error: any) {
    console.error('[Update Transaction] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Delete transaction
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this transaction

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[Delete Transaction] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
