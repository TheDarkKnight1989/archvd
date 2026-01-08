/**
 * StockX Create/Reprice Listing API
 * POST /api/stockx/listings/create
 *
 * Creates a new ask listing on StockX OR updates an existing listing's price.
 *
 * IMPORTANT: This route handles both CREATE and REPRICE:
 * - If no active listing exists → creates new listing via StockX API
 * - If active listing exists → updates price via StockX PATCH API (true reprice)
 *
 * Persists to:
 * - inventory_v4_listings (V4 - primary source of truth)
 * - inventory_market_links (V3 - backwards compatibility)
 * - stockx_listings (V3 - legacy tracking)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService, type ListingOperation } from '@/lib/services/stockx/listings'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// =============================================================================
// TYPES
// =============================================================================

type ListingCurrency = 'GBP' | 'USD' | 'EUR'
const VALID_CURRENCIES: ListingCurrency[] = ['GBP', 'USD', 'EUR']

function isValidCurrency(c: unknown): c is ListingCurrency {
  return typeof c === 'string' && VALID_CURRENCIES.includes(c as ListingCurrency)
}

interface CreateListingRequest {
  inventoryItemId: string
  askPrice: number
  currencyCode?: string
  expiryDays?: number
}

// Max ask price to prevent obviously bad data (£100k should be plenty for sneakers)
const MAX_ASK_PRICE = 100000

// Expiry days constraints
const MIN_EXPIRY_DAYS = 1
const MAX_EXPIRY_DAYS = 365
const DEFAULT_EXPIRY_DAYS = 90

// =============================================================================
// VALIDATION
// =============================================================================

function validateAskPrice(askPrice: unknown): { valid: boolean; error?: string; normalized?: number } {
  if (typeof askPrice !== 'number') {
    return { valid: false, error: 'askPrice must be a number' }
  }
  // Number.isFinite() already returns false for NaN
  if (!Number.isFinite(askPrice)) {
    return { valid: false, error: 'askPrice must be a finite number' }
  }
  if (askPrice <= 0) {
    return { valid: false, error: 'askPrice must be greater than 0' }
  }
  if (askPrice > MAX_ASK_PRICE) {
    return { valid: false, error: `askPrice cannot exceed ${MAX_ASK_PRICE}` }
  }

  // Validate max 2 decimal places using cents-based approach
  // This avoids floating point weirdness in the comparison
  const cents = Math.round(askPrice * 100)
  if (Math.abs(askPrice * 100 - cents) > 1e-6) {
    return { valid: false, error: 'askPrice has too many decimal places (max 2)' }
  }

  // Normalize to exactly 2 decimal places using toFixed to avoid floating point issues
  // toFixed returns string, parseFloat converts back to number
  // This ensures 10000 stays as 10000.00, not 9999.99 due to floating point
  const normalized = parseFloat((cents / 100).toFixed(2))

  return { valid: true, normalized }
}

/**
 * Clamp expiry days to valid range
 */
function normalizeExpiryDays(days: unknown): number {
  if (typeof days !== 'number' || !Number.isFinite(days)) {
    return DEFAULT_EXPIRY_DAYS
  }
  return Math.max(MIN_EXPIRY_DAYS, Math.min(MAX_EXPIRY_DAYS, Math.round(days)))
}

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = (await request.json()) as CreateListingRequest
    const { inventoryItemId, askPrice: rawAskPrice, currencyCode, expiryDays } = body

    // Validate required fields
    if (!inventoryItemId) {
      return NextResponse.json(
        { error: 'Missing required field: inventoryItemId' },
        { status: 400 }
      )
    }

    // Validate askPrice
    const priceValidation = validateAskPrice(rawAskPrice)
    if (!priceValidation.valid) {
      return NextResponse.json(
        { error: priceValidation.error },
        { status: 400 }
      )
    }
    const askPrice = priceValidation.normalized!

    // Validate currency
    const currency: ListingCurrency = isValidCurrency(currencyCode)
      ? currencyCode
      : 'GBP'

    console.log('[Create Listing] Request:', {
      inventoryItemId,
      askPrice,
      currency,
    })

    // Check if StockX is in mock mode
    if (isStockxMockMode()) {
      return NextResponse.json(
        {
          success: false,
          error: 'StockX is in mock mode. Real API calls are disabled.',
        },
        { status: 503 }
      )
    }

    // =========================================================================
    // 1. VERIFY ITEM OWNERSHIP (V4 TABLE)
    // =========================================================================

    // Check ownership against V4 table (not V3 inventory_items)
    const { data: itemOwnership, error: ownershipError } = await supabase
      .from('inventory_v4_items')
      .select('id, user_id')
      .eq('id', inventoryItemId)
      .eq('user_id', user.id)
      .single()

    if (ownershipError || !itemOwnership) {
      console.error('[Create Listing] Ownership check failed:', {
        inventoryItemId,
        userId: user.id,
        error: ownershipError?.message,
      })
      return NextResponse.json(
        {
          code: 'FORBIDDEN',
          error: 'You do not have permission to list this item.',
        },
        { status: 403 }
      )
    }

    // =========================================================================
    // 2. GET STOCKX MAPPING (V3 with V4 fallback)
    // =========================================================================

    let mapping: { stockx_product_id: string; stockx_variant_id: string } | null = null

    // Try V3 mapping first (inventory_market_links)
    const { data: v3Mapping, error: v3MappingError } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id')
      .eq('item_id', inventoryItemId)
      .maybeSingle()

    if (v3MappingError) {
      console.error('[Create Listing] V3 mapping query failed:', v3MappingError.message)
    }

    if (v3Mapping?.stockx_product_id && v3Mapping?.stockx_variant_id) {
      mapping = v3Mapping
      console.log('[Create Listing] Using V3 mapping:', mapping)
    } else {
      // V4 fallback: Look up from style catalog + variants
      console.log('[Create Listing] No V3 mapping, trying V4 fallback...')

      // Get item details (style_id and size)
      const { data: v4Item, error: v4ItemError } = await supabase
        .from('inventory_v4_items')
        .select('style_id, size')
        .eq('id', inventoryItemId)
        .single()

      if (v4ItemError || !v4Item) {
        console.error('[Create Listing] V4 item lookup failed:', v4ItemError?.message)
        return NextResponse.json(
          {
            code: 'NO_MAPPING',
            error: 'This item is not linked to StockX. Please map it first.',
          },
          { status: 400 }
        )
      }

      // Get stockx_product_id from style catalog
      const { data: styleCatalog, error: styleError } = await supabase
        .from('inventory_v4_style_catalog')
        .select('stockx_product_id')
        .eq('style_id', v4Item.style_id)
        .single()

      if (styleError || !styleCatalog?.stockx_product_id) {
        console.log('[Create Listing] No StockX product mapping in style catalog:', v4Item.style_id)
        return NextResponse.json(
          {
            code: 'NO_MAPPING',
            error: 'This item is not linked to StockX. Please map it first.',
          },
          { status: 400 }
        )
      }

      // Get variant_id by matching size - try V4 first, then V3 fallback
      let variantId: string | null = null

      // Try V4 variants table
      const { data: v4Variant } = await supabase
        .from('inventory_v4_stockx_variants')
        .select('stockx_variant_id')
        .eq('stockx_product_id', styleCatalog.stockx_product_id)
        .eq('variant_value', v4Item.size)
        .maybeSingle()

      if (v4Variant?.stockx_variant_id) {
        variantId = v4Variant.stockx_variant_id
        console.log('[Create Listing] Found variant in V4 table:', variantId)
      } else {
        // V3 fallback: Try stockx_variants table (legacy)
        console.log('[Create Listing] V4 variant not found, trying V3 fallback...')

        // V3 uses string product_id, not UUID - need to handle both formats
        const productIdStr = styleCatalog.stockx_product_id.toString()

        const { data: v3Variant } = await supabase
          .from('stockx_variants')
          .select('stockx_variant_id')
          .eq('stockx_product_id', productIdStr)
          .eq('variant_value', v4Item.size)
          .maybeSingle()

        if (v3Variant?.stockx_variant_id) {
          variantId = v3Variant.stockx_variant_id
          console.log('[Create Listing] Found variant in V3 table:', variantId)
        } else {
          // Try UK+1 = US size conversion as last resort
          const ukSize = parseFloat(v4Item.size)
          if (!isNaN(ukSize)) {
            const usSize = (ukSize + 1).toString()
            console.log('[Create Listing] Trying US size conversion:', { ukSize, usSize })

            const { data: usVariant } = await supabase
              .from('stockx_variants')
              .select('stockx_variant_id')
              .eq('stockx_product_id', productIdStr)
              .eq('variant_value', usSize)
              .maybeSingle()

            if (usVariant?.stockx_variant_id) {
              variantId = usVariant.stockx_variant_id
              console.log('[Create Listing] Found variant using US size:', variantId)
            }
          }
        }
      }

      if (!variantId) {
        console.error('[Create Listing] No matching variant for size:', {
          productId: styleCatalog.stockx_product_id,
          size: v4Item.size,
        })
        return NextResponse.json(
          {
            code: 'INCOMPLETE_MAPPING',
            error: `No StockX variant found for size ${v4Item.size}. The product may not be available in this size.`,
          },
          { status: 400 }
        )
      }

      mapping = {
        stockx_product_id: styleCatalog.stockx_product_id,
        stockx_variant_id: variantId,
      }
      console.log('[Create Listing] Using V4/V3 mapping:', mapping)
    }

    if (!mapping) {
      return NextResponse.json(
        {
          code: 'NO_MAPPING',
          error: 'This item is not linked to StockX. Please map it first.',
        },
        { status: 400 }
      )
    }

    // =========================================================================
    // 3. CHECK FOR EXISTING V4 LISTING (DETERMINES CREATE vs REPRICE)
    // =========================================================================

    // Fetch existing listing WITH external_listing_id for true reprice
    const { data: existingV4Listing, error: existingCheckError } = await supabase
      .from('inventory_v4_listings')
      .select('id, external_listing_id, listed_price, listed_currency, status')
      .eq('item_id', inventoryItemId)
      .eq('user_id', user.id)
      .eq('platform', 'stockx')
      .in('status', ['active', 'paused'])
      .maybeSingle()

    if (existingCheckError) {
      console.warn(
        '[Create Listing] V4 existing check failed:',
        existingCheckError.message
      )
    }

    // Handle edge case: listing row exists but external_listing_id is missing
    // This could happen from manual imports, legacy data, or bugs
    if (existingV4Listing && !existingV4Listing.external_listing_id) {
      console.error('[Create Listing] Listing row exists but missing external_listing_id:', {
        listingId: existingV4Listing.id,
        status: existingV4Listing.status,
      })
      return NextResponse.json(
        {
          code: 'MISSING_EXTERNAL_ID',
          error: 'An existing listing record is missing its StockX ID. Please cancel this listing and create a new one.',
          details: {
            internalListingId: existingV4Listing.id,
            status: existingV4Listing.status,
          },
        },
        { status: 400 }
      )
    }

    const isReprice = !!(existingV4Listing?.external_listing_id)
    const nowIso = new Date().toISOString()

    // =========================================================================
    // 4. CALL STOCKX API (CREATE OR UPDATE)
    // =========================================================================

    let listingId: string
    let listingStatus: 'ACTIVE' | 'PENDING'
    let operation: ListingOperation

    if (isReprice && existingV4Listing?.external_listing_id) {
      // TRUE REPRICE: Update existing listing via PATCH
      console.log('[Create Listing] Repricing existing listing:', {
        existingListingId: existingV4Listing.external_listing_id,
        oldPrice: existingV4Listing.listed_price,
        newPrice: askPrice,
      })

      operation = await StockxListingsService.updateListing(
        user.id,
        existingV4Listing.external_listing_id,
        {
          amount: askPrice,  // Major units - service converts to string
          currencyCode: currency,
        }
      )

      // Service throws on network/auth errors. Check for explicit failure status.
      if (operation.status === 'failed') {
        throw new Error(operation.error || 'StockX reprice failed')
      }

      // For update, we keep the same listing ID
      listingId = existingV4Listing.external_listing_id
      // 'completed' → immediately live, 'pending' → processing
      listingStatus = operation.status === 'completed' ? 'ACTIVE' : 'PENDING'

      console.log('[Create Listing] ✅ Listing REPRICED:', listingId, `(${listingStatus})`)
    } else {
      // NEW LISTING: Create via POST
      const validExpiryDays = normalizeExpiryDays(expiryDays)
      const expiryDate = new Date(Date.now() + validExpiryDays * 24 * 60 * 60 * 1000)
      const expiryTime = expiryDate.toISOString()

      console.log('[Create Listing] Creating new listing:', {
        productId: mapping.stockx_product_id,
        variantId: mapping.stockx_variant_id,
        amount: askPrice,
        currency,
      })

      operation = await StockxListingsService.createListing(user.id, {
        productId: mapping.stockx_product_id,
        variantId: mapping.stockx_variant_id,
        amount: askPrice,  // Major units - service converts to string
        currencyCode: currency,
        quantity: 1,
        expiresAt: expiryTime,
      })

      if (!operation.listingId) {
        console.error('[Create Listing] ERROR: No listing ID in response')
        throw new Error('StockX did not return a listing ID')
      }

      listingId = operation.listingId
      listingStatus = operation.status === 'completed' ? 'ACTIVE' : 'PENDING'

      console.log('[Create Listing] ✅ Listing CREATED:', listingId, `(${listingStatus})`)
    }

    // Map StockX status to V4 status
    // If we successfully got a listingId, the listing is active on StockX
    // The operation.status just indicates if the async operation completed, not listing status
    // A listing with an ID is live/active; it only becomes 'paused' via explicit deactivation
    const v4Status = listingId ? 'active' : 'paused'

    // Track partial-write failures for response warning
    let v4WriteFailed = false

    // =========================================================================
    // 5. PERSIST TO INVENTORY_V4_LISTINGS (PRIMARY)
    // =========================================================================

    if (isReprice && existingV4Listing) {
      // UPDATE existing V4 row (by specific ID, not broad query)
      const { error: updateError } = await supabase
        .from('inventory_v4_listings')
        .update({
          listed_price: askPrice,
          listed_currency: currency,
          external_listing_id: listingId,
          status: v4Status,
          updated_at: nowIso,
          // Note: listed_at stays unchanged on reprice (preserves listing age)
        })
        .eq('id', existingV4Listing.id)

      if (updateError) {
        console.error('[Create Listing] V4 update failed:', updateError.message)
        v4WriteFailed = true
      } else {
        console.log('[Create Listing] ✅ V4 listing UPDATED:', {
          id: existingV4Listing.id,
          newPrice: askPrice,
          status: v4Status,
        })
      }
    } else {
      // INSERT new V4 row - with race condition handling
      const { data: insertedListing, error: insertError } = await supabase
        .from('inventory_v4_listings')
        .insert({
          item_id: inventoryItemId,
          user_id: user.id,
          platform: 'stockx',
          platform_name: null, // Must be NULL for non-custom platforms
          listed_price: askPrice,
          listed_currency: currency,
          external_listing_id: listingId,
          status: v4Status,
          listed_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .single()

      if (insertError) {
        // Handle race condition: if unique constraint violated, try to update instead
        if (insertError.code === '23505') {
          console.warn('[Create Listing] Race condition detected, updating existing row')

          // Use maybeSingle to avoid throwing on 0 rows
          const { data: raceRow, error: raceQueryError } = await supabase
            .from('inventory_v4_listings')
            .select('id')
            .eq('item_id', inventoryItemId)
            .eq('user_id', user.id)
            .eq('platform', 'stockx')
            .in('status', ['active', 'paused'])
            .maybeSingle()

          if (raceQueryError) {
            console.error('[Create Listing] Race row query failed:', raceQueryError.message)
            v4WriteFailed = true
          } else if (raceRow) {
            const { error: fallbackUpdateError } = await supabase
              .from('inventory_v4_listings')
              .update({
                listed_price: askPrice,
                listed_currency: currency,
                external_listing_id: listingId,
                status: v4Status,
                updated_at: nowIso,
              })
              .eq('id', raceRow.id)

            if (fallbackUpdateError) {
              console.error('[Create Listing] Fallback update failed:', fallbackUpdateError.message)
              v4WriteFailed = true
            } else {
              console.log('[Create Listing] ✅ V4 listing updated via fallback:', raceRow.id)
            }
          } else {
            console.error('[Create Listing] Race condition but no row found')
            v4WriteFailed = true
          }
        } else {
          console.error('[Create Listing] V4 insert failed:', insertError.message)
          v4WriteFailed = true
        }
      } else {
        console.log('[Create Listing] ✅ V4 listing CREATED:', {
          id: insertedListing?.id,
          price: askPrice,
          status: v4Status,
        })
      }
    }

    // =========================================================================
    // 6. PERSIST TO INVENTORY_MARKET_LINKS (V3 BACKWARDS COMPAT)
    // =========================================================================

    // Upsert V3 links with full payload for debugging/audit
    // Uses UNIQUE(item_id) constraint - creates row if missing, updates if exists
    const { error: linkError } = await supabase
      .from('inventory_market_links')
      .upsert(
        {
          item_id: inventoryItemId,
          stockx_product_id: mapping.stockx_product_id,
          stockx_variant_id: mapping.stockx_variant_id,
          stockx_listing_id: listingId,
          stockx_listing_status: listingStatus,
          stockx_last_listing_sync_at: nowIso,
          stockx_listing_payload: operation, // Preserve full response for debugging
          updated_at: nowIso,
        },
        { onConflict: 'item_id' }
      )

    if (linkError) {
      console.warn('[Create Listing] V3 links upsert failed:', linkError.message)
    } else {
      console.log('[Create Listing] ✅ V3 inventory_market_links upserted')
    }

    // =========================================================================
    // 7. PERSIST TO STOCKX_LISTINGS (V3 LEGACY)
    // =========================================================================

    const { data: product } = await supabase
      .from('stockx_products')
      .select('id')
      .eq('stockx_product_id', mapping.stockx_product_id)
      .single()

    const { data: variant } = await supabase
      .from('stockx_variants')
      .select('id')
      .eq('stockx_variant_id', mapping.stockx_variant_id)
      .single()

    if (product && variant) {
      // For upsert, don't overwrite created_at on existing rows
      const { error: trackingError } = await supabase
        .from('stockx_listings')
        .upsert(
          {
            stockx_listing_id: listingId,
            user_id: user.id,
            stockx_product_id: mapping.stockx_product_id,
            stockx_variant_id: mapping.stockx_variant_id,
            product_id: product.id,
            variant_id: variant.id,
            status: listingStatus,
            amount: Math.round(askPrice * 100), // Store as cents
            currency_code: currency,
            updated_at: nowIso,
            // Note: created_at not included - let DB default handle it on insert
          },
          {
            onConflict: 'stockx_listing_id',
            ignoreDuplicates: false,
          }
        )

      if (trackingError) {
        console.warn('[Create Listing] V3 stockx_listings upsert failed:', trackingError.message)
      } else {
        console.log('[Create Listing] ✅ V3 stockx_listings tracked')
      }
    }

    // =========================================================================
    // 8. RETURN SUCCESS
    // =========================================================================

    const duration = Date.now() - startTime

    // Build response with optional warning for partial-write failures
    const response: Record<string, unknown> = {
      success: true,
      listingId,
      status: listingStatus,
      v4Status,
      isReprice,
      duration_ms: duration,
    }

    // Add warning if StockX succeeded but local DB write failed
    // UI should force refresh + show yellow toast
    if (v4WriteFailed) {
      response.warning = 'LISTING_CREATED_BUT_NOT_SAVED'
      response.warningMessage = 'Listing was created on StockX but failed to save locally. Please refresh.'
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to create listing'
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error('[Create Listing] Error:', {
      message: errorMessage,
      stack: errorStack,
    })

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: errorStack,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
