// Public Sell List Interactions API - Submit comments and offers (no auth required)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/sell-lists/public/[shareToken]/interactions
 * Submit a comment or offer on a sell list (no authentication required)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    // Use service role client to bypass RLS for public access
    const supabase = await createClient()
    const { shareToken } = await params

    // Parse request body
    const body = await request.json()
    const { type, buyer_name, buyer_email, message, offer_amount, sell_list_item_id } = body

    // Validate type
    if (!type || !['comment', 'offer'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be either "comment" or "offer"' },
        { status: 400 }
      )
    }

    // Verify sell list exists and get its settings
    const { data: sellList, error: listError } = await supabase
      .from('sell_lists')
      .select('id, allow_comments, allow_offers')
      .eq('share_token', shareToken)
      .single()

    if (listError || !sellList) {
      return NextResponse.json(
        { error: 'Sell list not found' },
        { status: 404 }
      )
    }

    // Check if the interaction type is allowed
    if (type === 'comment' && !sellList.allow_comments) {
      return NextResponse.json(
        { error: 'Comments are not allowed on this sell list' },
        { status: 403 }
      )
    }

    if (type === 'offer' && !sellList.allow_offers) {
      return NextResponse.json(
        { error: 'Offers are not allowed on this sell list' },
        { status: 403 }
      )
    }

    // Validate required fields based on type
    if (type === 'comment') {
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return NextResponse.json(
          { error: 'message is required for comments' },
          { status: 400 }
        )
      }
      if (message.length > 1000) {
        return NextResponse.json(
          { error: 'message must be 1000 characters or less' },
          { status: 400 }
        )
      }
    }

    if (type === 'offer') {
      if (!offer_amount || typeof offer_amount !== 'number' || offer_amount <= 0) {
        return NextResponse.json(
          { error: 'offer_amount must be a positive number for offers' },
          { status: 400 }
        )
      }
    }

    // Validate optional buyer info
    if (buyer_name && typeof buyer_name !== 'string') {
      return NextResponse.json(
        { error: 'buyer_name must be a string' },
        { status: 400 }
      )
    }

    if (buyer_email && typeof buyer_email !== 'string') {
      return NextResponse.json(
        { error: 'buyer_email must be a string' },
        { status: 400 }
      )
    }

    // Basic email validation if provided
    if (buyer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer_email)) {
      return NextResponse.json(
        { error: 'buyer_email must be a valid email address' },
        { status: 400 }
      )
    }

    // If sell_list_item_id is provided, verify it belongs to this sell list
    if (sell_list_item_id) {
      const { data: item, error: itemError } = await supabase
        .from('sell_list_items')
        .select('id')
        .eq('id', sell_list_item_id)
        .eq('sell_list_id', sellList.id)
        .single()

      if (itemError || !item) {
        return NextResponse.json(
          { error: 'Invalid sell_list_item_id for this sell list' },
          { status: 400 }
        )
      }
    }

    // Create interaction
    const { data: interaction, error } = await supabase
      .from('sell_list_interactions')
      .insert({
        sell_list_id: sellList.id,
        sell_list_item_id: sell_list_item_id || null,
        type,
        buyer_name: buyer_name?.trim() || null,
        buyer_email: buyer_email?.trim() || null,
        message: message?.trim() || null,
        offer_amount: type === 'offer' ? offer_amount : null,
      })
      .select()
      .single()

    if (error) {
      console.error('[Sell Lists Public API] Create interaction error:', error)
      throw new Error(`Failed to create interaction: ${error.message}`)
    }

    return NextResponse.json({ interaction }, { status: 201 })
  } catch (error: any) {
    console.error('[Sell Lists Public API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sell-lists/public/[shareToken]/interactions
 * Fetch interactions for a sell list (if comments are publicly visible)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const supabase = await createClient()
    const { shareToken } = await params

    // Verify sell list exists and check if comments are allowed
    const { data: sellList, error: listError } = await supabase
      .from('sell_lists')
      .select('id, allow_comments')
      .eq('share_token', shareToken)
      .single()

    if (listError || !sellList) {
      return NextResponse.json(
        { error: 'Sell list not found' },
        { status: 404 }
      )
    }

    if (!sellList.allow_comments) {
      return NextResponse.json(
        { error: 'Comments are not publicly visible for this sell list' },
        { status: 403 }
      )
    }

    // Fetch only comments (not offers) that are publicly visible
    const { data: interactions, error } = await supabase
      .from('sell_list_interactions')
      .select('id, type, buyer_name, message, created_at, sell_list_item_id')
      .eq('sell_list_id', sellList.id)
      .eq('type', 'comment')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Sell Lists Public API] Fetch interactions error:', error)
      throw new Error(`Failed to fetch interactions: ${error.message}`)
    }

    return NextResponse.json({ interactions: interactions || [] })
  } catch (error: any) {
    console.error('[Sell Lists Public API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
