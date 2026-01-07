/**
 * API Route: Link Inventory Item to Alias Product
 *
 * POST /api/alias/inventory/link
 *
 * Allows users to manually attach an Alias (GOAT) product to an inventory item.
 * Once linked, the Alias-first image logic will automatically pull images everywhere.
 *
 * Request body:
 * {
 *   inventoryId: string;
 *   aliasCatalogId: string; // The Alias catalog_id from their API
 * }
 *
 * Response:
 * - 200: { success: true, link: {...} }
 * - 400: { error: string } (validation error)
 * - 401: { error: string } (not authenticated)
 * - 404: { error: string } (inventory item not found or not owned)
 * - 500: { error: string } (server error)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCatalogItem } from '@/lib/services/alias/catalog'

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    const body = await request.json()
    const { inventoryId, aliasCatalogId } = body

    // Validate inputs
    if (!inventoryId || typeof inventoryId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid inventoryId: must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!aliasCatalogId || typeof aliasCatalogId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid aliasCatalogId: must be a non-empty string' },
        { status: 400 }
      )
    }

    // 2. Create authenticated Supabase client
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('[Alias Link] Request from user:', user.id, {
      inventoryId,
      aliasCatalogId,
    })

    // 3. Verify inventory item exists and belongs to user
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('Inventory')
      .select('id, sku, brand, model')
      .eq('id', inventoryId)
      .eq('user_id', user.id)
      .single()

    if (inventoryError || !inventoryItem) {
      console.error('[Alias Link] Inventory item not found or not owned:', {
        inventoryId,
        userId: user.id,
        error: inventoryError,
      })

      return NextResponse.json(
        { error: 'Inventory item not found or you do not have permission to modify it' },
        { status: 404 }
      )
    }

    console.log('[Alias Link] Found inventory item:', inventoryItem)

    // 4. Fetch/ensure Alias catalog item is cached
    // This will fetch from Alias API and upsert to alias_catalog_items
    const catalogItem = await getCatalogItem(aliasCatalogId, {
      forceRefresh: false, // Use cache if available
    })

    if (!catalogItem) {
      console.error('[Alias Link] Failed to fetch/cache Alias catalog item:', aliasCatalogId)
      return NextResponse.json(
        { error: 'Failed to fetch Alias product. The catalog ID may be invalid or the Alias API is unavailable.' },
        { status: 400 }
      )
    }

    console.log('[Alias Link] Cached Alias catalog item:', {
      catalogId: catalogItem.catalog_id,
      name: catalogItem.product_name,
      imageUrl: catalogItem.image_url,
    })

    // 5. Upsert inventory_alias_links
    // If a link already exists for this inventory_id, update it
    // Otherwise, insert a new link
    const linkData = {
      inventory_id: inventoryId,
      alias_catalog_id: aliasCatalogId,
      alias_sku: catalogItem.sku,
      alias_product_name: catalogItem.product_name,
      alias_brand: catalogItem.brand,
      match_confidence: 1.0, // Manual attach = 100% confidence
      mapping_status: 'ok',
      last_sync_success_at: new Date().toISOString(),
      last_sync_error: null,
    }

    const { data: link, error: linkError } = await supabase
      .from('inventory_alias_links')
      .upsert(linkData, {
        onConflict: 'inventory_id', // Unique constraint on inventory_id
        ignoreDuplicates: false, // Update if exists
      })
      .select()
      .single()

    if (linkError) {
      console.error('[Alias Link] Error upserting inventory_alias_links:', linkError)
      return NextResponse.json(
        { error: 'Failed to create link. Database error.' },
        { status: 500 }
      )
    }

    console.log('[Alias Link] Successfully linked inventory to Alias product:', {
      inventoryId,
      aliasCatalogId,
      linkId: link.id,
    })

    // 6. Return success response
    return NextResponse.json({
      success: true,
      link: {
        id: link.id,
        inventory_id: link.inventory_id,
        alias_catalog_id: link.alias_catalog_id,
        alias_product_name: link.alias_product_name,
        alias_brand: link.alias_brand,
      },
      catalog: {
        name: catalogItem.product_name,
        brand: catalogItem.brand,
        sku: catalogItem.sku,
        image_url: catalogItem.image_url,
        slug: catalogItem.slug,
      },
    })

  } catch (error: any) {
    console.error('[Alias Link] Unexpected error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
