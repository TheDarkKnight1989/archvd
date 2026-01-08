/**
 * Sales API - V4 ONLY
 * PATCH: Update sale details (with FX recalculation)
 * DELETE: Permanently remove sale record
 * No V3 table references.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Normalize platform names for consistency.
 * - goat → alias (GOAT is the Alias marketplace)
 */
function normalizePlatform(platform: string | undefined): string | undefined {
  if (!platform) return platform
  const lower = platform.toLowerCase()
  if (lower === 'goat') return 'alias'
  return platform
}

/**
 * Calculate FX rate from sale currency to GBP (base currency)
 * Returns { fx_rate_to_base, sold_price_base }
 */
async function calculateFxFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  saleCurrency: string,
  soldPrice: number
): Promise<{ fx_rate_to_base: number; sold_price_base: number }> {
  // If already GBP, no conversion needed
  if (saleCurrency === 'GBP') {
    return { fx_rate_to_base: 1, sold_price_base: soldPrice }
  }

  // Fetch latest FX rates
  const { data: rates, error } = await supabase
    .from('fx_rates')
    .select('usd_per_gbp, eur_per_gbp')
    .order('as_of', { ascending: false })
    .limit(1)
    .single()

  if (error || !rates) {
    console.warn('[Sales API] Could not fetch FX rates, using defaults')
    // Fallback defaults
    const defaults: Record<string, number> = {
      USD: 0.79, // gbp per usd
      EUR: 0.85, // gbp per eur
    }
    const rate = defaults[saleCurrency] || 1
    return { fx_rate_to_base: rate, sold_price_base: soldPrice * rate }
  }

  // Calculate rate from sale_currency to GBP
  let fxRateToBase = 1
  if (saleCurrency === 'USD') {
    // gbp_per_usd = 1 / usd_per_gbp
    fxRateToBase = 1 / parseFloat(rates.usd_per_gbp)
  } else if (saleCurrency === 'EUR') {
    // gbp_per_eur = 1 / eur_per_gbp
    fxRateToBase = 1 / parseFloat(rates.eur_per_gbp)
  }

  return {
    fx_rate_to_base: fxRateToBase,
    sold_price_base: soldPrice * fxRateToBase,
  }
}

export async function PATCH(
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

    const { id: saleId } = await params

    // Parse request body
    const body = await request.json()

    // Verify sale exists and belongs to user (V4 ONLY)
    // Fetch existing values for FX recalculation
    const { data: existingSale, error: fetchError } = await supabase
      .from('inventory_v4_sales')
      .select('id, user_id, sold_price, sale_currency')
      .eq('id', saleId)
      .single()

    if (fetchError || !existingSale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      )
    }

    if (existingSale.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this sale' },
        { status: 403 }
      )
    }

    // Build update payload from body
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    // Only update fields that are provided
    if (body.sold_price !== undefined) {
      updatePayload.sold_price = body.sold_price
    }

    if (body.sale_currency !== undefined) {
      updatePayload.sale_currency = body.sale_currency
    }

    if (body.sold_date !== undefined) {
      updatePayload.sold_date = body.sold_date
    }

    if (body.platform !== undefined) {
      // Normalize platform (goat → alias)
      updatePayload.platform = normalizePlatform(body.platform)
    }

    if (body.sales_fee !== undefined) {
      updatePayload.sales_fee = body.sales_fee
    }

    if (body.purchase_price !== undefined) {
      updatePayload.purchase_price = body.purchase_price
    }

    if (body.notes !== undefined) {
      updatePayload.notes = body.notes
    }

    // Recalculate FX fields if price or currency changed
    const priceChanged = body.sold_price !== undefined
    const currencyChanged = body.sale_currency !== undefined

    if (priceChanged || currencyChanged) {
      // Use new values if provided, otherwise fall back to existing
      const finalPrice = body.sold_price ?? existingSale.sold_price
      const finalCurrency = body.sale_currency ?? existingSale.sale_currency ?? 'GBP'

      const fxFields = await calculateFxFields(supabase, finalCurrency, finalPrice)
      updatePayload.fx_rate_to_base = fxFields.fx_rate_to_base
      updatePayload.sold_price_base = fxFields.sold_price_base
      updatePayload.base_currency = 'GBP'

      console.log('[Edit Sale V4] Recalculated FX:', {
        finalPrice,
        finalCurrency,
        fx_rate_to_base: fxFields.fx_rate_to_base,
        sold_price_base: fxFields.sold_price_base,
      })
    }

    console.log('[Edit Sale V4] Updating sale with payload:', JSON.stringify(updatePayload, null, 2))

    // Update V4 sale record
    const { data: updatedSale, error: updateError } = await supabase
      .from('inventory_v4_sales')
      .update(updatePayload)
      .eq('id', saleId)
      .select()
      .single()

    if (updateError) {
      console.error('[Edit Sale V4] Update error:', JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        {
          error: 'Failed to update sale',
          details: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      )
    }

    console.log('[Edit Sale V4] Sale updated successfully')

    return NextResponse.json({
      success: true,
      sale: updatedSale,
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Edit Sale V4] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}

/**
 * Delete a sale record permanently.
 * Note: Prefer using POST /api/sales/[id]/undo which restores the item to inventory.
 * This DELETE endpoint is for cases where you want to remove the sale without restoring.
 */
export async function DELETE(
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

    const { id: saleId } = await params

    // Verify sale exists and belongs to user
    const { data: existingSale, error: fetchError } = await supabase
      .from('inventory_v4_sales')
      .select('id, user_id, style_id, size, sold_price')
      .eq('id', saleId)
      .single()

    if (fetchError || !existingSale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      )
    }

    if (existingSale.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this sale' },
        { status: 403 }
      )
    }

    // Delete the sale record
    const { error: deleteError } = await supabase
      .from('inventory_v4_sales')
      .delete()
      .eq('id', saleId)

    if (deleteError) {
      console.error('[Delete Sale V4] Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete sale', details: deleteError.message },
        { status: 500 }
      )
    }

    console.log('[Delete Sale V4] Sale deleted:', {
      saleId,
      style_id: existingSale.style_id,
      size: existingSale.size,
    })

    return NextResponse.json({
      success: true,
      message: 'Sale deleted permanently',
      deleted: {
        id: saleId,
        style_id: existingSale.style_id,
        size: existingSale.size,
        sold_price: existingSale.sold_price,
      },
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Delete Sale V4] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}
