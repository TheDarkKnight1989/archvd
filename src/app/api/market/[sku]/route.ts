// Market data API - Returns catalog info and per-size prices for a SKU
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

    // Fetch product catalog data
    const { data: catalog, error: productError } = await supabase
      .from('product_catalog')
      .select('*')
      .eq('sku', sku)
      .single();

    if (productError && productError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch product: ${productError.message}`);
    }

    // If no product found, return 404
    if (!catalog) {
      return NextResponse.json(
        { error: 'Product not found', message: `No catalog entry found for SKU: ${sku}` },
        { status: 404 }
      );
    }

    // Fetch latest market prices per size
    const { data: prices, error: pricesError } = await supabase
      .from('latest_market_prices')
      .select('*')
      .eq('sku', sku)
      .order('size', { ascending: true });

    if (pricesError) {
      console.error('[Market API] Price fetch error:', pricesError);
    }

    // Extract distinct sources from prices
    const sources = prices && prices.length > 0
      ? Array.from(new Set(prices.map((p: any) => p.source))).sort()
      : [];

    return NextResponse.json({
      catalog,
      prices: prices || [],
      sources,
    });

  } catch (error: any) {
    console.error('[Market API] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
