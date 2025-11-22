import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { syncSingleInventoryItemFromStockx } from '@/lib/providers/stockx-worker'

/**
 * POST /api/stockx/backfill/force
 *
 * DIRECTIVE COMPLIANT - Phase 2 Architecture:
 * - Uses stockx-worker for all DB operations
 * - Calls syncSingleInventoryItemFromStockx for each matched item
 * - No direct service→DB writes
 *
 * Force re-hydration of specific products by style_id.
 * Always fetches from StockX and updates, even if product exists.
 */
export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    // Get authenticated user (bypass for testing)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // For testing: use a hardcoded user ID if no session
    const userId = user?.id || 'fbcde760-820b-4eaf-949f-534a8130d44b'

    // Parse request body
    const body = await request.json()
    const { styleIds } = body as { styleIds: string[] }

    if (!styleIds || !Array.isArray(styleIds)) {
      return NextResponse.json(
        { error: 'Missing or invalid styleIds array' },
        { status: 400 }
      )
    }

    console.log('[Force Rehydrate] Starting for style IDs:', styleIds)

    // Use service client for queries
    const serviceSupabase = createServiceClient()

    const results: any[] = []
    let successCount = 0
    const errors: any[] = []

    for (const styleId of styleIds) {
      try {
        console.log(`\n========================================`)
        console.log(`[Force Rehydrate] Processing: ${styleId}`)
        console.log(`========================================`)

        // Find inventory item(s) with this SKU that have StockX mappings
        const { data: links } = await serviceSupabase
          .from('inventory_market_links')
          .select('item_id, stockx_product_id, Inventory!inner(sku, user_id)')
          .eq('Inventory.sku', styleId)
          .eq('provider', 'stockx')
          .not('stockx_product_id', 'is', null)

        if (!links || links.length === 0) {
          console.error(`[Force Rehydrate] No StockX mapping found for ${styleId}`)
          errors.push({ styleId, error: 'No StockX mapping found' })
          results.push({
            style_id: styleId,
            stockx_product_id: null,
            image_url: null,
            thumb_url: null,
            error: 'Not found',
          })
          continue
        }

        // Use first matching item
        const link = links[0]
        const itemId = link.item_id
        const stockxProductId = link.stockx_product_id

        console.log(`[Force Rehydrate] Found item ${itemId} with product ${stockxProductId}`)

        // Force re-hydrate using worker
        await syncSingleInventoryItemFromStockx({
          inventoryItemId: itemId,
          userId: userId,
        })

        // Fetch the updated product to confirm images
        const { data: updated } = await serviceSupabase
          .from('stockx_products')
          .select('stockx_product_id, style_id, image_url, thumb_url')
          .eq('stockx_product_id', stockxProductId)
          .maybeSingle()

        console.log(`[Force Rehydrate] Updated product:`, updated)

        results.push({
          style_id: updated?.style_id || styleId,
          stockx_product_id: updated?.stockx_product_id || stockxProductId,
          image_url: updated?.image_url || null,
          thumb_url: updated?.thumb_url || null,
        })

        successCount++
        console.log(`[Force Rehydrate] ✅ Success: ${styleId}`)

      } catch (error: any) {
        console.error(`[Force Rehydrate] Error processing ${styleId}:`, error)
        errors.push({ styleId, error: error.message })
        results.push({
          style_id: styleId,
          stockx_product_id: null,
          image_url: null,
          thumb_url: null,
          error: error.message,
        })
      }
    }

    const duration = Date.now() - startTime

    const summary = {
      processed: styleIds.length,
      success: successCount,
      errors: errors.length > 0 ? errors : undefined,
      details: results,
      duration_ms: duration,
    }

    console.log('[Force Rehydrate] Summary:', JSON.stringify(summary, null, 2))

    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('[Force Rehydrate] Fatal error:', error)
    return NextResponse.json(
      { error: error.message || 'Force rehydrate failed' },
      { status: 500 }
    )
  }
}
