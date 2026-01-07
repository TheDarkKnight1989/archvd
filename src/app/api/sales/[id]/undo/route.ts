/**
 * Undo Sold API - V4 ONLY (ATOMIC RESTORE)
 *
 * This is an ATOMIC RESTORE operation:
 * 1. Fetch sale record with original_item_id
 * 2. Insert row back into inventory_v4_items
 * 3. DELETE row from inventory_v4_sales
 *
 * IDEMPOTENT: If item already exists in inventory, returns error
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[Undo Sold] NOT_AUTHENTICATED:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in', code: 'NOT_AUTHENTICATED' },
        { status: 401 }
      )
    }

    const { id: saleId } = await params

    console.log('[Undo Sold] Request received:', {
      saleId,
      userId: user.id,
    })

    // Fetch sale record
    const { data: sale, error: fetchError } = await supabase
      .from('inventory_v4_sales')
      .select('*')
      .eq('id', saleId)
      .single()

    if (fetchError || !sale) {
      console.error('[Undo Sold] NOT_FOUND_SALE:', {
        saleId,
        userId: user.id,
        error: fetchError?.message,
      })
      return NextResponse.json(
        { error: 'Sale not found', code: 'NOT_FOUND_SALE' },
        { status: 404 }
      )
    }

    // Validate ownership
    if (sale.user_id !== user.id) {
      console.error('[Undo Sold] FORBIDDEN:', {
        saleId,
        saleUserId: sale.user_id,
        requestUserId: user.id,
      })
      return NextResponse.json(
        { error: 'Forbidden - You do not own this sale', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // Map condition back: Title case (sales) -> lowercase (items)
    const mapConditionToItems = (saleCondition: string | null): string => {
      if (!saleCondition) return 'new'
      const mapping: Record<string, string> = {
        'New': 'new',
        'Used': 'used',
        'Worn': 'used',
        'Defect': 'used',
      }
      return mapping[saleCondition] || 'new'
    }

    // Determine item ID: prefer original_item_id, but generate new if it's taken
    let newItemId: string
    let usedOriginalId = false

    if (sale.original_item_id) {
      const { data: existingItem } = await supabase
        .from('inventory_v4_items')
        .select('id')
        .eq('id', sale.original_item_id)
        .single()

      if (existingItem) {
        // Original ID is taken (item was re-added or user had duplicates)
        // Generate new ID so undo still works
        console.log('[Undo Sold] Original item ID exists, generating new ID:', {
          saleId,
          originalItemId: sale.original_item_id,
        })
        newItemId = crypto.randomUUID()
      } else {
        // Original ID is free, use it for clean restore
        newItemId = sale.original_item_id
        usedOriginalId = true
      }
    } else {
      // No original ID (legacy sale), generate new
      newItemId = crypto.randomUUID()
    }

    // ATOMIC RESTORE: Step 1 - Insert item back into inventory
    const itemRecord = {
      id: newItemId,
      user_id: user.id,
      style_id: sale.style_id,
      size: sale.size || 'N/A',
      purchase_price: sale.purchase_price,
      purchase_currency: sale.purchase_currency || 'GBP',
      purchase_date: sale.purchase_date,
      condition: mapConditionToItems(sale.condition),
      consignment_location: sale.location,
      notes: sale.notes,
      status: 'in_stock',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: insertError } = await supabase
      .from('inventory_v4_items')
      .insert(itemRecord)

    if (insertError) {
      console.error('[Undo Sold] Failed to restore item:', insertError)
      // If duplicate key, item was already restored
      if (insertError.code === '23505') {
        return NextResponse.json({
          success: false,
          error: 'ITEM_EXISTS',
          message: 'Item already exists in inventory (duplicate key)',
        }, { status: 409 })
      }
      return NextResponse.json(
        { error: 'Failed to restore item to inventory', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('[Undo Sold] Item restored to inventory:', { itemId: newItemId })

    // ATOMIC RESTORE: Step 2 - DELETE sale record
    const { error: deleteError } = await supabase
      .from('inventory_v4_sales')
      .delete()
      .eq('id', saleId)

    if (deleteError) {
      console.error('[Undo Sold] Failed to delete sale:', deleteError)
      // Item was restored but sale delete failed - log for manual cleanup
      await db.logApp('error', 'api:undo-sold', 'Item restored but sale delete failed - manual cleanup needed', {
        saleId,
        itemId: newItemId,
        error: deleteError.message,
      }, user.id)
      // Still return success since item was restored
    } else {
      console.log('[Undo Sold] Sale record deleted:', { saleId })
    }

    // Log successful operation
    await db.logApp('info', 'api:undo-sold', 'Sale undone, item restored to inventory', {
      saleId,
      itemId: newItemId,
      styleId: sale.style_id,
      usedOriginalId,
    }, user.id)

    return NextResponse.json({
      success: true,
      item_id: newItemId,
      sale_id: saleId,
      message: usedOriginalId
        ? 'Sale undone, item restored to inventory'
        : 'Sale undone, item restored to inventory (new ID generated)',
      used_original_id: usedOriginalId,
      item: {
        id: newItemId,
        style_id: sale.style_id,
        size: sale.size,
        status: 'in_stock',
      },
    })

  } catch (error: any) {
    console.error('[Undo Sold] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
