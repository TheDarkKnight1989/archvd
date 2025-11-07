// Quick pricing lookup API (server-only)
// Used for SKU blur enrichment in Add Item form

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { quickLookup } from '@/lib/pricing';
import type { Category } from '@/lib/portfolio/types';

// Simple in-memory rate limiter (per-process)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 2000; // 2 seconds between calls for same SKU

type QuickLookupRequest = {
  sku: string;
  category?: Category;
};

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: QuickLookupRequest = await request.json();

    if (!body.sku || typeof body.sku !== 'string') {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      );
    }

    // Normalize SKU
    const sku = body.sku.trim().toUpperCase();
    const category = body.category || 'other';

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

    // Get Supabase client for catalog cache
    const supabase = await createClient();

    // Check catalog_cache first
    const { data: cached } = await supabase
      .from('catalog_cache')
      .select('*')
      .eq('sku', sku)
      .single();

    // If cache hit and recent (within 7 days), use cached data
    if (cached) {
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (cacheAge < sevenDays) {
        console.log(`[Quick Lookup] Cache hit for SKU: ${sku}`);
        const response = {
          sku,
          product: {
            sku: cached.sku,
            brand: cached.brand,
            name: cached.model,
            colorway: cached.colorway,
            image_url: cached.image_url,
          },
          price: null, // Cache doesn't store price (changes frequently)
          source: cached.source,
          as_of: cached.updated_at,
        };
        return NextResponse.json(response, { status: 200 });
      }
    }

    // Perform quick lookup via providers
    console.log(`[Quick Lookup] Fetching from providers - SKU: ${sku}, Category: ${category}`);
    const result = await quickLookup(sku, category);

    // No data found
    if (!result.product && !result.price) {
      return NextResponse.json(
        { sku, product: null, price: null },
        { status: 204 }
      );
    }

    // Upsert into catalog_cache if we got product data
    if (result.product) {
      await supabase
        .from('catalog_cache')
        .upsert({
          sku,
          brand: result.product.brand || null,
          model: result.product.name || null,
          colorway: null, // Not provided by current providers
          image_url: result.product.image_url || null,
          source: 'stockx', // Primary provider for quick lookup
          confidence: 90,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'sku',
        });

      console.log(`[Quick Lookup] Cached product data for SKU: ${sku}`);
    }

    // Shape response
    const response = {
      sku,
      product: result.product || null,
      price: result.price || null,
      source: result.product ? 'stockx' : null,
      as_of: new Date().toISOString(),
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
