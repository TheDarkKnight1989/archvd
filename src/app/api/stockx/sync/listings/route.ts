/**
 * StockX Sync Listings
 * Fetches user's StockX listings and maps to inventory
 * POST /api/stockx/sync/listings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStockxClient } from '@/lib/services/stockx/client';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if StockX is enabled
    if (process.env.NEXT_PUBLIC_STOCKX_ENABLE !== 'true') {
      return NextResponse.json(
        { error: 'StockX integration is not enabled' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has connected StockX account
    const { data: account, error: accountError } = await supabase
      .from('stockx_accounts')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'StockX account not connected. Please connect your account first.' },
        { status: 401 }
      );
    }

    // Get user-specific StockX client (will auto-load and refresh tokens)
    const client = getStockxClient(user.id);

    logger.info('[StockX Sync Listings] Starting sync', {
      userId: user.id,
      endpoint: '/v2/selling/listings?pageSize=100',
    });

    // Fetch user's listings from StockX (v2 API)
    const response = await client.request('/v2/selling/listings?pageSize=100');

    logger.info('[StockX Sync Listings] Response received', {
      userId: user.id,
      hasResponse: !!response,
      responseKeys: response ? Object.keys(response) : [],
      listingsIsArray: Array.isArray(response?.listings),
      listingsCount: response?.listings?.length || 0,
      sampleData: response ? JSON.stringify(response).substring(0, 500) : null,
    });

    if (!response || !Array.isArray(response.listings)) {
      logger.warn('[StockX Sync Listings] No listings returned', {
        userId: user.id,
        response: response ? JSON.stringify(response).substring(0, 1000) : null,
      });
      return NextResponse.json({
        success: true,
        fetched: 0,
        created: 0,
        upsertedProducts: 0,
        duration_ms: Date.now() - startTime,
        message: 'No active listings found on StockX',
      });
    }

    const listings = response.listings;
    let fetchedCount = listings.length;
    let mappedCount = 0;
    let upsertedProducts = 0;

    // Check if user has any inventory items at all
    const { data: userInventoryCheck, error: inventoryCheckError } = await supabase
      .from('Inventory')
      .select('id, sku, size, status')
      .eq('user_id', user.id)
      .limit(10);

    logger.info('[StockX Sync Listings] User inventory check', {
      userId: user.id,
      inventoryCount: userInventoryCheck?.length || 0,
      sampleInventory: userInventoryCheck?.map(i => ({ sku: i.sku, size: i.size, status: i.status })) || [],
      hasError: !!inventoryCheckError,
    });

    // Process listings
    for (const listing of listings) {
      // StockX API v2 structure
      const {
        listingId: stockx_listing_id,
        product,
        variant,
        amount: asking_price_amount,
        currencyCode: currency = 'USD',
        status: listingStatus,
      } = listing;

      // Extract SKU from product.styleId (StockX v2 format)
      const productSku = product?.styleId;
      const size = variant?.variantValue;

      // Skip listings without SKU or size
      if (!productSku || !size) {
        logger.warn('[StockX Sync Listings] Skipping listing without SKU or size', {
          listingId: stockx_listing_id,
          hasSku: !!productSku,
          hasSize: !!size,
          productStyleId: product?.styleId,
          variantValue: variant?.variantValue,
        });
        continue;
      }

      // Upsert product catalog if we have product details
      if (product && product.productName) {
        // Generate slug from SKU
        const slug = productSku.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const { error: productError } = await supabase
          .from('stockx_products')
          .upsert(
            {
              sku: productSku,
              slug: slug,
              name: product.productName,
              brand: 'Unknown', // StockX v2 API doesn't provide brand in listings response
              model: null,
              colorway: null,
              release_date: null,
              retail_price: null,
              image_url: null,
              meta: {
                product_id: product.productId,
                retail_currency: currency,
                category: 'sneaker',
              },
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'sku',
              ignoreDuplicates: false,
            }
          );

        if (productError) {
          logger.error('[StockX Sync Listings] Product upsert error', {
            sku: productSku,
            error: productError.message,
          });
        } else {
          upsertedProducts++;
        }
      }

      // Create or update Inventory item from StockX listing
      // First check if we already have an inventory item linked to this StockX listing
      const { data: existingLink } = await supabase
        .from('inventory_market_links')
        .select('inventory_id, Inventory!inner(*)')
        .eq('provider', 'stockx')
        .eq('provider_listing_id', stockx_listing_id)
        .eq('Inventory.user_id', user.id)
        .single();

      let inventoryItemId: string;

      if (existingLink) {
        // Update existing inventory item
        inventoryItemId = existingLink.inventory_id;

        const { error: updateError } = await supabase
          .from('Inventory')
          .update({
            sku: productSku,
            style_id: productSku,
            size: size,
            size_uk: size,
            status: listingStatus === 'ACTIVE' || listingStatus === 'LISTED' ? 'listed' : 'active',
            notes: `Imported from StockX: ${product.productName} (${stockx_listing_id})`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', inventoryItemId);

        if (updateError) {
          logger.error('[StockX Sync Listings] Inventory update error', {
            inventoryItemId,
            error: updateError.message,
          });
        } else {
          mappedCount++;
        }
      } else {
        // Create new inventory item
        const { data: newItem, error: insertError } = await supabase
          .from('Inventory')
          .insert({
            user_id: user.id,
            sku: productSku,
            brand: 'Unknown', // Will be enriched later
            model: null,
            colorway: null,
            style_id: productSku,
            size: size,
            size_uk: size,
            size_alt: null,
            category: 'sneaker',
            condition: 'new',
            purchase_price: 0,
            tax: null,
            shipping: null,
            place_of_purchase: 'StockX',
            purchase_date: null,
            order_number: null,
            tags: ['stockx-import'],
            custom_market_value: null,
            notes: `Imported from StockX: ${product.productName} (${stockx_listing_id})`,
            status: 'listed',
          })
          .select('id')
          .single();

        if (insertError || !newItem) {
          logger.error('[StockX Sync Listings] Inventory insert error', {
            sku: productSku,
            size,
            error: insertError?.message,
            code: insertError?.code,
            details: insertError?.details,
            hint: insertError?.hint,
            fullError: JSON.stringify(insertError),
          });
          continue;
        }

        inventoryItemId = newItem.id;

        // Create inventory_market_link
        const { error: linkError } = await supabase
          .from('inventory_market_links')
          .insert({
            inventory_id: inventoryItemId,
            provider: 'stockx',
            provider_product_sku: productSku,
            provider_listing_id: stockx_listing_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (linkError) {
          logger.error('[StockX Sync Listings] Link creation error', {
            inventoryItemId,
            error: linkError.message,
            code: linkError.code,
            details: linkError.details,
            hint: linkError.hint,
            fullError: JSON.stringify(linkError),
          });
        } else {
          mappedCount++;
        }
      }

      // Log first few attempts
      if (listings.indexOf(listing) < 3) {
        logger.info('[StockX Sync Listings] Processing listing', {
          listingIndex: listings.indexOf(listing),
          productSku,
          size,
          productName: product.productName,
          action: existingLink ? 'updated' : 'created',
          inventoryItemId,
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.info('[StockX Sync Listings] Sync complete', {
      userId: user.id,
      fetched: fetchedCount,
      created: mappedCount,
      upsertedProducts,
      userInventoryCount: userInventoryCheck?.length || 0,
      sampleStockxSkus: listings.slice(0, 5).map((l: any) => ({
        sku: l.product?.styleId,
        size: l.variant?.variantValue,
        productName: l.product?.productName,
      })),
      userInventorySample: userInventoryCheck?.slice(0, 5).map(i => ({ sku: i.sku, size: i.size })) || [],
    });

    logger.apiRequest(
      '/api/stockx/sync/listings',
      { userId: user.id },
      duration,
      {
        fetched: fetchedCount,
        created: mappedCount,
        upsertedProducts,
      }
    );

    return NextResponse.json({
      success: true,
      fetched: fetchedCount,
      created: mappedCount, // Changed from "mapped" to "created" for clarity
      upsertedProducts,
      duration_ms: duration,
      message: `Synced ${fetchedCount} StockX listings, created/updated ${mappedCount} inventory items`,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Handle 429 rate limiting
    if (error.message?.includes('429')) {
      logger.warn('[StockX Sync Listings] Rate limited', {
        duration,
        error: error.message,
      });

      return NextResponse.json(
        {
          error: 'Rate limited by StockX. Please try again later.',
          retry_after: 60, // seconds
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
          },
        }
      );
    }

    // Handle 401 authentication errors
    if (error.message?.includes('401')) {
      logger.error('[StockX Sync Listings] Authentication failed', {
        message: error.message,
        duration,
      });

      return NextResponse.json(
        {
          error: 'StockX authentication failed',
          details: 'Your StockX access token may have expired. Please try disconnecting and reconnecting your StockX account.',
        },
        { status: 401 }
      );
    }

    logger.error('[StockX Sync Listings] Error', {
      message: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      { error: 'Failed to sync StockX listings', details: error.message },
      { status: 500 }
    );
  }
}
