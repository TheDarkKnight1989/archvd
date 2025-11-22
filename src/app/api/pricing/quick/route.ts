// Quick pricing lookup API (server-only)
// Used for SKU blur enrichment in Add Item form

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fullLookup } from '@/lib/pricing';
import type { AggregatedPrice } from '@/lib/pricing/types';
import type { Category } from '@/lib/portfolio/types';
import { getCatalogService } from '@/lib/services/stockx/catalog';
import { isStockxMockMode } from '@/lib/config/stockx';

// Simple in-memory rate limiter (per-process)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 2000; // 2 seconds between calls for same SKU

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const skuParam = searchParams.get('sku');
    const categoryParam = searchParams.get('category');

    if (!skuParam || typeof skuParam !== 'string') {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      );
    }

    // Normalize SKU
    const sku = skuParam.trim().toUpperCase();
    const category = (categoryParam || 'other') as Category;

    // Rate limit check
    const lastCall = rateLimitMap.get(sku);
    const now = Date.now();

    if (lastCall && now - lastCall < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before retrying.' },
        { status: 429 }
      );
    }

    rateLimitMap.set(sku, now);

    // Clean up old entries (keep last 100)
    if (rateLimitMap.size > 100) {
      const entries = Array.from(rateLimitMap.entries());
      const oldest = entries.sort((a, b) => a[1] - b[1]).slice(0, 50);
      oldest.forEach(([k]) => rateLimitMap.delete(k));
    }

    // Get Supabase client for catalog queries
    const supabase = await createClient();

    // 1. Check product_catalog first (seeded data, highest priority)
    const { data: catalogEntry } = await supabase
      .from('product_catalog')
      .select('*')
      .eq('sku', sku)
      .single();

    let productFromCatalog = null;
    if (catalogEntry) {
      console.log(`[Quick Lookup] Product catalog hit for SKU: ${sku}`);
      productFromCatalog = {
        sku: catalogEntry.sku,
        brand: catalogEntry.brand,
        name: catalogEntry.model,
        colorway: catalogEntry.colorway,
        image_url: catalogEntry.image_url,
      };
    }

    // 2. Fallback to catalog_cache if not in product_catalog
    let productFromCache = null;
    if (!productFromCatalog) {
      const { data: cached } = await supabase
        .from('catalog_cache')
        .select('*')
        .eq('sku', sku)
        .single();

      // If cache hit and recent (within 7 days), use cached product data
      if (cached) {
        const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (cacheAge < sevenDays) {
          console.log(`[Quick Lookup] Catalog cache hit for SKU: ${sku}`);
          productFromCache = {
            sku: cached.sku,
            brand: cached.brand,
            name: cached.model,
            colorway: cached.colorway,
            image_url: cached.image_url,
          };
        }
      }
    }

    // 2.5. NEW: Search StockX V2 catalog if not found locally
    let productFromStockX = null;
    let stockxProductId = null;
    let stockxVariantId = null;

    if (!productFromCatalog && !productFromCache && !isStockxMockMode()) {
      try {
        console.log(`[Quick Lookup] Searching StockX V2 catalog for SKU: ${sku}`);
        const catalogService = getCatalogService();
        const results = await catalogService.searchProducts(sku, { limit: 1 });

        if (results.length > 0) {
          const stockxProduct = results[0];
          console.log(`[Quick Lookup] StockX V2 catalog hit: ${stockxProduct.productName}`);

          // Map to our product format
          productFromStockX = {
            sku: stockxProduct.styleId,
            brand: stockxProduct.brand,
            name: stockxProduct.productName,
            colorway: stockxProduct.colorway || null,
            image_url: stockxProduct.image || null,
          };

          // Cache in catalog_cache for faster future lookups
          await supabase
            .from('catalog_cache')
            .upsert(
              {
                sku: stockxProduct.styleId,
                brand: stockxProduct.brand,
                model: stockxProduct.productName,
                colorway: stockxProduct.colorway,
                image_url: stockxProduct.image,
                source: 'stockx_v2',
                confidence: 95,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'sku',
              }
            );

          console.log(`[Quick Lookup] Cached StockX V2 product for SKU: ${sku}`);
        }
      } catch (error) {
        console.error('[Quick Lookup] StockX V2 search error:', error);
        // Continue with existing flow if StockX fails
      }
    }

    // 3. Check product_market_prices for latest market price
    const { data: marketPrice } = await supabase
      .from('product_market_prices')
      .select('*')
      .eq('sku', sku)
      .order('as_of', { ascending: false })
      .limit(1)
      .single();

    // 4. Perform full lookup via pricing router (StockX → Laced for sneakers)
    // Skip external lookup if we have both catalog and market price data
    let result: Awaited<ReturnType<typeof fullLookup>> = { prices: [] };

    if (!marketPrice && !productFromCatalog && !productFromCache) {
      console.log(`[Quick Lookup] Fetching from providers - SKU: ${sku}, Category: ${category}`);
      result = await fullLookup(sku, category);
    }

    // Use catalog data first, then cache, then StockX, then lookup result
    const product = productFromCatalog || productFromCache || productFromStockX || result.product || null;

    // Build aggregated price from market_prices table or external lookup
    let aggregatedPrice: AggregatedPrice | null = null;
    let currency = 'GBP'; // Default currency

    if (marketPrice) {
      console.log(`[Quick Lookup] Market price hit for SKU: ${sku} - £${marketPrice.price}`);
      currency = marketPrice.currency;
      aggregatedPrice = {
        price: marketPrice.price,
        confidence: (marketPrice.meta?.confidence as 'high' | 'medium' | 'low') || 'medium',
        timestamp: new Date(marketPrice.as_of),
        sources_used: [marketPrice.source as any],
      };
    } else if (result.aggregated) {
      aggregatedPrice = result.aggregated;
    }

    // No data found
    if (!product && !aggregatedPrice) {
      return NextResponse.json(
        { product: null, price: null, sources_used: [] },
        { status: 200 }
      );
    }

    // Upsert into catalog_cache if we got new product data from external lookup
    if (result.product && !productFromCache && !productFromCatalog) {
      await supabase
        .from('catalog_cache')
        .upsert({
          sku,
          brand: result.product.brand || null,
          model: result.product.name || null,
          colorway: null, // Not provided by current providers
          image_url: result.product.image_url || null,
          source: result.prices[0]?.provider || 'stockx',
          confidence: 90,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'sku',
        });

      console.log(`[Quick Lookup] Cached product data for SKU: ${sku}`);
    }

    // Shape response with aggregated price and sources
    const response = {
      product,
      price: aggregatedPrice ? {
        amount: aggregatedPrice.price,
        currency,
        confidence: aggregatedPrice.confidence,
        timestamp: aggregatedPrice.timestamp.toISOString(),
      } : null,
      sources_used: aggregatedPrice?.sources_used || [],
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    console.error('[Quick Lookup] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now();
  const staleTime = now - RATE_LIMIT_MS * 10; // 20 seconds ago

  for (const [sku, timestamp] of rateLimitMap.entries()) {
    if (timestamp < staleTime) {
      rateLimitMap.delete(sku);
    }
  }
}, 30000); // Every 30 seconds
