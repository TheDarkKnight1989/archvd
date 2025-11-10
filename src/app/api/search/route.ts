// Global search API - Command palette search with rich data
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim();
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category') || 'sealed_pokemon';
    const currency = searchParams.get('currency') || 'GBP';

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [], count: 0 });
    }

    const supabase = await createClient();

    // For now, only search sealed Pokemon products
    if (category === 'sealed_pokemon') {
      // Search Pokemon catalog by name
      const { data: products, error: searchError } = await supabase
        .from('trading_card_catalog')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(limit);

      if (searchError) {
        console.error('[Search API] Error:', searchError);
        throw new Error(`Search failed: ${searchError.message}`);
      }

      if (!products || products.length === 0) {
        return NextResponse.json({ results: [], count: 0 });
      }

      // Get FX rates for currency conversion
      const { data: fxRates } = await supabase
        .from('fx_rates')
        .select('*')
        .order('as_of', { ascending: false })
        .limit(1)
        .single();

      // Helper function to convert price
      const convertPrice = (price: number, fromCurrency: string): number => {
        if (fromCurrency === currency || !fxRates) return price;

        if (fromCurrency === 'GBP' && currency === 'EUR') {
          return price * fxRates.eur_per_gbp;
        }
        if (fromCurrency === 'EUR' && currency === 'GBP') {
          return price * fxRates.gbp_per_eur;
        }

        return price;
      };

      // Fetch latest prices and 7-day series for each product
      const results = await Promise.all(
        products.map(async (product) => {
          // Get latest snapshot
          const { data: latestSnapshot } = await supabase
            .from('trading_card_market_snapshots')
            .select('*')
            .eq('sku', product.sku)
            .order('snapshot_date', { ascending: false })
            .limit(1)
            .single();

          // Get last 7 days of snapshots for sparkline
          const { data: series } = await supabase
            .from('trading_card_market_snapshots')
            .select('snapshot_date, median_price, currency')
            .eq('sku', product.sku)
            .order('snapshot_date', { ascending: false })
            .limit(7);

          let seriesData: number[] = [];
          let deltaPct7d = 0;

          if (series && series.length > 0) {
            // Convert prices and reverse to get oldest→newest
            seriesData = series
              .map((s) => convertPrice(parseFloat(s.median_price || '0'), s.currency))
              .reverse();

            // Calculate 7-day % change
            if (seriesData.length >= 2) {
              const oldest = seriesData[0];
              const newest = seriesData[seriesData.length - 1];
              deltaPct7d = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0;
            }
          } else if (latestSnapshot) {
            // Synthetic series: generate slight variations around current price
            const basePrice = convertPrice(
              parseFloat(latestSnapshot.median_price || '0'),
              latestSnapshot.currency
            );
            seriesData = Array.from({ length: 7 }, (_, i) => {
              const variation = (Math.random() - 0.5) * basePrice * 0.007; // ±0.7%
              return basePrice + variation;
            });
            deltaPct7d = ((seriesData[6] - seriesData[0]) / seriesData[0]) * 100;
          }

          // Build result object
          return {
            sku: product.sku,
            brand: 'Pokémon', // All Pokemon products
            model: product.name,
            colorway: `${product.language} • ${product.set_name}`,
            imageUrl: product.image_url,
            retailPrice: product.retail_price
              ? convertPrice(parseFloat(product.retail_price), product.currency || 'GBP')
              : null,
            latest: latestSnapshot
              ? {
                  price: convertPrice(
                    parseFloat(latestSnapshot.median_price || '0'),
                    latestSnapshot.currency
                  ),
                  currency,
                  asOf: latestSnapshot.snapshot_date,
                  source: latestSnapshot.source || 'snapshot',
                }
              : null,
            series: seriesData,
            deltaPct7d: parseFloat(deltaPct7d.toFixed(2)),
            meta: {
              synthetic: !series || series.length < 7,
              language: product.language,
              setName: product.set_name,
              sealedType: product.sealed_type,
            },
          };
        })
      );

      return NextResponse.json({
        results: results.filter((r) => r.latest !== null), // Only return products with price data
        count: results.length,
      });
    }

    // For future: other categories
    return NextResponse.json({ results: [], count: 0 });
  } catch (error: any) {
    console.error('[Search API] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
