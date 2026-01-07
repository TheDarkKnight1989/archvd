/**
 * DEBUG ROUTE: Test StockX API Media Response
 *
 * Calls the live StockX API to fetch product details and examine
 * the COMPLETE media object to see what image URLs are actually returned.
 *
 * Usage: GET /api/debug/stockx-api-media?styleId=AR4237-005
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const styleId = searchParams.get('styleId') || 'AR4237-005' // Default to Fear of God

  try {
    // Initialize Supabase client with service role (no auth required for debug)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Look up the product in our database
    const { data: product, error: dbError } = await supabase
      .from('stockx_products')
      .select('stockx_product_id, style_id, title, image_url, thumb_url')
      .eq('style_id', styleId)
      .single()

    if (dbError || !product) {
      return NextResponse.json(
        {
          error: 'Product not found in database',
          styleId,
          dbError: dbError?.message,
        },
        { status: 404 }
      )
    }

    console.log('[DEBUG API MEDIA] Found product:', {
      title: product.title,
      stockx_product_id: product.stockx_product_id,
      style_id: product.style_id,
      stored_image_url: product.image_url,
      stored_thumb_url: product.thumb_url,
    })

    // Get any StockX OAuth tokens (for debug purposes, use any available account)
    // Filter for non-expired tokens and get the most recently updated one
    const { data: stockxAccounts, error: accountError } = await supabase
      .from('stockx_accounts')
      .select('access_token, refresh_token, expires_at, user_id')
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)

    if (accountError || !stockxAccounts || stockxAccounts.length === 0) {
      return NextResponse.json(
        {
          error: 'No StockX accounts found in database',
          hint: 'Connect a StockX account via Settings > Integrations first',
        },
        { status: 403 }
      )
    }

    const stockxAccount = stockxAccounts[0]
    console.log('[DEBUG API MEDIA] Using StockX account for user:', stockxAccount.user_id)

    // Call StockX API to get product details
    const apiUrl = `https://api.stockx.com/v2/catalog/products/${product.stockx_product_id}?includes=media,traits,attributes`

    console.log('[DEBUG API MEDIA] Calling StockX API:', apiUrl)

    const stockxResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${stockxAccount.access_token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Archvd/1.0',
        'x-api-key': process.env.STOCKX_API_KEY || '',
      },
    })

    if (!stockxResponse.ok) {
      const errorText = await stockxResponse.text()
      console.error('[DEBUG API MEDIA] StockX API error:', {
        status: stockxResponse.status,
        statusText: stockxResponse.statusText,
        body: errorText,
      })

      return NextResponse.json(
        {
          error: 'StockX API request failed',
          status: stockxResponse.status,
          statusText: stockxResponse.statusText,
          body: errorText,
        },
        { status: stockxResponse.status }
      )
    }

    const apiData = await stockxResponse.json()

    console.log('[DEBUG API MEDIA] StockX API response:', {
      hasMedia: !!apiData.media,
      mediaKeys: apiData.media ? Object.keys(apiData.media) : [],
    })

    // Test each image URL if present
    const imageTests: Record<string, any> = {}

    if (apiData.media?.imageUrl) {
      imageTests.imageUrl = await testImageUrl(apiData.media.imageUrl)
    }

    if (apiData.media?.thumbUrl) {
      imageTests.thumbUrl = await testImageUrl(apiData.media.thumbUrl)
    }

    if (apiData.media?.smallImageUrl) {
      imageTests.smallImageUrl = await testImageUrl(apiData.media.smallImageUrl)
    }

    // Return comprehensive response
    return NextResponse.json({
      success: true,
      product: {
        title: product.title,
        stockx_product_id: product.stockx_product_id,
        style_id: product.style_id,
      },
      database: {
        image_url: product.image_url,
        thumb_url: product.thumb_url,
      },
      stockx_api: {
        full_response: apiData,
        media: apiData.media || null,
      },
      image_tests: imageTests,
      comparison: {
        database_url: product.image_url,
        api_imageUrl: apiData.media?.imageUrl || null,
        api_thumbUrl: apiData.media?.thumbUrl || null,
        urls_match: product.image_url === apiData.media?.imageUrl,
      },
    })
  } catch (error: any) {
    console.error('[DEBUG API MEDIA] Unexpected error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

async function testImageUrl(url: string) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://stockx.com/',
      },
    })

    return {
      url,
      status: response.status,
      statusText: response.statusText,
      works: response.ok,
      contentType: response.headers.get('content-type'),
    }
  } catch (error: any) {
    return {
      url,
      error: error.message,
      works: false,
    }
  }
}
