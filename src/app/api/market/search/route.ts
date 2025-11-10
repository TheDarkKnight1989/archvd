// Market Quick-Add v2 API - Search sealed Pokémon products with rich market data
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { marketSearchCache } from '@/lib/cache/lru-cache';
import { logger } from '@/lib/logger';

// Sealed product types (enforce at API level)
const SEALED_TYPES = ['ETB', 'Booster Box', 'Tin', 'Bundle', 'Collection', 'booster_box', 'elite_trainer_box', 'tin', 'bundle', 'collection_box'];
const ALLOWED_LANGUAGES = ['EN', 'JP'];

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let cacheHit = false;
  let resultCount = 0;

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim();
    const currency = searchParams.get('currency') || 'GBP';

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
      resultCount = cachedResult.count || 0;

      const duration = Date.now() - startTime;

      logger.apiRequest('/api/market/search',
        { q: query, currency },
        duration,
        { cache: 'hit', resultCount }
      );

      // Update metadata for cache hit
      const responseWithMeta = {
        ...cachedResult,
        _meta: {
          duration_ms: duration,
          cache: 'hit',
        },
      };

      return NextResponse.json(responseWithMeta);
    }

    const supabase = await createClient();
    const upperQuery = query.toUpperCase();

    // Search both Pokémon sealed products and sneakers in parallel
    const [pokemonData, sneakersData] = await Promise.all([
      // Pokémon sealed products (EN/JP only)
      supabase
        .from('trading_card_catalog')
        .select('sku, name, set_name, language, sealed_type, image_url')
        .or(`sku.eq.${upperQuery},name.ilike.%${query}%`)
        .in('language', ['EN', 'JP'])
        .not('sealed_type', 'is', null)
        .limit(25),

      // Sneakers (all models)
      supabase
        .from('product_catalog')
        .select('sku, brand, model, colorway, image_url, retail_price, retail_currency')
        .or(`sku.eq.${upperQuery},model.ilike.%${query}%,brand.ilike.%${query}%`)
        .limit(25),
    ]);

    if (pokemonData.error) {
      console.error('[Market Search] Pokemon search error:', pokemonData.error);
      throw pokemonData.error;
    }

    if (sneakersData.error) {
      console.error('[Market Search] Sneakers search error:', sneakersData.error);
      throw sneakersData.error;
    }

    const pokemonResults = pokemonData.data || [];
    const sneakersResults = sneakersData.data || [];

    // Combine and rank results: exact SKU > begins-with > fuzzy match
    const allResults = [
      ...pokemonResults.map((p: any) => ({ ...p, category: 'pokemon' as const })),
      ...sneakersResults.map((s: any) => ({ ...s, category: 'sneaker' as const })),
    ];

    // SKU ranking function
    const getRank = (item: any): number => {
      const sku = item.sku?.toUpperCase() || '';
      const name = item.name?.toLowerCase() || item.model?.toLowerCase() || '';
      const brand = item.brand?.toLowerCase() || '';
      const queryLower = query.toLowerCase();

      // Exact SKU match (highest priority)
      if (sku === upperQuery) return 0;

      // SKU begins with query
      if (sku.startsWith(upperQuery)) return 1;

      // Exact name/model match
      if (name === queryLower || brand === queryLower) return 2;

      // Name/model begins with query
      if (name.startsWith(queryLower) || brand.startsWith(queryLower)) return 3;

      // Contains query (fuzzy)
      return 4;
    };

    // Sort by rank, then alphabetically
    allResults.sort((a, b) => {
      const rankDiff = getRank(a) - getRank(b);
      if (rankDiff !== 0) return rankDiff;

      const aName = a.name || a.model || '';
      const bName = b.name || b.model || '';
      return aName.localeCompare(bName);
    });

    // Limit to top 50 results
    const rankedResults = allResults.slice(0, 50);

    if (rankedResults.length === 0) {
      const duration = Date.now() - startTime;
      return NextResponse.json({
        results: [],
        count: 0,
        _meta: { duration_ms: duration, cache: 'miss' },
      });
    }

    // Fetch FX rates for currency conversion
    const { data: fxRates } = await supabase
      .from('fx_rates')
      .select('*')
      .order('as_of', { ascending: false })
      .limit(1)
      .single();

    // Helper to convert prices
    const convertPrice = (price: number | null, fromCurrency: string): number | null => {
      if (!price || fromCurrency === currency || !fxRates) return price;

      if (fromCurrency === 'GBP' && currency === 'EUR') return price * fxRates.eur_per_gbp;
      if (fromCurrency === 'EUR' && currency === 'GBP') return price * fxRates.gbp_per_eur;

      return price;
    };

    // Enrich with market data and sparkline
    const enrichedResults = await Promise.all(
      rankedResults.map(async (item: any) => {
        const isPokemon = item.category === 'pokemon';
        const isSneaker = item.category === 'sneaker';

        // Fetch latest price data based on category
        let median: number | null = null;
        let series7d: (number | null)[] = [];
        let delta7dPct: number | null = null;
        let sources: { name: 'ebay' | 'tcgplayer'; count: number }[] = [];

        if (isPokemon) {
          // Pokémon: use tcg_latest_prices
          const { data: latestPrice } = await supabase
            .from('tcg_latest_prices')
            .select('median_price, currency')
            .eq('sku', item.sku)
            .order('as_of', { ascending: false })
            .limit(1)
            .single();

          median = latestPrice
            ? convertPrice(parseFloat(latestPrice.median_price), latestPrice.currency)
            : null;

          // Try using tcg_price_daily_medians view
          const { data: dailyMedians, error: dailyError } = await supabase
            .from('tcg_price_daily_medians')
            .select('day, median_price, currency')
            .eq('sku', item.sku)
            .gte('day', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('day', { ascending: true });

          if (!dailyError && dailyMedians && dailyMedians.length > 0) {
            // Generate last 7 days
            const today = new Date();
            const last7Days: string[] = [];
            for (let i = 6; i >= 0; i--) {
              const date = new Date(today);
              date.setDate(date.getDate() - i);
              last7Days.push(date.toISOString().split('T')[0]);
            }

            // Create a map of day -> price
            const priceMap = new Map<string, number>();
            dailyMedians.forEach((dm: any) => {
              const price = convertPrice(parseFloat(dm.median_price), dm.currency);
              if (price !== null) {
                priceMap.set(dm.day, price);
              }
            });

            // Fill series with data or null for missing days
            series7d = last7Days.map(day => priceMap.get(day) || null);

            // Calculate delta
            const price7dAgo = series7d[0];
            const priceToday = series7d[series7d.length - 1];
            if (price7dAgo && priceToday && price7dAgo > 0) {
              delta7dPct = ((priceToday - price7dAgo) / price7dAgo) * 100;
            }
          }

          // Fetch source counts
          const { data: sourceCounts } = await supabase
            .from('tcg_latest_prices')
            .select('source')
            .eq('sku', item.sku)
            .gte('as_of', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

          const sourceCountMap = new Map<string, number>();
          sourceCounts?.forEach((sc: any) => {
            const source = sc.source?.toLowerCase() || 'unknown';
            sourceCountMap.set(source, (sourceCountMap.get(source) || 0) + 1);
          });

          sources = [
            { name: 'ebay' as const, count: sourceCountMap.get('ebay') || 0 },
            { name: 'tcgplayer' as const, count: sourceCountMap.get('tcgplayer') || 0 },
          ];
        } else if (isSneaker) {
          // Sneakers: use StockX data
          // Default to most popular size (UK9 / US10) for Quick-Add preview
          const { data: latestPrice } = await supabase
            .from('stockx_latest_prices')
            .select('last_sale, lowest_ask')
            .eq('sku', item.sku)
            .eq('size', '9') // UK9
            .order('as_of', { ascending: false })
            .limit(1)
            .single();

          // Use last_sale as median for sneakers
          median = latestPrice?.last_sale || latestPrice?.lowest_ask || null;

          // Fetch 7-day price history from stockx_price_daily_medians
          const { data: dailyMedians, error: dailyError } = await supabase
            .from('stockx_price_daily_medians')
            .select('price_date, median_price')
            .eq('sku', item.sku)
            .eq('size', '9') // UK9
            .eq('currency', currency)
            .gte('price_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('price_date', { ascending: true });

          if (!dailyError && dailyMedians && dailyMedians.length > 0) {
            // Generate last 7 days
            const today = new Date();
            const last7Days: string[] = [];
            for (let i = 6; i >= 0; i--) {
              const date = new Date(today);
              date.setDate(date.getDate() - i);
              last7Days.push(date.toISOString().split('T')[0]);
            }

            // Create a map of day -> price
            const priceMap = new Map<string, number>();
            dailyMedians.forEach((dm: any) => {
              priceMap.set(dm.price_date, parseFloat(dm.median_price));
            });

            // Fill series with data or null for missing days
            series7d = last7Days.map(day => priceMap.get(day) || null);

            // Calculate delta
            const price7dAgo = series7d[0];
            const priceToday = series7d[series7d.length - 1];
            if (price7dAgo && priceToday && price7dAgo > 0) {
              delta7dPct = ((priceToday - price7dAgo) / price7dAgo) * 100;
            }
          }

          // StockX source count
          const { data: sourceCounts } = await supabase
            .from('stockx_market_prices')
            .select('source')
            .eq('sku', item.sku)
            .gte('as_of', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

          sources = [
            { name: 'ebay' as const, count: sourceCounts?.filter(s => s.source === 'stockx').length || 0 },
            { name: 'tcgplayer' as const, count: 0 },
          ];
        }

        // Build result object
        const name = isPokemon ? item.name : `${item.brand} ${item.model}`;
        const subtitle = isPokemon
          ? `${item.set_name} • ${item.language} • sealed`
          : item.colorway || item.model;

        return {
          sku: item.sku,
          name,
          subtitle,
          imageUrl: item.image_url || '',
          currency: currency as 'GBP' | 'EUR' | 'USD',
          median,
          delta7dPct,
          series7d,
          tags: isPokemon ? [item.language, 'sealed'] : ['sneaker'],
          sources,
          category: item.category,
        };
      })
    );

    resultCount = enrichedResults.length;

    const responseData = {
      results: enrichedResults,
      count: enrichedResults.length,
      _meta: {
        duration_ms: Date.now() - startTime,
        cache: 'miss',
      },
    };

    // Cache the result for 60s
    marketSearchCache.set(cacheKey, responseData);

    // Log API request (cache miss) with category breakdown
    const categoryCount = enrichedResults.reduce((acc: any, r: any) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {});

    logger.apiRequest('/api/market/search',
      { q: query, currency },
      Date.now() - startTime,
      {
        cache: 'miss',
        resultCount,
        categories: categoryCount,
      }
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
