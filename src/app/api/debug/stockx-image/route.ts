/**
 * DEBUG ROUTE: StockX Image Proxy
 *
 * Purpose: Test if StockX images can be proxied through our API
 *
 * Usage: GET /api/debug/stockx-image?productId=<stockx_product_id>
 *
 * This route:
 * 1. Looks up the product in stockx_products
 * 2. Fetches the image_url from StockX
 * 3. Proxies it back to the browser with proper Content-Type
 *
 * IMPORTANT: This is a temporary dev-only route for investigation
 * DO NOT use in production - implement proper image caching strategy
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const productId = searchParams.get('productId')

  if (!productId) {
    return NextResponse.json(
      { error: 'Missing productId parameter' },
      { status: 400 }
    )
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Look up the product
    const { data: product, error: dbError } = await supabase
      .from('stockx_products')
      .select('stockx_product_id, style_id, title, image_url, thumb_url')
      .eq('stockx_product_id', productId)
      .single()

    if (dbError || !product) {
      return NextResponse.json(
        {
          error: 'Product not found',
          productId,
          dbError: dbError?.message,
        },
        { status: 404 }
      )
    }

    // Check if product has an image URL
    const imageUrl = product.image_url || product.thumb_url

    if (!imageUrl) {
      return NextResponse.json(
        {
          error: 'No image URL found for this product',
          product: {
            stockx_product_id: product.stockx_product_id,
            style_id: product.style_id,
            title: product.title,
          },
        },
        { status: 404 }
      )
    }

    console.log('[DEBUG PROXY] Fetching image:', imageUrl)

    // Fetch the image from StockX
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'image/*',
        'Referer': 'https://stockx.com/',
      },
    })

    if (!imageResponse.ok) {
      console.error('[DEBUG PROXY] StockX image fetch failed:', {
        status: imageResponse.status,
        statusText: imageResponse.statusText,
        url: imageUrl,
      })

      return NextResponse.json(
        {
          error: 'Failed to fetch image from StockX',
          stockxStatus: imageResponse.status,
          stockxStatusText: imageResponse.statusText,
          imageUrl,
          product: {
            stockx_product_id: product.stockx_product_id,
            style_id: product.style_id,
            title: product.title,
          },
        },
        { status: imageResponse.status }
      )
    }

    // Get the image buffer
    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

    console.log('[DEBUG PROXY] Successfully fetched image:', {
      product: product.title,
      url: imageUrl,
      contentType,
      size: imageBuffer.byteLength,
    })

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache
        'X-Stockx-Product-Id': product.stockx_product_id,
        'X-Stockx-Style-Id': product.style_id,
      },
    })
  } catch (error: any) {
    console.error('[DEBUG PROXY] Unexpected error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
