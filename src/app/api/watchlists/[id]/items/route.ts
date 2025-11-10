// Watchlist Items API - Full CRUD for items within a watchlist
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/watchlists/[id]/items
 * Fetch all items in a watchlist with enriched catalog and price data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: watchlistId } = await params
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify watchlist ownership
    const { data: watchlist, error: watchlistError } = await supabase
      .from('watchlists')
      .select('id')
      .eq('id', watchlistId)
      .eq('user_id', user.id)
      .single()

    if (watchlistError || !watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch watchlist items (without join - we'll enrich manually)
    const { data: items, error } = await supabase
      .from('watchlist_items')
      .select('id, sku, size, target_price, created_at')
      .eq('watchlist_id', watchlistId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Watchlist Items API] Fetch error:', error)
      throw new Error(`Failed to fetch watchlist items: ${error.message}`)
    }

    // Enrich with catalog and market data
    const enrichedItems = await Promise.all(
      (items || []).map(async (item: any) => {
        const isPokemon = item.sku.startsWith('PKMN-')

        // Fetch catalog data based on product type
        let catalogData = null
        if (isPokemon) {
          const { data } = await supabase
            .from('trading_card_catalog')
            .select('name, set_name, language, sealed_type, image_url, retail_price, currency')
            .eq('sku', item.sku)
            .single()

          if (data) {
            catalogData = {
              brand: 'Pokémon',
              model: data.name,
              colorway: `${data.set_name} • ${data.language}`,
              image_url: data.image_url,
              retail_price: data.retail_price,
              retail_currency: data.currency,
            }
          }
        } else {
          const { data } = await supabase
            .from('product_catalog')
            .select('brand, model, colorway, image_url, retail_price, retail_currency')
            .eq('sku', item.sku)
            .single()

          catalogData = data
        }

        // Get latest price based on product type
        let latestPrice = null
        if (isPokemon) {
          const { data } = await supabase
            .from('tcg_latest_prices')
            .select('median_price, currency, source, as_of')
            .eq('sku', item.sku)
            .order('as_of', { ascending: false })
            .limit(1)
            .single()

          if (data) {
            latestPrice = {
              price: data.median_price,
              currency: data.currency,
              source: data.source,
              as_of: data.as_of,
            }
          }
        } else {
          const { data } = await supabase
            .from('latest_market_prices')
            .select('price, currency, source, as_of')
            .eq('sku', item.sku)
            .eq('size', item.size || '')
            .single()

          latestPrice = data
        }

        return {
          ...item,
          product_catalog: catalogData,
          latest_price: latestPrice?.price || null,
          latest_currency: latestPrice?.currency || null,
          latest_source: latestPrice?.source || null,
          latest_as_of: latestPrice?.as_of || null,
          alert: latestPrice?.price && item.target_price
            ? parseFloat(latestPrice.price) <= parseFloat(item.target_price)
            : false,
        }
      })
    )

    return NextResponse.json({ items: enrichedItems })
  } catch (error: any) {
    console.error('[Watchlist Items API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/watchlists/[id]/items
 * Add an item to a watchlist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: watchlistId } = await params
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify watchlist ownership
    const { data: watchlist, error: watchlistError } = await supabase
      .from('watchlists')
      .select('id')
      .eq('id', watchlistId)
      .eq('user_id', user.id)
      .single()

    if (watchlistError || !watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found or access denied' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { sku, size, target_price } = body

    // Validate input
    if (!sku || typeof sku !== 'string' || sku.trim().length === 0) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 })
    }

    // Validate SKU exists in catalog (check both sneaker and Pokémon catalogs)
    const upperSku = sku.toUpperCase()
    const isPokemon = upperSku.startsWith('PKMN-')

    let productExists = false
    if (isPokemon) {
      const { data } = await supabase
        .from('trading_card_catalog')
        .select('sku')
        .eq('sku', upperSku)
        .single()

      productExists = !!data
    } else {
      const { data } = await supabase
        .from('product_catalog')
        .select('sku')
        .eq('sku', upperSku)
        .single()

      productExists = !!data
    }

    if (!productExists) {
      return NextResponse.json(
        { error: 'SKU not found in product catalog' },
        { status: 400 }
      )
    }

    // Validate target_price if provided
    if (target_price !== undefined && target_price !== null) {
      const priceNum = parseFloat(target_price)
      if (isNaN(priceNum) || priceNum < 0) {
        return NextResponse.json(
          { error: 'Target price must be a positive number' },
          { status: 400 }
        )
      }
    }

    // Create item
    const { data: item, error } = await supabase
      .from('watchlist_items')
      .insert({
        watchlist_id: watchlistId,
        sku: sku.toUpperCase(),
        size: size || null,
        target_price: target_price || null,
      })
      .select()
      .single()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This item is already in your watchlist' },
          { status: 409 }
        )
      }

      console.error('[Watchlist Items API] Create error:', error)
      throw new Error(`Failed to add item to watchlist: ${error.message}`)
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (error: any) {
    console.error('[Watchlist Items API] Error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
