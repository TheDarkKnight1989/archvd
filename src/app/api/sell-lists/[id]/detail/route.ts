// Sell List Detail API - Get full sell list with items and inventory details
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/sell-lists/[id]/detail
 * Fetch a sell list with all items and their full inventory details
 */
export async function GET(
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

    // Fetch sell list
    const { data: sellList, error: listError } = await supabase
      .from('sell_lists')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (listError) {
      if (listError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Sell list not found or access denied' },
          { status: 404 }
        )
      }
      console.error('[Sell Lists API] Fetch error:', listError)
      throw new Error(`Failed to fetch sell list: ${listError.message}`)
    }

    // Fetch sell list items with inventory details
    const { data: items, error: itemsError } = await supabase
      .from('sell_list_items')
      .select(`
        id,
        asking_price,
        position,
        created_at,
        inventory_item:Inventory (
          id,
          sku,
          brand,
          model,
          colorway,
          style_id,
          size,
          size_uk,
          size_alt,
          category,
          condition,
          purchase_price,
          custom_market_value,
          status,
          created_at
        )
      `)
      .eq('sell_list_id', id)
      .order('position', { ascending: true })

    if (itemsError) {
      console.error('[Sell Lists API] Items fetch error:', itemsError)
      throw new Error(`Failed to fetch sell list items: ${itemsError.message}`)
    }

    // Fetch interactions count
    const { count: interactionsCount, error: countError } = await supabase
      .from('sell_list_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('sell_list_id', id)

    if (countError) {
      console.error('[Sell Lists API] Interactions count error:', countError)
      // Don't throw, just default to 0
    }

    return NextResponse.json({
      sellList: {
        ...sellList,
        items: items || [],
        interactions_count: interactionsCount || 0,
      },
    })
  } catch (error: any) {
    console.error('[Sell Lists API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
