/**
 * Delete Item API - V4 FIRST
 * DELETE /api/items/[id]/delete
 * Permanently deletes an item from inventory
 *
 * Priority: V4 tables first, then clean up any legacy V3 data
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[DELETE /api/items/[id]/delete]', { itemId: id, userId: user.id })

    // V4 FIRST: Try to find item in V4 table (source of truth)
    const { data: v4Item, error: v4FetchError } = await supabase
      .from('inventory_v4_items')
      .select('id, style_id, user_id')
      .eq('id', id)
      .single()

    // If V4 item exists, verify ownership
    if (v4Item) {
      if (v4Item.user_id !== user.id) {
        console.error('[DELETE] Unauthorized: V4 item belongs to different user')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Delete V4 listings first (cascade)
      await supabase
        .from('inventory_v4_listings')
        .delete()
        .eq('item_id', id)

      // Delete V4 item
      const { error: v4DeleteError } = await supabase
        .from('inventory_v4_items')
        .delete()
        .eq('id', id)

      if (v4DeleteError) {
        console.error('[DELETE] Failed to delete V4 item:', v4DeleteError)
        return NextResponse.json(
          { error: 'Failed to delete item', details: v4DeleteError.message },
          { status: 500 }
        )
      }

      // Clean up any related records
      await supabase.from('expenses').delete().eq('item_id', id)
      await supabase.from('watchlist_items').delete().eq('item_id', id)

      console.log('[DELETE] V4 item deleted successfully:', {
        id: v4Item.id,
        style_id: v4Item.style_id,
      })

      return NextResponse.json({
        success: true,
        message: 'Item deleted successfully',
        item: { id: v4Item.id, style_id: v4Item.style_id },
      })
    }

    // V4 item not found - return 404 (no V3 fallback)
    console.error('[DELETE] Item not found in V4:', { id, error: v4FetchError?.message })
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  } catch (error: any) {
    console.error('[DELETE /api/items/[id]/delete] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
