// Sell List Item API - Update or delete individual items from a sell list
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/sell-lists/[id]/items/[itemId]
 * Update a sell list item (asking price, position)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: sellListId, itemId } = await params

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { asking_price, position } = body

    // Build update object
    const updates: any = {}
    if (asking_price !== undefined) {
      if (asking_price !== null && (typeof asking_price !== 'number' || asking_price < 0)) {
        return NextResponse.json(
          { error: 'asking_price must be a positive number or null' },
          { status: 400 }
        )
      }
      updates.asking_price = asking_price
    }
    if (position !== undefined) {
      if (typeof position !== 'number' || position < 0 || !Number.isInteger(position)) {
        return NextResponse.json(
          { error: 'position must be a non-negative integer' },
          { status: 400 }
        )
      }
      updates.position = position
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update item (RLS will ensure user owns the sell list)
    const { data: item, error } = await supabase
      .from('sell_list_items')
      .update(updates)
      .eq('id', itemId)
      .eq('sell_list_id', sellListId)
      .select(`
        *,
        sell_lists!inner (
          user_id
        )
      `)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Item not found or access denied' },
          { status: 404 }
        )
      }
      console.error('[Sell Lists API] Update error:', error)
      throw new Error(`Failed to update sell list item: ${error.message}`)
    }

    // Verify ownership
    if (item.sell_lists.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({ item })
  } catch (error: any) {
    console.error('[Sell Lists API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sell-lists/[id]/items/[itemId]
 * Remove an item from a sell list
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: sellListId, itemId } = await params

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First verify the item exists and user owns the sell list
    const { data: item, error: fetchError } = await supabase
      .from('sell_list_items')
      .select(`
        id,
        sell_lists!inner (
          user_id
        )
      `)
      .eq('id', itemId)
      .eq('sell_list_id', sellListId)
      .single()

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Item not found or access denied' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (item.sell_lists.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Delete item
    const { error } = await supabase
      .from('sell_list_items')
      .delete()
      .eq('id', itemId)
      .eq('sell_list_id', sellListId)

    if (error) {
      console.error('[Sell Lists API] Delete error:', error)
      throw new Error(`Failed to delete sell list item: ${error.message}`)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[Sell Lists API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
