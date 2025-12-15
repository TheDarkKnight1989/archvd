/**
 * Add Item to V4 Inventory
 * POST /api/inventory-v4/add-item
 *
 * Flow:
 * 1. Validate request (styleId, size, etc.)
 * 2. Normalize inputs (styleId uppercase, size trimmed)
 * 3. Check for duplicate items
 * 4. Upsert style catalog entry
 * 5. Insert into inventory_v4_items
 * 6. Enqueue sync jobs for market data
 * 7. Return created item
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'

// =============================================================================
// RUNTIME CONFIG
// =============================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_BRAND_LENGTH = 100
const MAX_NAME_LENGTH = 200
const MAX_COLORWAY_LENGTH = 100

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Normalize size string: trim and convert "10.0" → "10"
 */
function normalizeSize(size: string): string {
  const s = size.trim()
  // If it's a decimal like "10.0", convert to "10"
  if (s.includes('.')) {
    const num = Number(s)
    if (!Number.isNaN(num) && num === Math.floor(num)) {
      return String(Math.floor(num))
    }
  }
  return s
}

/**
 * Validate ISO date string (YYYY-MM-DD or full ISO)
 */
function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  return !Number.isNaN(date.getTime())
}

// =============================================================================
// VALIDATION SCHEMA
// =============================================================================

const requestSchema = z.object({
  // Style info
  styleId: z.string().min(1, 'Style ID (SKU) is required').max(50),

  // Size
  size: z.string().min(1, 'Size is required').max(20),
  sizeUnit: z.enum(['US', 'UK', 'EU']).default('US'),

  // Purchase info
  purchasePrice: z.number().min(0).nullable().optional(),
  purchaseCurrency: z.enum(['GBP', 'USD', 'EUR']).default('GBP'),
  purchaseDate: z
    .string()
    .refine((val) => !val || isValidDate(val), 'Invalid date format')
    .nullable()
    .optional(),

  // Condition
  condition: z.enum(['new', 'used', 'deadstock']).default('new'),

  // Optional notes
  notes: z.string().max(500).nullable().optional(),

  // Style catalog info (for upsert if not exists)
  // Only allow safe fields - IDs come from sync pipeline
  styleCatalog: z
    .object({
      brand: z.string().max(MAX_BRAND_LENGTH).nullable().optional(),
      name: z.string().max(MAX_NAME_LENGTH).nullable().optional(),
      colorway: z.string().max(MAX_COLORWAY_LENGTH).nullable().optional(),
      primaryImageUrl: z
        .string()
        .url()
        .max(500)
        .nullable()
        .optional()
        .or(z.literal('')),
      // Provider IDs - validated but user-provided (from search results)
      // Note: stockxProductId is not always a UUID (can be various string formats)
      stockxProductId: z.string().max(100).nullable().optional(),
      stockxUrlKey: z.string().max(200).nullable().optional(),
      aliasCatalogId: z.string().max(100).nullable().optional(),
      gender: z.string().max(20).nullable().optional(),
      productCategory: z.string().max(50).nullable().optional(),
      releaseDate: z
        .string()
        .refine((val) => !val || isValidDate(val), 'Invalid date')
        .nullable()
        .optional(),
      retailPriceCents: z.number().int().min(0).nullable().optional(),
    })
    .optional(),
})

// Type inferred from schema - used implicitly via validationResult.data

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    }

    // 2. Parse and validate request
    const body = await request.json()
    const validationResult = requestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: validationResult.error.issues,
        },
        {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    }

    const input = validationResult.data
    const serviceSupabase = createServiceClient()

    // 3. Normalize inputs
    const styleId = input.styleId.trim().toUpperCase()
    const size = normalizeSize(input.size)
    const sizeUnit = input.sizeUnit

    console.log('[V4 Add Item] Starting:', {
      userId: user.id,
      styleId,
      size,
      sizeUnit,
    })

    // 4. Check if style exists in catalog (include alias_catalog_id for sync decision)
    // NOTE: Duplicate items ARE allowed - users can buy multiple pairs of the same SKU/size
    const { data: existingStyle, error: styleLookupErr } = await serviceSupabase
      .from('inventory_v4_style_catalog')
      .select('style_id, alias_catalog_id')
      .eq('style_id', styleId)
      .maybeSingle()

    if (styleLookupErr) {
      console.error('[V4 Add Item] Style lookup failed:', styleLookupErr)
      return NextResponse.json(
        { error: 'Failed to check style catalog', details: styleLookupErr.message },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 6. Upsert style catalog entry
    // ALWAYS upsert if styleCatalog is provided - fixes bug where existing entries
    // with NULL data weren't updated when user adds item with full product info
    if (!existingStyle && !input.styleCatalog) {
      return NextResponse.json(
        {
          error: 'Style not found in catalog',
          code: 'STYLE_NOT_FOUND',
          message: `SKU "${styleId}" not found. Please provide styleCatalog data to create it.`,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    if (input.styleCatalog) {
      console.log('[V4 Add Item] Upserting style catalog entry:', styleId)

      const { error: upsertStyleError } = await serviceSupabase
        .from('inventory_v4_style_catalog')
        .upsert(
          {
            style_id: styleId,
            brand: input.styleCatalog.brand?.trim() ?? null,
            name: input.styleCatalog.name?.trim() ?? null,
            colorway: input.styleCatalog.colorway?.trim() ?? null,
            primary_image_url: input.styleCatalog.primaryImageUrl || null,
            stockx_product_id: input.styleCatalog.stockxProductId ?? null,
            stockx_url_key: input.styleCatalog.stockxUrlKey ?? null,
            alias_catalog_id: input.styleCatalog.aliasCatalogId ?? null,
            gender: input.styleCatalog.gender ?? null,
            product_category: input.styleCatalog.productCategory ?? null,
            release_date: input.styleCatalog.releaseDate ?? null,
            retail_price_cents: input.styleCatalog.retailPriceCents ?? null,
          },
          { onConflict: 'style_id' }
        )

      if (upsertStyleError) {
        console.error('[V4 Add Item] Failed to upsert style:', upsertStyleError)
        return NextResponse.json(
          {
            error: 'Failed to create style catalog entry',
            details: upsertStyleError.message,
          },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        )
      }

      console.log('[V4 Add Item] Style catalog entry upserted:', styleId)
    }

    // 7. Insert inventory item
    const { data: item, error: itemError } = await supabase
      .from('inventory_v4_items')
      .insert({
        user_id: user.id,
        style_id: styleId,
        size,
        size_unit: sizeUnit,
        purchase_price: input.purchasePrice ?? null,
        purchase_currency: input.purchaseCurrency,
        purchase_date: input.purchaseDate ?? null,
        condition: input.condition,
        status: 'in_stock',
        notes: input.notes?.trim() ?? null,
      })
      .select('*')
      .single()

    if (itemError) {
      console.error('[V4 Add Item] Failed to create item:', itemError)

      // Legacy unique constraint may still be in place (migration pending)
      // This constraint should be removed - users CAN have multiple identical items
      if (itemError.code === '23505') {
        console.warn('[V4 Add Item] Duplicate constraint hit - migration may not be applied')
        return NextResponse.json(
          {
            error: 'Item already exists',
            code: 'DUPLICATE_ITEM',
            message: `${styleId} size ${size} ${sizeUnit} already in inventory. If you need multiple identical items, please contact support - this is a known limitation being fixed.`,
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        )
      }

      return NextResponse.json(
        {
          error: 'Failed to create inventory item',
          details: itemError.message,
          code: itemError.code,
        },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    console.log('[V4 Add Item] Item created:', item.id)

    // 8. Enqueue sync jobs for market data (fire-and-forget)
    // This populates market data so the table shows prices
    try {
      // Always enqueue StockX sync
      await serviceSupabase.rpc('enqueue_sync_job_v4', {
        p_style_id: styleId,
        p_provider: 'stockx',
      })

      // Enqueue Alias sync if we have an alias catalog ID
      // Check both: input (new style) OR existing DB row (style already existed)
      const hasAliasCatalogId =
        input.styleCatalog?.aliasCatalogId || existingStyle?.alias_catalog_id

      if (hasAliasCatalogId) {
        await serviceSupabase.rpc('enqueue_sync_job_v4', {
          p_style_id: styleId,
          p_provider: 'alias',
        })
      }

      console.log('[V4 Add Item] Sync jobs enqueued for:', styleId)
    } catch (syncErr) {
      // Don't fail the request if sync enqueue fails
      console.warn('[V4 Add Item] Failed to enqueue sync jobs:', syncErr)
    }

    // 9. Return success
    return NextResponse.json(
      {
        success: true,
        item: {
          id: item.id,
          styleId: item.style_id,
          size: item.size,
          sizeUnit: item.size_unit,
          purchasePrice: item.purchase_price,
          purchaseCurrency: item.purchase_currency,
          purchaseDate: item.purchase_date,
          condition: item.condition,
          status: item.status,
        },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    console.error('[V4 Add Item] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add item' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

// =============================================================================
// UPDATE HANDLER (EDIT ITEM)
// =============================================================================

const updateSchema = z.object({
  id: z.string().uuid('Invalid item ID'),
  size: z.string().min(1, 'Size is required').max(20).optional(),
  sizeUnit: z.enum(['US', 'UK', 'EU']).optional(),
  purchasePrice: z.number().min(0).nullable().optional(),
  purchaseCurrency: z.enum(['GBP', 'USD', 'EUR']).optional(),
  purchaseDate: z
    .string()
    .refine((val) => !val || isValidDate(val), 'Invalid date format')
    .nullable()
    .optional(),
  purchaseSource: z.string().max(100).nullable().optional(),
  condition: z.enum(['new', 'used', 'deadstock']).optional(),
  notes: z.string().max(500).nullable().optional(),
})

export async function PATCH(request: Request) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 2. Parse and validate request
    const body = await request.json()
    const validationResult = updateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: validationResult.error.issues,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const { id, ...updates } = validationResult.data

    console.log('[V4 Edit Item] Updating:', { userId: user.id, itemId: id, updates })

    // 3. Build update object (only include fields that were provided)
    const updatePayload: Record<string, unknown> = {}
    if (updates.size !== undefined) updatePayload.size = normalizeSize(updates.size)
    if (updates.sizeUnit !== undefined) updatePayload.size_unit = updates.sizeUnit
    if (updates.purchasePrice !== undefined) updatePayload.purchase_price = updates.purchasePrice
    if (updates.purchaseCurrency !== undefined) updatePayload.purchase_currency = updates.purchaseCurrency
    if (updates.purchaseDate !== undefined) updatePayload.purchase_date = updates.purchaseDate
    if (updates.purchaseSource !== undefined) updatePayload.purchase_source = updates.purchaseSource
    if (updates.condition !== undefined) updatePayload.condition = updates.condition
    if (updates.notes !== undefined) updatePayload.notes = updates.notes?.trim() ?? null

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 4. Update item (RLS ensures user can only update their own items)
    const { data: item, error: updateError } = await supabase
      .from('inventory_v4_items')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError) {
      console.error('[V4 Edit Item] Update failed:', updateError)

      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Item not found' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        )
      }

      return NextResponse.json(
        { error: 'Failed to update item', details: updateError.message },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    console.log('[V4 Edit Item] Item updated:', item.id)

    return NextResponse.json(
      {
        success: true,
        item: {
          id: item.id,
          styleId: item.style_id,
          size: item.size,
          sizeUnit: item.size_unit,
          purchasePrice: item.purchase_price,
          purchaseCurrency: item.purchase_currency,
          purchaseDate: item.purchase_date,
          condition: item.condition,
          status: item.status,
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    console.error('[V4 Edit Item] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update item' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
