/**
 * /api/v1/items/[id]/mark-sold
 *
 * Mark inventory item as sold - Production-grade implementation
 * - Zod validation
 * - Writes to sales table (via trigger)
 * - API request logging
 * - FX snapshot with base currency conversion
 * - Backwards compatible response format
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { markAsSoldSchema, formatValidationError, type MarkAsSoldInput } from '@/lib/validators'
import { createFxSnapshot } from '@/lib/fx'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  let userId: string | undefined

  try {
    const supabase = await createClient()

    // Auth guard
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Please sign in' },
        { status: 401 }
      )
    }

    userId = user.id
    const { id: itemId } = await params

    // Parse and validate request body
    const body = await request.json()
    let validatedInput: MarkAsSoldInput

    try {
      validatedInput = markAsSoldSchema.parse(body)
    } catch (error: any) {
      const formattedError = formatValidationError(error)

      // Log API request (validation failure)
      await db.logApp('warn', 'api:v1:mark-sold', 'Validation failed', {
        itemId,
        errors: formattedError.details
      }, userId)

      return NextResponse.json(formattedError, { status: 400 })
    }

    // Verify item exists and belongs to user
    const { data: existingItem, error: fetchError } = await supabase
      .from('Inventory')
      .select('id, user_id, status, purchase_price, purchase_currency, purchase_date, purchase_total_base, fx_rate_at_purchase')
      .eq('id', itemId)
      .single()

    if (fetchError || !existingItem) {
      await db.logApp('warn', 'api:v1:mark-sold', 'Item not found', { itemId }, userId)
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Item not found' },
        { status: 404 }
      )
    }

    if (existingItem.user_id !== user.id) {
      await db.logApp('warn', 'api:v1:mark-sold', 'Forbidden - user does not own item', {
        itemId,
        ownerId: existingItem.user_id
      }, userId)
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'You do not own this item' },
        { status: 403 }
      )
    }

    if (existingItem.status === 'sold') {
      await db.logApp('warn', 'api:v1:mark-sold', 'Item already sold', { itemId }, userId)
      return NextResponse.json(
        { code: 'ALREADY_SOLD', message: 'Item is already marked as sold' },
        { status: 400 }
      )
    }

    // Get user's base currency
    const baseCurrency = await db.getUserBaseCurrency(userId)

    // Create FX snapshot for the sale
    const saleFxSnapshot = await createFxSnapshot(
      userId,
      validatedInput.sold_price,
      validatedInput.sale_currency || 'GBP',
      validatedInput.sold_date,
      'auto'
    )

    // Also create FX snapshot for fees and shipping if provided
    const feesFxSnapshot = validatedInput.fees && validatedInput.fees > 0
      ? await createFxSnapshot(userId, validatedInput.fees, validatedInput.sale_currency || 'GBP', validatedInput.sold_date, 'auto')
      : null

    const shippingFxSnapshot = validatedInput.shipping && validatedInput.shipping > 0
      ? await createFxSnapshot(userId, validatedInput.shipping, validatedInput.sale_currency || 'GBP', validatedInput.sold_date, 'auto')
      : null

    // Update Inventory to sold status
    // The trg_inventory_mark_sold trigger will automatically create the sales record
    const { data: updatedItem, error: updateError } = await supabase
      .from('Inventory')
      .update({
        status: 'sold',
        sold_price: validatedInput.sold_price,
        sold_date: validatedInput.sold_date,
        platform: validatedInput.platform || null,
        sales_fee: validatedInput.fees || 0,
        notes: validatedInput.notes || null,
        // FX snapshot fields for backwards compatibility
        sale_date: validatedInput.sold_date,
        sale_currency: validatedInput.sale_currency || 'GBP',
        sale_base_ccy: saleFxSnapshot.baseCurrency,
        sale_fx_rate: saleFxSnapshot.fxRate,
        sale_amount_base: saleFxSnapshot.baseAmount,
        sale_fx_source: 'auto',
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single()

    if (updateError) {
      await db.logApp('error', 'api:v1:mark-sold', 'Failed to update inventory', {
        itemId,
        error: updateError.message
      }, userId)

      return NextResponse.json(
        { code: 'UPDATE_FAILED', message: 'Failed to update item', details: updateError.message },
        { status: 500 }
      )
    }

    // Fetch the auto-created sales record
    const { data: salesRecord, error: salesError } = await supabase
      .from('sales')
      .select('id, sale_total_base, fees_base, shipping_base, purchase_total_base, profit_base')
      .eq('inventory_id', itemId)
      .single()

    if (salesError) {
      // Log but don't fail - the trigger might not have run yet or there's a timing issue
      await db.logApp('warn', 'api:v1:mark-sold', 'Sales record not found after trigger', {
        itemId,
        error: salesError.message
      }, userId)
    }

    // Log FX conversion to audit trail
    const { error: auditError } = await supabase
      .from('fx_audit_log')
      .insert({
        user_id: userId,
        table_name: 'inventory',
        record_id: itemId,
        field_prefix: 'sale',
        original_currency: saleFxSnapshot.originalCurrency,
        original_amount: saleFxSnapshot.originalAmount,
        base_currency: saleFxSnapshot.baseCurrency,
        fx_rate: saleFxSnapshot.fxRate,
        fx_date: validatedInput.sold_date,
        base_amount: saleFxSnapshot.baseAmount,
        fx_source: 'auto'
      })

    if (auditError) {
      // Don't fail request, just log
      await db.logApp('warn', 'api:v1:mark-sold', 'Failed to log FX audit', {
        itemId,
        error: auditError.message
      }, userId)
    }

    // Log successful API request
    const duration = Date.now() - startTime
    await db.logApp('info', 'api:v1:mark-sold', 'Item marked as sold successfully', {
      itemId,
      salesId: salesRecord?.id,
      duration,
      saleAmount: saleFxSnapshot.baseAmount,
      profit: salesRecord?.profit_base
    }, userId)

    // Return backwards-compatible response with extended sales info
    return NextResponse.json({
      success: true,
      item: updatedItem,
      sales_id: salesRecord?.id,
      fx_info: {
        original_currency: saleFxSnapshot.originalCurrency,
        original_amount: saleFxSnapshot.originalAmount,
        base_currency: saleFxSnapshot.baseCurrency,
        fx_rate: saleFxSnapshot.fxRate,
        base_amount: saleFxSnapshot.baseAmount
      },
      accounting: salesRecord ? {
        sale_total_base: salesRecord.sale_total_base,
        fees_base: salesRecord.fees_base,
        shipping_base: salesRecord.shipping_base,
        purchase_total_base: salesRecord.purchase_total_base,
        profit_base: salesRecord.profit_base
      } : null
    })

  } catch (error: any) {
    // Log fatal error
    if (userId) {
      await db.logApp('error', 'api:v1:mark-sold', 'Internal server error', {
        error: error.message,
        stack: error.stack
      }, userId)
    }

    console.error('[API v1 Mark as Sold] Error:', error)
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
