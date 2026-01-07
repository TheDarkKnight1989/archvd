/**
 * Item Status API - V4 ONLY
 * PATCH /api/items/[id]/status
 * Updates an inventory item's status (in_stock, listed, consigned, sold)
 *
 * V4 tables are source of truth. V3 is frozen.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['in_stock', 'listed', 'consigned', 'sold'] as const
type ItemStatus = (typeof VALID_STATUSES)[number]

export async function PATCH(
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
      console.error('[STATUS] NOT_AUTHENTICATED: No user session')
      return NextResponse.json(
        { error: 'Unauthorized', code: 'NOT_AUTHENTICATED' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { status } = body as { status: string }

    if (!status || !VALID_STATUSES.includes(status as ItemStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    console.log('[STATUS] Request received:', { itemId: id, userId: user.id, newStatus: status })

    // V4 ONLY: Query inventory_v4_items first (source of truth)
    const { data: v4Item, error: v4FetchError } = await supabase
      .from('inventory_v4_items')
      .select('id, style_id, user_id, status')
      .eq('id', id)
      .single()

    if (v4FetchError || !v4Item) {
      console.error('[STATUS] NOT_FOUND_V4_ITEM:', { itemId: id, error: v4FetchError?.message })
      return NextResponse.json(
        { error: 'Item not found in V4 inventory', code: 'NOT_FOUND_V4_ITEM' },
        { status: 404 }
      )
    }

    if (v4Item.user_id !== user.id) {
      console.error('[STATUS] FORBIDDEN: Item belongs to different user', {
        itemId: id,
        itemUserId: v4Item.user_id,
        requestUserId: user.id
      })
      return NextResponse.json(
        { error: 'Forbidden - You do not own this item', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // Idempotent: If already at target status, return success
    if (v4Item.status === status) {
      console.log('[STATUS] Already at target status:', { itemId: id, status })
      return NextResponse.json({
        success: true,
        message: `Item already has status ${status}`,
        alreadyAtStatus: true,
        item: {
          id: v4Item.id,
          style_id: v4Item.style_id,
          status,
        },
      })
    }

    const oldStatus = v4Item.status

    // Update V4 inventory_v4_items status
    const { error: v4UpdateError } = await supabase
      .from('inventory_v4_items')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (v4UpdateError) {
      console.error('[STATUS] Failed to update V4 item:', v4UpdateError)
      return NextResponse.json(
        { error: 'Failed to update item status', details: v4UpdateError.message },
        { status: 500 }
      )
    }

    // If status is 'sold', also update any listings to 'sold'
    if (status === 'sold') {
      const { error: listingError } = await supabase
        .from('inventory_v4_listings')
        .update({
          status: 'sold',
          updated_at: new Date().toISOString(),
        })
        .eq('item_id', id)

      if (listingError) {
        console.warn('[STATUS] Failed to update inventory_v4_listings:', listingError)
      }
    }

    console.log('[STATUS] V4 item status updated successfully:', {
      itemId: id,
      styleId: v4Item.style_id,
      oldStatus,
      newStatus: status,
    })

    return NextResponse.json({
      success: true,
      message: `Item status updated to ${status}`,
      item: {
        id: v4Item.id,
        style_id: v4Item.style_id,
        status,
      },
    })
  } catch (error: any) {
    console.error('[STATUS] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
