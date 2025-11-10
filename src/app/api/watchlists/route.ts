// Watchlists API - Full CRUD for user watchlists
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/watchlists
 * Fetch all watchlists for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's watchlists
    const { data: watchlists, error } = await supabase
      .from('watchlists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Watchlists API] Fetch error:', error)
      throw new Error(`Failed to fetch watchlists: ${error.message}`)
    }

    return NextResponse.json({ watchlists: watchlists || [] })
  } catch (error: any) {
    console.error('[Watchlists API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/watchlists
 * Create a new watchlist for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
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

    // Create watchlist
    const { data: watchlist, error } = await supabase
      .from('watchlists')
      .insert({
        user_id: user.id,
        name: name.trim(),
      })
      .select()
      .single()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A watchlist with this name already exists' },
          { status: 409 }
        )
      }

      console.error('[Watchlists API] Create error:', error)
      throw new Error(`Failed to create watchlist: ${error.message}`)
    }

    return NextResponse.json({ watchlist }, { status: 201 })
  } catch (error: any) {
    console.error('[Watchlists API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
