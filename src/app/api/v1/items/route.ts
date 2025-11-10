/**
 * /api/v1/items
 *
 * Create new inventory item - Production-grade implementation
 * - Zod validation
 * - FX snapshot with base currency conversion
 * - API request logging
 * - Backwards compatible response format
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createItemSchema, formatValidationError, type CreateItemInput } from '@/lib/validators'
import { createFxSnapshot } from '@/lib/fx'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    let validatedInput: CreateItemInput

    try {
      validatedInput = createItemSchema.parse(body)
    } catch (error: any) {
      const formattedError = formatValidationError(error)

      // Log API request (validation failure)
      await db.logApp('warn', 'api:v1:items:create', 'Validation failed', {
        errors: formattedError.details
      }, userId)

      return NextResponse.json(formattedError, { status: 400 })
    }

    // Get user's base currency
    const baseCurrency = await db.getUserBaseCurrency(userId)

    // Create FX snapshot for purchase amount
    const purchaseFxSnapshot = await createFxSnapshot(
      userId,
      validatedInput.purchase_price,
      validatedInput.purchase_currency || 'GBP',
      validatedInput.purchase_date || new Date().toISOString().split('T')[0],
      'auto'
    )

    // Calculate total purchase cost (price + tax + shipping)
    const totalPurchaseCost = validatedInput.purchase_price +
      (validatedInput.tax || 0) +
      (validatedInput.shipping || 0)

    // Create FX snapshot for total if different from price
    const totalFxSnapshot = totalPurchaseCost !== validatedInput.purchase_price
      ? await createFxSnapshot(
          userId,
          totalPurchaseCost,
          validatedInput.purchase_currency || 'GBP',
          validatedInput.purchase_date || new Date().toISOString().split('T')[0],
          'auto'
        )
      : purchaseFxSnapshot

    // Build database row
    const inventoryRow = {
      user_id: userId,
      sku: validatedInput.sku,
      brand: validatedInput.brand || null,
      model: validatedInput.model || null,
      size_uk: validatedInput.size_uk || validatedInput.size || null,
      size: validatedInput.size || validatedInput.size_uk || null,
      category: validatedInput.category || 'sneaker',
      condition: validatedInput.condition || null,
      purchase_price: validatedInput.purchase_price,
      purchase_currency: validatedInput.purchase_currency || 'GBP',
      purchase_date: validatedInput.purchase_date || null,
      tax: validatedInput.tax || null,
      shipping: validatedInput.shipping || null,
      place_of_purchase: validatedInput.place_of_purchase || null,
      order_number: validatedInput.order_number || null,
      location: validatedInput.location || null,
      notes: validatedInput.notes || null,
      tags: validatedInput.tags || null,
      custom_market_value: validatedInput.custom_market_value || null,
      status: 'active' as const,
      // FX snapshot fields
      purchase_total_base: totalFxSnapshot.baseAmount,
      fx_rate_at_purchase: totalFxSnapshot.fxRate
    }

    // Insert into database
    const { data: newItem, error: insertError } = await supabase
      .from('Inventory')
      .insert(inventoryRow)
      .select()
      .single()

    if (insertError) {
      await db.logApp('error', 'api:v1:items:create', 'Failed to insert item', {
        error: insertError.message,
        code: insertError.code
      }, userId)

      return NextResponse.json(
        {
          code: 'INSERT_FAILED',
          message: 'Failed to create item',
          details: insertError.message
        },
        { status: 400 }
      )
    }

    // Log FX conversion to audit trail
    const { error: auditError } = await supabase
      .from('fx_audit_log')
      .insert({
        user_id: userId,
        table_name: 'inventory',
        record_id: newItem.id,
        field_prefix: 'purchase',
        original_currency: purchaseFxSnapshot.originalCurrency,
        original_amount: totalPurchaseCost,
        base_currency: purchaseFxSnapshot.baseCurrency,
        fx_rate: totalFxSnapshot.fxRate,
        fx_date: validatedInput.purchase_date || new Date().toISOString().split('T')[0],
        base_amount: totalFxSnapshot.baseAmount,
        fx_source: 'auto'
      })

    if (auditError) {
      // Don't fail request, just log
      await db.logApp('warn', 'api:v1:items:create', 'Failed to log FX audit', {
        itemId: newItem.id,
        error: auditError.message
      }, userId)
    }

    // Log successful API request
    const duration = Date.now() - startTime
    await db.logApp('info', 'api:v1:items:create', 'Item created successfully', {
      itemId: newItem.id,
      sku: validatedInput.sku,
      duration,
      purchaseAmount: totalFxSnapshot.baseAmount
    }, userId)

    // Return backwards-compatible response
    return NextResponse.json(
      {
        success: true,
        item: newItem,
        fx_info: {
          original_currency: purchaseFxSnapshot.originalCurrency,
          original_amount: totalPurchaseCost,
          base_currency: purchaseFxSnapshot.baseCurrency,
          fx_rate: totalFxSnapshot.fxRate,
          base_amount: totalFxSnapshot.baseAmount
        }
      },
      { status: 201 }
    )

  } catch (error: any) {
    // Log fatal error
    if (userId) {
      await db.logApp('error', 'api:v1:items:create', 'Internal server error', {
        error: error.message,
        stack: error.stack
      }, userId)
    }

    console.error('[API v1 Create Item] Error:', error)
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/items
 * List inventory items with filtering and pagination
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const brand = searchParams.get('brand')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'created_at'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

    // Build query
    let query = supabase
      .from('Inventory')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (brand) {
      query = query.eq('brand', brand)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (search) {
      query = query.or(`sku.ilike.%${search}%,model.ilike.%${search}%,brand.ilike.%${search}%`)
    }

    // Apply sorting
    const sortColumn = sort === 'purchase_price' ? 'purchase_price'
      : sort === 'sold_date' ? 'sold_date'
      : 'created_at'
    query = query.order(sortColumn, { ascending: false })

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    // Execute query
    const { data: items, error: fetchError, count } = await query

    if (fetchError) {
      await db.logApp('error', 'api:v1:items:list', 'Failed to fetch items', {
        error: fetchError.message
      }, userId)

      return NextResponse.json(
        { code: 'FETCH_FAILED', message: 'Failed to fetch items', details: fetchError.message },
        { status: 500 }
      )
    }

    // Log successful request
    const duration = Date.now() - startTime
    await db.logApp('info', 'api:v1:items:list', 'Items listed successfully', {
      count: items?.length || 0,
      total: count,
      duration,
      filters: { status, brand, category, search }
    }, userId)

    return NextResponse.json({
      success: true,
      items: items || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: any) {
    // Log fatal error
    if (userId) {
      await db.logApp('error', 'api:v1:items:list', 'Internal server error', {
        error: error.message,
        stack: error.stack
      }, userId)
    }

    console.error('[API v1 List Items] Error:', error)
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
