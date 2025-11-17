/**
 * Delete Item API
 * DELETE /api/items/[id]/delete
 * Permanently deletes an item from inventory
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

    // Verify item belongs to user
    const { data: item, error: fetchError } = await supabase
      .from('Inventory')
      .select('id, sku, brand, model, user_id')
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      console.error('[DELETE] Item not found:', fetchError)
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item.user_id !== user.id) {
      console.error('[DELETE] Unauthorized: item belongs to different user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete related records first (cascade delete)
    // 1. Delete inventory_market_links
    await supabase
      .from('inventory_market_links')
      .delete()
      .eq('item_id', id)

    // 2. Delete StockX listings (if any)
    await supabase
      .from('stockx_listings')
      .delete()
      .eq('item_id', id)

    // 3. Delete expenses
    await supabase
      .from('expenses')
      .delete()
      .eq('item_id', id)

    // 4. Delete watchlist items
    await supabase
      .from('watchlist_items')
      .delete()
      .eq('item_id', id)

    // 5. Finally, delete the item itself
    const { error: deleteError } = await supabase
      .from('Inventory')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[DELETE] Failed to delete item:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete item', details: deleteError.message },
        { status: 500 }
      )
    }

    console.log('[DELETE] Item deleted successfully:', {
      id: item.id,
      sku: item.sku,
      brand: item.brand,
      model: item.model,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Item deleted successfully',
        item: {
          id: item.id,
          sku: item.sku,
          brand: item.brand,
          model: item.model,
        },
      },
      { status: 200 }
    )
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
