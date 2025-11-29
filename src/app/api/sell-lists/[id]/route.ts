// Sell List Detail API - Update and delete individual sell lists
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/sell-lists/[id]
 * Update sell list settings
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

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
    const { name, allow_comments, show_market_prices, allow_offers, allow_asking_prices } = body

    // Build update object
    const updates: any = {}
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Sell list name must be a non-empty string' },
          { status: 400 }
        )
      }
      if (name.length > 100) {
        return NextResponse.json(
          { error: 'Sell list name must be 100 characters or less' },
          { status: 400 }
        )
      }
      updates.name = name.trim()
    }
    if (allow_comments !== undefined) updates.allow_comments = Boolean(allow_comments)
    if (show_market_prices !== undefined) updates.show_market_prices = Boolean(show_market_prices)
    if (allow_offers !== undefined) updates.allow_offers = Boolean(allow_offers)
    if (allow_asking_prices !== undefined) updates.allow_asking_prices = Boolean(allow_asking_prices)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update sell list (RLS ensures user owns it)
    const { data: sellList, error } = await supabase
      .from('sell_lists')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Sell list not found or access denied' },
          { status: 404 }
        )
      }
      console.error('[Sell Lists API] Update error:', error)
      throw new Error(`Failed to update sell list: ${error.message}`)
    }

    return NextResponse.json({ sellList })
  } catch (error: any) {
    console.error('[Sell Lists API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sell-lists/[id]
 * Delete a sell list and all its items
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete sell list (RLS ensures user owns it, cascade will delete items)
    const { error } = await supabase
      .from('sell_lists')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[Sell Lists API] Delete error:', error)
      throw new Error(`Failed to delete sell list: ${error.message}`)
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
