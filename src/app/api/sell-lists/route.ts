// Sell Lists API - Full CRUD for user sell lists
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'

/**
 * GET /api/sell-lists
 * Fetch all sell lists for the authenticated user
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

    // Fetch user's sell lists
    const { data: sellLists, error } = await supabase
      .from('sell_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Sell Lists API] Fetch error:', error)
      throw new Error(`Failed to fetch sell lists: ${error.message}`)
    }

    return NextResponse.json({ sellLists: sellLists || [] })
  } catch (error: any) {
    console.error('[Sell Lists API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sell-lists
 * Create a new sell list for the authenticated user
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
    const {
      name,
      allow_comments = false,
      show_market_prices = false,
      allow_offers = false,
      allow_asking_prices = false
    } = body

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Sell list name is required' },
        { status: 400 }
      )
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Sell list name must be 100 characters or less' },
        { status: 400 }
      )
    }

    // Generate unique share token
    const shareToken = nanoid(16)

    // Create sell list
    const { data: sellList, error } = await supabase
      .from('sell_lists')
      .insert({
        user_id: user.id,
        name: name.trim(),
        share_token: shareToken,
        allow_comments,
        show_market_prices,
        allow_offers,
        allow_asking_prices,
      })
      .select()
      .single()

    if (error) {
      console.error('[Sell Lists API] Create error:', error)
      throw new Error(`Failed to create sell list: ${error.message}`)
    }

    return NextResponse.json({ sellList }, { status: 201 })
  } catch (error: any) {
    console.error('[Sell Lists API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
