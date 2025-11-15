/**
 * Market Search API - Unified market data for sneakers and sealed Pokémon
 * GET /api/market/search?q=<query>&currency=GBP&limit=50
 *
 * Uses market_products, latest_market_prices, and market_price_daily_medians
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { marketSearchCache } from '@/lib/cache/lru-cache';
import { logger } from '@/lib/logger';

export type MarketSearchResult = {
  sku: string;
  name: string;
  subtitle: string;
  imageUrl: string;
  currency: 'GBP' | 'EUR' | 'USD';
  median: number | null;
  delta7dPct: number | null;
  series7d: (number | null)[];
  tags: string[];
  sources: { name: string; count: number }[];
  provider: string;
  asOf: string;
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let cacheHit = false;
  let resultCount = 0;

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim();
    const currency = (searchParams.get('currency') || 'GBP') as 'GBP' | 'EUR' | 'USD';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Check cache first (60s TTL)
    const cacheKey = `search:${query.toLowerCase()}:${currency}`;
    const cachedResult = marketSearchCache.get(cacheKey);
    if (cachedResult) {
      cacheHit = true;
      resultCount = cachedResult.results?.length || 0;

      const duration = Date.now() - startTime;

      logger.apiRequest('/api/market/search',
        { q: query, currency },
        duration,
        { cache: 'hit', resultCount }
      );

      return NextResponse.json(cachedResult);
    }

    const supabase = await createClient();

    // Build search pattern
    const searchPattern = `%${query}%`;
    const upperQuery = query.toUpperCase();

    // Query unified market_products table
    const { data: products, error: productsError } = await supabase
      .from('market_products')
      .select('*')
      .or(`sku.ilike.${searchPattern},brand.ilike.${searchPattern},model.ilike.${searchPattern},colorway.ilike.${searchPattern}`)
      .limit(limit);

    if (productsError) {
      logger.error('[Market Search] Products query error', {
        error: productsError.message,
        query,
      });
      throw productsError;
    }

    if (!products || products.length === 0) {
      const emptyResult = { results: [], count: 0 };
      marketSearchCache.set(cacheKey, emptyResult);

      logger.apiRequest('/api/market/search',
        { q: query, currency },
        Date.now() - startTime,
        { cache: 'miss', resultCount: 0 }
      );

      return NextResponse.json(emptyResult);
    }

    // Fetch latest prices for each SKU
    const skus = products.map(p => p.sku);
    const { data: latestPrices, error: pricesError } = await supabase
      .from('latest_market_prices')
      .select('*')
      .in('sku', skus);

    if (pricesError) {
      logger.error('[Market Search] Latest prices query error', {
        error: pricesError.message,
      });
    }

    // Fetch 7-day medians for each SKU
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: medians, error: mediansError } = await supabase
      .from('market_price_daily_medians')
      .select('*')
      .in('sku', skus)
      .gte('day', sevenDaysAgo.toISOString().split('T')[0])
      .lte('day', today.toISOString().split('T')[0])
      .order('day', { ascending: true });

    if (mediansError) {
      logger.error('[Market Search] Medians query error', {
        error: mediansError.message,
      });
    }

    // TODO(server): FX conversion to requested currency
    // For now, return prices in their source currency
    const convertPrice = (price: number | null, _fromCurrency: string): number | null => {
      return price;
    };

    // Build enriched results
    const results: MarketSearchResult[] = products.map((product) => {
      // Find latest price for this product
      const latestPrice = latestPrices?.find(
        p => p.sku === product.sku && p.provider === product.provider
      );

      // Get 7-day series for this SKU/provider
      const productMedians = medians?.filter(m =>
        m.sku === product.sku &&
        m.provider === product.provider &&
        m.size_uk === (latestPrice?.size_uk || '')
      ) || [];

      // Create 7-day array (index 0 = today, index 6 = 7 days ago)
      const series7d: (number | null)[] = Array(7).fill(null);
      const mediansMap = new Map<string, number>();

      productMedians.forEach(m => {
        if (m.median) {
          mediansMap.set(m.day, parseFloat(m.median));
        }
      });

      // Fill series (index 0 is today)
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayKey = date.toISOString().split('T')[0];
        const median = mediansMap.get(dayKey);
        series7d[i] = median !== undefined ? median : null;
      }

      // Calculate delta7dPct (today vs 7 days ago)
      const day0 = series7d[0];
      const day6 = series7d[6];
      let delta7dPct: number | null = null;
      if (day0 !== null && day6 !== null && day6 !== 0) {
        delta7dPct = ((day0 - day6) / day6) * 100;
      }

      // Build name and subtitle
      const name = product.brand && product.model
        ? `${product.brand} ${product.model}`
        : product.brand || product.model || 'Unknown Product';

      const subtitle = product.colorway || '';

      // Tags from metadata
      const tags: string[] = [];
      const category = product.meta?.category || 'sneaker';
      tags.push(category);

      // Extract language/sealed tags for Pokémon
      if (product.meta?.language) {
        tags.push(product.meta.language);
      }
      if (product.meta?.sealed_type) {
        tags.push('sealed');
      }

      // Sources (single provider for now)
      const sources = [{ name: product.provider, count: 1 }];

      // Current median (from latest price or first series point)
      const median = latestPrice
        ? (latestPrice.last_sale || latestPrice.ask || day0)
        : day0;

      return {
        sku: product.sku,
        name,
        subtitle,
        imageUrl: product.image_url || '',
        currency: latestPrice?.currency || currency,
        median,
        delta7dPct,
        series7d,
        tags,
        sources,
        provider: product.provider,
        asOf: latestPrice?.as_of || new Date().toISOString(),
      };
    });

    resultCount = results.length;

    const responseData = {
      results,
      count: results.length,
    };

    // Cache the result for 60s
    marketSearchCache.set(cacheKey, responseData);

    logger.apiRequest('/api/market/search',
      { q: query, currency },
      Date.now() - startTime,
      { cache: 'miss', resultCount }
    );

    return NextResponse.json(responseData);

  } catch (error: any) {
    logger.error('[Market Search] Error', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
