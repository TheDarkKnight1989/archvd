import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@/lib/supabase/service'
import { syncSingleInventoryItemFromStockx } from '@/lib/providers/stockx-worker'

/**
 * POST /api/stockx/backfill/catalog
 *
 * DIRECTIVE COMPLIANT - Phase 2 Architecture:
 * - Uses stockx-worker for all DB operations
 * - Calls syncSingleInventoryItemFromStockx for each mapped item
 * - No direct service→DB writes
 *
 * Hydrates stockx_products and stockx_variants for existing inventory_market_links.
 * Only fetches catalog data (titles, brands, images), not market prices.
 *
 * WHY: Ensures all mapped items have StockX imagery and metadata.
 */
export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    // Use regular client to get authenticated user from session
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service client for queries (bypass RLS)
    const serviceSupabase = createServiceClient()

    console.log('[StockX Catalog Backfill] Starting for user:', user.id)

    // Count products before backfill (use service client for accurate count)
    const { count: productsBefore } = await serviceSupabase
      .from('stockx_products')
      .select('*', { count: 'exact', head: true })

    console.log('[StockX Catalog Backfill] Products before:', productsBefore)

    // Get user's inventory IDs first (inventory_market_links doesn't have user_id directly)
    const { data: inventory } = await supabase
      .from('Inventory')
      .select('id, sku')
      .eq('user_id', user.id)

    const inventoryIds = inventory?.map(i => i.id) || []

    console.log('[StockX Catalog Backfill] User inventory IDs:', inventoryIds)

    if (inventoryIds.length === 0) {
      return NextResponse.json({
        success: true,
        links: 0,
        distinctProducts: 0,
        productsBefore: productsBefore || 0,
        productsAfter: productsBefore || 0,
        hydratedProducts: 0,
        errors: 0,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      })
    }

    // Get all inventory_market_links for this user's inventory (use service client to bypass RLS)
    const { data: links, error: linksError } = await serviceSupabase
      .from('inventory_market_links')
      .select('item_id, stockx_product_id, stockx_variant_id')
      .in('item_id', inventoryIds)
      .not('stockx_product_id', 'is', null)

    if (linksError) {
      console.error('[StockX Catalog Backfill] Failed to fetch links:', linksError)
      return NextResponse.json({ error: linksError.message }, { status: 500 })
    }

    const totalLinks = links?.length || 0
    console.log('[StockX Catalog Backfill] Found links:', totalLinks)

    // Get distinct item IDs with StockX mappings
    const distinctItemIds = Array.from(
      new Set(links?.map(l => l.item_id).filter(Boolean) || [])
    )

    console.log('[StockX Catalog Backfill] Distinct items:', distinctItemIds.length)

    // Hydrate catalog for each item using worker
    let hydratedProducts = 0
    let errors = 0

    console.log('[StockX Catalog Backfill] Starting hydration for items:', distinctItemIds)

    for (const itemId of distinctItemIds) {
      try {
        console.log(`[StockX Catalog Backfill] ========================================`)
        console.log(`[StockX Catalog Backfill] Hydrating item: ${itemId}`)
        console.log(`[StockX Catalog Backfill] ========================================`)

        // Use worker to sync item (will hydrate catalog if missing)
        await syncSingleInventoryItemFromStockx({
          inventoryItemId: itemId,
          userId: user.id,
        })

        hydratedProducts++
        console.log(`[StockX Catalog Backfill] ✅ Hydrated: ${itemId} (${hydratedProducts}/${distinctItemIds.length})`)

        // Rate limit: 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error: any) {
        console.error(`[StockX Catalog Backfill] Error hydrating ${itemId}:`, error)
        errors++
      }
    }

    // Count products after backfill (use service client)
    const { count: productsAfter } = await serviceSupabase
      .from('stockx_products')
      .select('*', { count: 'exact', head: true })

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      links: totalLinks,
      distinctProducts: distinctItemIds.length,
      productsBefore: productsBefore || 0,
      productsAfter: productsAfter || 0,
      hydratedProducts,
      errors,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    }

    console.log('[StockX Catalog Backfill] Summary:', summary)

    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('[StockX Catalog Backfill] Fatal error:', error)
    return NextResponse.json(
      { error: error.message || 'Backfill failed' },
      { status: 500 }
    )
  }
}
