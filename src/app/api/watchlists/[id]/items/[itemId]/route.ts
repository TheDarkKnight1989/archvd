// Watchlist Item API - Update and Delete individual items
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/watchlists/[id]/items/[itemId]
 * Update a watchlist item (e.g., change target price)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: watchlistId, itemId } = await params
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify watchlist ownership
    const { data: watchlist, error: watchlistError } = await supabase
      .from('watchlists')
      .select('id')
      .eq('id', watchlistId)
      .eq('user_id', user.id)
      .single()

    if (watchlistError || !watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found or access denied' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { target_price } = body

    // Validate target_price
    if (target_price !== undefined && target_price !== null) {
      const priceNum = parseFloat(target_price)
      if (isNaN(priceNum) || priceNum < 0) {
        return NextResponse.json(
          { error: 'Target price must be a positive number' },
          { status: 400 }
        )
      }
    }

    // Update item
    const { data: item, error } = await supabase
      .from('watchlist_items')
      .update({ target_price: target_price || null })
      .eq('id', itemId)
      .eq('watchlist_id', watchlistId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Item not found or access denied' },
          { status: 404 }
        )
      }

      console.error('[Watchlist Item API] Update error:', error)
      throw new Error(`Failed to update watchlist item: ${error.message}`)
    }

    return NextResponse.json({ item })
  } catch (error: any) {
    console.error('[Watchlist Item API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/watchlists/[id]/items/[itemId]
 * Remove an item from a watchlist
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: watchlistId, itemId } = await params
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify watchlist ownership
    const { data: watchlist, error: watchlistError } = await supabase
      .from('watchlists')
      .select('id')
      .eq('id', watchlistId)
      .eq('user_id', user.id)
      .single()

    if (watchlistError || !watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found or access denied' },
        { status: 404 }
      )
    }

    // Delete item
    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .eq('id', itemId)
      .eq('watchlist_id', watchlistId)

    if (error) {
      console.error('[Watchlist Item API] Delete error:', error)
      throw new Error(`Failed to delete watchlist item: ${error.message}`)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[Watchlist Item API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
