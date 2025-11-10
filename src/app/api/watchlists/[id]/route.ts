// Watchlist API - Update and Delete individual watchlists
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/watchlists/[id]
 * Update a watchlist (e.g., rename)
 */
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
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { name } = body

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Watchlist name is required' },
        { status: 400 }
      )
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Watchlist name must be 100 characters or less' },
        { status: 400 }
      )
    }

    // Update watchlist (RLS ensures user can only update their own)
    const { data: watchlist, error } = await supabase
      .from('watchlists')
      .update({ name: name.trim() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Watchlist not found or access denied' },
          { status: 404 }
        )
      }

      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A watchlist with this name already exists' },
          { status: 409 }
        )
      }

      console.error('[Watchlist API] Update error:', error)
      throw new Error(`Failed to update watchlist: ${error.message}`)
    }

    return NextResponse.json({ watchlist })
  } catch (error: any) {
    console.error('[Watchlist API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/watchlists/[id]
 * Delete a watchlist and all its items
 */
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
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete watchlist (RLS ensures user can only delete their own)
    // Items are automatically deleted due to ON DELETE CASCADE
    const { error } = await supabase
      .from('watchlists')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[Watchlist API] Delete error:', error)
      throw new Error(`Failed to delete watchlist: ${error.message}`)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[Watchlist API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
