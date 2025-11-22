/**
 * @deprecated Use /api/v1/items/[id]/mark-sold instead
 * Maintained for backwards compatibility
 *
 * Mark as Sold API - Updates inventory item to sold status
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
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      )
    }

    const { id: itemId } = await params

    // Parse request body
    const body = await request.json()

    // Use Zod validation (backwards compatible with old validation)
    const validation = markAsSoldSchema.safeParse(body)
    if (!validation.success) {
      // Return old-style error format for backwards compatibility
      const firstError = validation.error.issues[0]
      return NextResponse.json(
        { error: firstError.message },
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

    // Verify item exists and belongs to user (fetch full details for transaction)
    const { data: existingItem, error: fetchError } = await supabase
      .from('Inventory')
      .select('id, user_id, status, sku, size_uk, brand, model, colorway, image_url')
      .eq('id', itemId)
      .single()

    if (fetchError || !existingItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    if (existingItem.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this item' },
        { status: 403 }
      )
    }

    if (existingItem.status === 'sold') {
      return NextResponse.json(
        { error: 'Item is already marked as sold' },
        { status: 400 }
      )
    }

    // Fetch user's base currency
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('base_currency')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[Mark as Sold] Profile fetch error:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    const baseCurrency = profile?.base_currency || 'GBP'

    // Calculate FX rate and sale amount in base currency using database function
    const { data: fxData, error: fxError } = await supabase
      .rpc('fx_rate_for', {
        date_in: sold_date,
        from_ccy: sale_currency,
        to_ccy: baseCurrency
      })

    if (fxError) {
      console.error('[Mark as Sold] FX rate error:', fxError)
      return NextResponse.json(
        { error: `Failed to calculate FX rate: ${fxError.message}` },
        { status: 500 }
      )
    }

    const saleFxRate = fxData || 1.0
    const saleAmountBase = sold_price * saleFxRate

    // Update item to sold status with FX snapshot
    const totalFees = (fees || 0) + (shipping || 0)

    const updatePayload = {
      status: 'sold',
      sold_price: sold_price,
      sale_price: sold_price, // Backwards compatibility
      platform: platform || null,
      sales_fee: totalFees,
      notes: notes || null,
      // FX snapshot
      sale_date: sold_date,
      sale_currency: sale_currency,
      sale_base_ccy: baseCurrency,
      sale_fx_rate: saleFxRate,
      sale_amount_base: saleAmountBase,
      sale_fx_source: 'auto',
      updated_at: new Date().toISOString()
    }

    console.log('[Mark as Sold] Updating item with payload:', JSON.stringify(updatePayload, null, 2))

    const { data: updatedItem, error: updateError } = await supabase
      .from('Inventory')
      .update(updatePayload)
      .eq('id', itemId)
      .select()
      .single()

    if (updateError) {
      console.error('[Mark as Sold] Update error:', JSON.stringify(updateError, null, 2))
      await db.logApp('error', 'api:mark-sold', 'Failed to update item', {
        itemId,
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint
      }, user.id)
      return NextResponse.json(
        {
          error: 'Failed to update item',
          details: updateError.message,
          code: updateError.code,
          hint: updateError.hint
        },
        { status: 500 }
      )
    }

    // Log FX conversion audit trail
    const { error: auditError } = await supabase
      .from('fx_audit_log')
      .insert({
        user_id: user.id,
        table_name: 'inventory',
        record_id: itemId,
        field_prefix: 'sale',
        original_currency: sale_currency,
        original_amount: sold_price,
        base_currency: baseCurrency,
        fx_rate: saleFxRate,
        fx_date: sold_date,
        base_amount: saleAmountBase,
        fx_source: 'auto'
      })

    if (auditError) {
      console.error('[Mark as Sold] Audit log error:', auditError)
      // Don't fail the request if audit logging fails, just log the error
    }

    // Create transaction record for sale
    const title = [existingItem.brand, existingItem.model, existingItem.colorway]
      .filter(Boolean)
      .join(' ')

    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'sale',
        inventory_id: itemId,
        sku: existingItem.sku || null,
        size_uk: existingItem.size_uk || null,
        title: title || null,
        image_url: existingItem.image_url || null,
        qty: 1,
        unit_price: saleAmountBase, // Store in base currency
        fees: fees,
        platform: platform || null,
        notes: notes || null,
        occurred_at: sold_date,
      })

    if (transactionError) {
      console.error('[Mark as Sold] Transaction creation error:', transactionError)
      // Don't fail the request if transaction creation fails, just log the error
    }

    // Log successful operation
    await db.logApp('info', 'api:mark-sold', 'Item marked as sold', {
      itemId,
      saleAmount: saleAmountBase,
      baseCurrency
    }, user.id)

    return NextResponse.json({
      success: true,
      item: updatedItem,
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
