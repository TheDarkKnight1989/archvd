// Sell List Items API - Add multiple items to a sell list
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/sell-lists/[id]/items
 * Add one or more items to a sell list
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: sellListId } = await params

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
    const { inventory_item_ids } = body

    // Validate input
    if (!Array.isArray(inventory_item_ids) || inventory_item_ids.length === 0) {
      return NextResponse.json(
        { error: 'inventory_item_ids must be a non-empty array' },
        { status: 400 }
      )
    }

    // Verify sell list exists and user owns it
    const { data: sellList, error: listError } = await supabase
      .from('sell_lists')
      .select('id')
      .eq('id', sellListId)
      .eq('user_id', user.id)
      .single()

    if (listError || !sellList) {
      return NextResponse.json(
        { error: 'Sell list not found or access denied' },
        { status: 404 }
      )
    }

    // Verify all inventory items exist and belong to user
    const { data: inventoryItems, error: inventoryError } = await supabase
      .from('Inventory')
      .select('id')
      .in('id', inventory_item_ids)
      .eq('user_id', user.id)

    if (inventoryError) {
      console.error('[Sell Lists API] Inventory fetch error:', inventoryError)
      throw new Error(`Failed to verify inventory items: ${inventoryError.message}`)
    }

    if (!inventoryItems || inventoryItems.length !== inventory_item_ids.length) {
      return NextResponse.json(
        { error: 'One or more inventory items not found or access denied' },
        { status: 404 }
      )
    }

    // Get current max position
    const { data: maxPositionData } = await supabase
      .from('sell_list_items')
      .select('position')
      .eq('sell_list_id', sellListId)
      .order('position', { ascending: false })
      .limit(1)

    const startPosition = (maxPositionData?.[0]?.position ?? -1) + 1

    // Prepare items to insert
    const itemsToInsert = inventory_item_ids.map((inventoryItemId, index) => ({
      sell_list_id: sellListId,
      inventory_item_id: inventoryItemId,
      position: startPosition + index,
    }))

    // Insert items (using upsert to handle duplicates gracefully)
    const { data: insertedItems, error: insertError } = await supabase
      .from('sell_list_items')
      .upsert(itemsToInsert, {
        onConflict: 'sell_list_id,inventory_item_id',
        ignoreDuplicates: false,
      })
      .select()

    if (insertError) {
      console.error('[Sell Lists API] Insert error:', insertError)
      throw new Error(`Failed to add items to sell list: ${insertError.message}`)
    }

    return NextResponse.json(
      {
        items: insertedItems,
        count: insertedItems?.length || 0
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Sell Lists API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
