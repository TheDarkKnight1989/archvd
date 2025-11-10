// Market data API - Returns catalog info and per-size prices for a SKU
// Supports both sneakers (product_catalog) and Pokémon (trading_card_catalog)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  try {
    const { sku: skuParam } = await params;
    const sku = skuParam?.toUpperCase();

    if (!sku) {
      return NextResponse.json(
        { error: 'SKU parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const targetCurrency = searchParams.get('currency') || 'GBP';

    // Detect product type by SKU prefix
    const isPokemon = sku.startsWith('PKMN-');

    // Fetch product catalog data (sneaker or Pokémon)
    let catalog = null;
    let productError = null;

    if (isPokemon) {
      // Fetch from trading_card_catalog
      const { data, error } = await supabase
        .from('trading_card_catalog')
        .select('*')
        .eq('sku', sku)
        .single();

      catalog = data;
      productError = error;
    } else {
      // Fetch from product_catalog (sneakers)
      const { data, error } = await supabase
        .from('product_catalog')
        .select('*')
        .eq('sku', sku)
        .single();

      catalog = data;
      productError = error;
    }

    if (productError && productError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch product: ${productError.message}`);
    }

    // If no product found, return 404
    if (!catalog) {
      return NextResponse.json(
        {
          error: 'Product not found',
          message: `No catalog entry found for SKU: ${sku}`,
          category: isPokemon ? 'pokemon' : 'sneaker'
        },
        { status: 404 }
      );
    }

    // Fetch latest market prices (different for sneakers vs Pokémon)
    let prices = [];
    let pricesError = null;

    if (isPokemon) {
      // Fetch from tcg_latest_prices (per source, not per size)
      const { data, error } = await supabase
        .from('tcg_latest_prices')
        .select('*')
        .eq('sku', sku)
        .order('source', { ascending: true });

      prices = data || [];
      pricesError = error;
    } else {
      // Fetch from latest_market_prices (per size)
      const { data, error } = await supabase
        .from('latest_market_prices')
        .select('*')
        .eq('sku', sku)
        .order('size', { ascending: true });

      prices = data || [];
      pricesError = error;
    }

    if (pricesError) {
      console.error('[Market API] Price fetch error:', pricesError);
    }

    // Fetch FX rates for currency normalization
    const { data: fxRates } = await supabase
      .from('fx_rates')
      .select('*')
      .order('as_of', { ascending: false })
      .limit(1)
      .single();

    // Helper function to convert price to target currency
    const convertPrice = (price: number, fromCurrency: string): number => {
      if (fromCurrency === targetCurrency || !fxRates) return price;

      if (fromCurrency === 'GBP' && targetCurrency === 'EUR') {
        return price * fxRates.eur_per_gbp;
      }
      if (fromCurrency === 'EUR' && targetCurrency === 'GBP') {
        return price * fxRates.gbp_per_eur;
      }

      return price;
    };

    // Transform prices with currency normalization
    let normalizedPrices;
    if (isPokemon) {
      // For Pokémon: snapshots include min/median/p75/max per source
      normalizedPrices = (prices || []).map((p: any) => ({
        source: p.source,
        min_price: convertPrice(parseFloat(p.min_price || 0), p.currency),
        median_price: convertPrice(parseFloat(p.median_price || 0), p.currency),
        p75_price: convertPrice(parseFloat(p.p75_price || 0), p.currency),
        max_price: convertPrice(parseFloat(p.max_price || 0), p.currency),
        listing_count: p.listing_count,
        currency: targetCurrency,
        as_of: p.as_of,
        language: p.language,
        set_name: p.set_name,
        sealed_type: p.sealed_type,
      }));
    } else {
      // For sneakers: per-size prices
      normalizedPrices = (prices || []).map((p: any) => ({
        size: p.size,
        price: convertPrice(parseFloat(p.price), p.currency),
        currency: targetCurrency,
        source: p.source,
        as_of: p.as_of,
        meta: p.meta,
      }));
    }

    // Calculate statistics (median, min, max)
    let latest = null;
    if (normalizedPrices.length > 0) {
      if (isPokemon) {
        // For Pokémon: aggregate across all sources using median_price
        const medianValues = normalizedPrices.map((p: any) => p.median_price).sort((a, b) => a - b);
        const allMins = normalizedPrices.map((p: any) => p.min_price);
        const allMaxs = normalizedPrices.map((p: any) => p.max_price);
        const totalListings = normalizedPrices.reduce((sum: number, p: any) => sum + (p.listing_count || 0), 0);

        latest = {
          median: medianValues.length > 0
            ? medianValues.length % 2 === 0
              ? (medianValues[medianValues.length / 2 - 1] + medianValues[medianValues.length / 2]) / 2
              : medianValues[Math.floor(medianValues.length / 2)]
            : 0,
          min: Math.min(...allMins),
          max: Math.max(...allMaxs),
          count: totalListings,
        };
      } else {
        // For sneakers: calculate from per-size prices
        const priceValues = normalizedPrices.map((p: any) => p.price).sort((a, b) => a - b);
        const median = priceValues.length > 0
          ? priceValues.length % 2 === 0
            ? (priceValues[priceValues.length / 2 - 1] + priceValues[priceValues.length / 2]) / 2
            : priceValues[Math.floor(priceValues.length / 2)]
          : 0;

        const min = Math.min(...priceValues);
        const max = Math.max(...priceValues);

        latest = {
          median,
          min,
          max,
          count: normalizedPrices.length,
        };
      }
    }

    // Extract distinct sources from prices
    const sources = prices && prices.length > 0
      ? Array.from(new Set(prices.map((p: any) => p.source))).sort()
      : [];

    // Normalize catalog data based on type
    let normalizedCatalog;
    if (isPokemon) {
      normalizedCatalog = {
        sku: catalog.sku,
        name: catalog.name,
        language: catalog.language,
        set_code: catalog.set_code,
        set_name: catalog.set_name,
        sealed_type: catalog.sealed_type,
        image_url: catalog.image_url,
        retail_price: catalog.retail_price
          ? convertPrice(parseFloat(catalog.retail_price), catalog.currency || 'GBP')
          : null,
        category: 'pokemon',
      };
    } else {
      normalizedCatalog = {
        sku: catalog.sku,
        brand: catalog.brand,
        model: catalog.model,
        colorway: catalog.colorway,
        image_url: catalog.image_url,
        release_date: catalog.release_date,
        retail_price: catalog.retail_price
          ? convertPrice(parseFloat(catalog.retail_price), catalog.retail_currency || 'GBP')
          : null,
        meta: catalog.meta,
        category: 'sneaker',
      };
    }

    return NextResponse.json({
      catalog: normalizedCatalog,
      prices: normalizedPrices,
      sources,
      latest,
      category: isPokemon ? 'pokemon' : 'sneaker',
    });

  } catch (error: any) {
    console.error('[Market API] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
