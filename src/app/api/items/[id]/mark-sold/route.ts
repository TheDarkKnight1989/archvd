/**
 * Mark as Sold API - V4 ONLY (ATOMIC MOVE)
 *
 * This is an ATOMIC MOVE operation:
 * 1. Insert row into inventory_v4_sales (with original_item_id)
 * 2. DELETE row from inventory_v4_items
 * 3. DELETE any listings for this item
 *
 * IDEMPOTENT: If item already has a sale record, returns 200 with { already_sold: true }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { markAsSoldSchema } from '@/lib/validators'
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
      console.error('[Mark as Sold] NOT_AUTHENTICATED:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in', code: 'NOT_AUTHENTICATED' },
        { status: 401 }
      )
    }

    const { id: itemId } = await params

    console.log('[Mark as Sold] Request received:', {
      itemId,
      userId: user.id,
    })

    // Parse request body
    const body = await request.json()

    // Use Zod validation
    const validation = markAsSoldSchema.safeParse(body)
    if (!validation.success) {
      const firstError = validation.error.issues[0]
      console.error('[Mark as Sold] Validation failed:', validation.error.issues)
      return NextResponse.json(
        { error: firstError.message, code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const {
      sold_price,
      sold_date,
      sale_currency = 'GBP',
      platform,
      fees = 0,
      shipping = 0,
      notes
    } = validation.data

    console.log('[Mark as Sold] Validated input:', {
      itemId,
      sold_price,
      sold_date,
      sale_currency,
      platform,
    })

    // V4 ONLY - fetch from inventory_v4_items
    const { data: v4Item, error: v4FetchError } = await supabase
      .from('inventory_v4_items')
      .select(`
        id,
        user_id,
        status,
        style_id,
        size,
        purchase_price,
        purchase_currency,
        purchase_date,
        condition,
        consignment_location,
        notes,
        inventory_v4_style_catalog (
          style_id,
          brand,
          name,
          colorway,
          primary_image_url,
          product_category
        )
      `)
      .eq('id', itemId)
      .single()

    if (v4FetchError || !v4Item) {
      console.error('[Mark as Sold] NOT_FOUND_V4_ITEM:', {
        itemId,
        userId: user.id,
        error: v4FetchError?.message,
      })
      return NextResponse.json(
        { error: 'Item not found in V4 inventory', code: 'NOT_FOUND_V4_ITEM' },
        { status: 404 }
      )
    }

    console.log('[Mark as Sold] Found V4 item:', {
      itemId: v4Item.id,
      styleId: v4Item.style_id,
      currentStatus: v4Item.status,
      ownerId: v4Item.user_id,
    })

    if (v4Item.user_id !== user.id) {
      console.error('[Mark as Sold] FORBIDDEN:', {
        itemId,
        itemUserId: v4Item.user_id,
        requestUserId: user.id,
      })
      return NextResponse.json(
        { error: 'Forbidden - You do not own this item', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // IDEMPOTENT: Check if sale record already exists for this item
    const { data: existingSale } = await supabase
      .from('inventory_v4_sales')
      .select('id')
      .eq('original_item_id', itemId)
      .single()

    if (existingSale) {
      console.log('[Mark as Sold] Already sold (idempotent):', { itemId, saleId: existingSale.id })
      return NextResponse.json({
        success: true,
        already_sold: true,
        sale_id: existingSale.id,
        item_id: itemId,
        message: 'Item already marked as sold',
      })
    }

    const style = (v4Item as any).inventory_v4_style_catalog

    // Map item condition (lowercase) to sales condition (Title case)
    // inventory_v4_items: 'new', 'used', 'deadstock'
    // inventory_v4_sales: 'New', 'Used', 'Worn', 'Defect'
    const mapConditionToSales = (itemCondition: string | null): string | null => {
      if (!itemCondition) return null
      const mapping: Record<string, string> = {
        'new': 'New',
        'used': 'Used',
        'deadstock': 'New', // deadstock = new condition
        'worn': 'Worn',
        'defect': 'Defect',
        // Also handle Title case input (in case item already has it)
        'New': 'New',
        'Used': 'Used',
        'Worn': 'Worn',
        'Defect': 'Defect',
      }
      return mapping[itemCondition] || null
    }

    // Fetch user's base currency
    const { data: profile } = await supabase
      .from('profiles')
      .select('base_currency')
      .eq('id', user.id)
      .single()

    const baseCurrency = profile?.base_currency || 'GBP'

    // Calculate FX rate
    const { data: fxData, error: fxError } = await supabase
      .rpc('fx_rate_for', {
        date_in: sold_date,
        from_ccy: sale_currency,
        to_ccy: baseCurrency
      })

    if (fxError) {
      console.error('[Mark as Sold] FX rate error:', fxError)
      // Don't fail - use 1.0 as fallback
    }

    const saleFxRate = fxData || 1.0
    const saleAmountBase = sold_price * saleFxRate
    const totalFees = (fees || 0) + (shipping || 0)

    // ATOMIC MOVE: Step 1 - Create sale record FIRST
    const v4SaleRecord = {
      user_id: user.id,
      style_id: v4Item.style_id,
      sku: v4Item.style_id,
      brand: style?.brand || null,
      model: style?.name || null,
      colorway: style?.colorway || null,
      image_url: style?.primary_image_url || null,
      category: style?.product_category || null,
      size: v4Item.size || 'N/A',
      size_unit: 'UK',
      purchase_price: v4Item.purchase_price || null,
      purchase_currency: v4Item.purchase_currency || 'GBP',
      purchase_date: v4Item.purchase_date || null,
      purchase_total: v4Item.purchase_price || null,
      condition: mapConditionToSales(v4Item.condition),
      sold_price: sold_price,
      sale_currency: sale_currency,
      sold_date: sold_date,
      platform: platform || null,
      sales_fee: totalFees,
      shipping_cost: shipping || 0,
      base_currency: baseCurrency,
      fx_rate_to_base: saleFxRate,
      sold_price_base: saleAmountBase,
      notes: notes || null,
      original_item_id: itemId,
      location: v4Item.consignment_location || null,
    }

    const { data: v4Sale, error: v4SaleError } = await supabase
      .from('inventory_v4_sales')
      .insert(v4SaleRecord)
      .select()
      .single()

    if (v4SaleError) {
      console.error('[Mark as Sold] Failed to create sale record:', v4SaleError)
      // If duplicate (unique constraint on original_item_id), return idempotent response
      if (v4SaleError.code === '23505') {
        const { data: dupSale } = await supabase
          .from('inventory_v4_sales')
          .select('id')
          .eq('original_item_id', itemId)
          .single()
        return NextResponse.json({
          success: true,
          already_sold: true,
          sale_id: dupSale?.id,
          item_id: itemId,
          message: 'Item already marked as sold (duplicate detected)',
        })
      }
      return NextResponse.json(
        { error: 'Failed to create sale record', details: v4SaleError.message },
        { status: 500 }
      )
    }

    console.log('[Mark as Sold] Sale record created:', { saleId: v4Sale.id })

    // ATOMIC MOVE: Step 2 - DELETE item from inventory
    const { error: deleteItemError } = await supabase
      .from('inventory_v4_items')
      .delete()
      .eq('id', itemId)

    if (deleteItemError) {
      console.error('[Mark as Sold] Failed to delete item:', deleteItemError)
      // Sale was created but delete failed - log for manual cleanup
      await db.logApp('error', 'api:mark-sold', 'Sale created but item delete failed - manual cleanup needed', {
        itemId,
        saleId: v4Sale.id,
        error: deleteItemError.message,
      }, user.id)
      // Still return success since sale was created
    } else {
      console.log('[Mark as Sold] Item deleted from inventory:', { itemId })
    }

    // ATOMIC MOVE: Step 3 - DELETE any listings for this item
    const { error: deleteListingsError } = await supabase
      .from('inventory_v4_listings')
      .delete()
      .eq('item_id', itemId)

    if (deleteListingsError) {
      console.warn('[Mark as Sold] Failed to delete listings:', deleteListingsError)
      // Non-critical, just log
    } else {
      console.log('[Mark as Sold] Listings deleted')
    }

    // Log FX conversion audit trail (non-blocking)
    supabase
      .from('fx_audit_log')
      .insert({
        user_id: user.id,
        table_name: 'inventory_v4_sales',
        record_id: v4Sale.id,
        field_prefix: 'sale',
        original_currency: sale_currency,
        original_amount: sold_price,
        base_currency: baseCurrency,
        fx_rate: saleFxRate,
        fx_date: sold_date,
        base_amount: saleAmountBase,
        fx_source: 'auto'
      })
      .then(({ error }) => {
        if (error) console.warn('[Mark as Sold] Audit log error:', error)
      })

    // Log successful operation
    await db.logApp('info', 'api:mark-sold', 'Item marked as sold (V4)', {
      itemId,
      saleId: v4Sale.id,
      saleAmount: saleAmountBase,
      baseCurrency
    }, user.id)

    return NextResponse.json({
      success: true,
      sale_id: v4Sale.id,
      item_id: itemId,
      message: 'Item moved to sales',
      sale: {
        id: v4Sale.id,
        sku: v4Item.style_id,
        size_uk: v4Item.size,
        brand: style?.brand,
        model: style?.name,
        colorway: style?.colorway,
        image_url: style?.primary_image_url,
        sold_price,
        sold_date,
        sale_currency,
        platform,
        sales_fee: totalFees,
      },
      fx_info: {
        original_currency: sale_currency,
        original_amount: sold_price,
        base_currency: baseCurrency,
        fx_rate: saleFxRate,
        base_amount: saleAmountBase
      }
    })

  } catch (error: any) {
    console.error('[Mark as Sold] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
