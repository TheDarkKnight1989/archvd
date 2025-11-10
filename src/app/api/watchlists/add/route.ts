// Quick Add to Watchlist API - Adds SKU to default watchlist
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/watchlists/add
 * Quick-add a product to the user's default watchlist
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
    const { sku, size, target_price } = body

    // Validate SKU
    if (!sku || typeof sku !== 'string' || sku.trim().length === 0) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 })
    }

    const upperSku = sku.toUpperCase()

    // Get or create default watchlist
    let { data: watchlists } = await supabase
      .from('watchlists')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'My Watchlist')
      .limit(1)

    let watchlistId: string

    if (!watchlists || watchlists.length === 0) {
      // Create default watchlist
      const { data: newWatchlist, error: createError } = await supabase
        .from('watchlists')
        .insert({
          user_id: user.id,
          name: 'My Watchlist',
        })
        .select('id')
        .single()

      if (createError || !newWatchlist) {
        throw new Error('Failed to create default watchlist')
      }

      watchlistId = newWatchlist.id
    } else {
      watchlistId = watchlists[0].id
    }

    // Add item to watchlist
    const { data: item, error } = await supabase
      .from('watchlist_items')
      .insert({
        watchlist_id: watchlistId,
        sku: upperSku,
        size: size || null,
        target_price: target_price || null,
      })
      .select()
      .single()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { message: 'Item already in watchlist', alreadyExists: true },
          { status: 200 }
        )
      }

      console.error('[Watchlist Add API] Create error:', error)
      throw new Error(`Failed to add item to watchlist: ${error.message}`)
    }

    return NextResponse.json({ item, message: 'Added to watchlist' }, { status: 201 })
  } catch (error: any) {
    console.error('[Watchlist Add API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
