// Public Sell List API - View sell list via share token (no auth required)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/sell-lists/public/[shareToken]
 * Fetch a sell list by share token (public access, no authentication required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const supabase = await createClient()
    const { shareToken } = await params

    // Fetch sell list by share token (no auth required)
    // Note: We use service role client here to bypass RLS
    const { data: sellList, error: listError } = await supabase
      .from('sell_lists')
      .select('id, name, allow_comments, show_market_prices, allow_offers, allow_asking_prices, created_at')
      .eq('share_token', shareToken)
      .single()

    if (listError) {
      if (listError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Sell list not found' },
          { status: 404 }
        )
      }
      console.error('[Sell Lists Public API] Fetch error:', listError)
      throw new Error(`Failed to fetch sell list: ${listError.message}`)
    }

    // Fetch sell list items with inventory details
    const { data: items, error: itemsError } = await supabase
      .from('sell_list_items')
      .select(`
        id,
        asking_price,
        position,
        inventory_item:Inventory (
          id,
          sku,
          brand,
          model,
          colorway,
          style_id,
          size,
          size_uk,
          size_alt,
          category,
          condition
        )
      `)
      .eq('sell_list_id', sellList.id)
      .order('position', { ascending: true })

    if (itemsError) {
      console.error('[Sell Lists Public API] Items fetch error:', itemsError)
      throw new Error(`Failed to fetch sell list items: ${itemsError.message}`)
    }

    // If show_market_prices is enabled, fetch market prices for the items
    let itemsWithMarketPrices = items || []

    if (sellList.show_market_prices && items && items.length > 0) {
      // Get inventory item IDs
      const inventoryItemIds = items
        .map(item => item.inventory_item?.id)
        .filter(Boolean)

      if (inventoryItemIds.length > 0) {
        // Fetch market data for these items
        const { data: marketData, error: marketError } = await supabase
          .from('inventory_market_links')
          .select(`
            inventory_item_id,
            market_product_id,
            stockx_market_products (
              current_price_snapshot
            )
          `)
          .in('inventory_item_id', inventoryItemIds)

        if (!marketError && marketData) {
          // Create a map of inventory_item_id to market price
          const marketPriceMap = new Map()
          marketData.forEach(link => {
            if ((link.stockx_market_products as any)?.current_price_snapshot) {
              marketPriceMap.set(
                link.inventory_item_id,
                (link.stockx_market_products as any).current_price_snapshot
              )
            }
          })

          // Attach market prices to items
          itemsWithMarketPrices = items.map(item => ({
            ...item,
            market_price: (item.inventory_item as any)?.id
              ? marketPriceMap.get((item.inventory_item as any).id) || null
              : null
          }))
        }
      }
    }

    return NextResponse.json({
      sellList: {
        id: sellList.id,
        name: sellList.name,
        allow_comments: sellList.allow_comments,
        show_market_prices: sellList.show_market_prices,
        allow_offers: sellList.allow_offers,
        allow_asking_prices: sellList.allow_asking_prices,
        created_at: sellList.created_at,
        items: itemsWithMarketPrices,
      },
    })
  } catch (error: any) {
    console.error('[Sell Lists Public API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
