import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Debug helper to trace a StockX listing
 * GET /api/debug/trace-listing?inventoryItemId=xxx
 * or
 * GET /api/debug/trace-listing?listingId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const inventoryItemId = searchParams.get('inventoryItemId')
    const listingId = searchParams.get('listingId')

    if (!inventoryItemId && !listingId) {
      return NextResponse.json(
        { error: 'Provide either inventoryItemId or listingId query parameter' },
        { status: 400 }
      )
    }

    // Query by inventoryItemId or listingId
    let query = supabase
      .from('inventory_market_links')
      .select(`
        id,
        item_id,
        user_id,
        stockx_product_id,
        stockx_variant_id,
        stockx_listing_id,
        stockx_listing_status,
        stockx_last_listing_sync_at,
        stockx_listing_payload,
        created_at,
        updated_at,
        Inventory (
          id,
          sku,
          brand,
          model,
          size_uk
        )
      `)
      .eq('user_id', user.id)

    if (inventoryItemId) {
      query = query.eq('item_id', inventoryItemId)
    } else if (listingId) {
      query = query.eq('stockx_listing_id', listingId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        found: false,
        message: inventoryItemId
          ? `No inventory_market_links row for item_id=${inventoryItemId}`
          : `No inventory_market_links row for stockx_listing_id=${listingId}`,
      })
    }

    console.log('='.repeat(80))
    console.log('[DEBUG TRACE LISTING]')
    console.log('='.repeat(80))
    console.log('Link ID:', data.id)
    console.log('Inventory Item ID:', data.item_id)
    console.log('User ID:', data.user_id)
    console.log('StockX Product ID:', data.stockx_product_id)
    console.log('StockX Variant ID:', data.stockx_variant_id)
    console.log('StockX Listing ID:', data.stockx_listing_id)
    console.log('StockX Listing Status:', data.stockx_listing_status)
    console.log('Last Sync At:', data.stockx_last_listing_sync_at)
    console.log('Has Payload:', !!data.stockx_listing_payload)
    if (data.stockx_listing_payload) {
      console.log('Payload Status:', data.stockx_listing_payload.status)
      console.log('Payload Amount:', data.stockx_listing_payload.amount)
    }
    console.log('Created At:', data.created_at)
    console.log('Updated At:', data.updated_at)
    console.log('Inventory:', data.Inventory)
    console.log('='.repeat(80))

    return NextResponse.json({
      found: true,
      link: {
        id: data.id,
        item_id: data.item_id,
        user_id: data.user_id,
        stockx_product_id: data.stockx_product_id,
        stockx_variant_id: data.stockx_variant_id,
        stockx_listing_id: data.stockx_listing_id,
        stockx_listing_status: data.stockx_listing_status,
        stockx_last_listing_sync_at: data.stockx_last_listing_sync_at,
        has_payload: !!data.stockx_listing_payload,
        payload_status: data.stockx_listing_payload?.status,
        payload_amount: data.stockx_listing_payload?.amount,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
      inventory: data.Inventory,
    })
  } catch (error: any) {
    console.error('[Trace Listing] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
