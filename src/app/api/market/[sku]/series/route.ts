// Market series API - Historical price data for charts
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

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const currency = searchParams.get('currency') || 'GBP';

    const supabase = await createClient();

    // Check if this is a Pokemon product
    const isPokemon = sku.startsWith('PKMN-');

    if (!isPokemon) {
      return NextResponse.json(
        { error: 'Only Pokemon products supported currently' },
        { status: 400 }
      );
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

    // Fetch snapshots for the last N days
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('trading_card_market_snapshots')
      .select('snapshot_date, median_price, min_price, max_price, currency, source')
      .eq('sku', sku)
      .order('snapshot_date', { ascending: true })
      .limit(days);

    if (snapshotsError) {
      console.error('[Series API] Error:', snapshotsError);
      throw new Error(`Failed to fetch series: ${snapshotsError.message}`);
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({
        sku,
        currency,
        series: [],
        meta: { synthetic: false, dataPoints: 0 },
      });
    }

    // Transform snapshots into series data
    const series = snapshots.map((snapshot) => ({
      date: snapshot.snapshot_date,
      value: convertPrice(parseFloat(snapshot.median_price || '0'), snapshot.currency),
      min: convertPrice(parseFloat(snapshot.min_price || '0'), snapshot.currency),
      max: convertPrice(parseFloat(snapshot.max_price || '0'), snapshot.currency),
      source: snapshot.source,
    }));

    // Calculate summary stats
    const values = series.map((s) => s.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

    // Calculate % change
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changePercent = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    return NextResponse.json({
      sku,
      currency,
      series,
      meta: {
        synthetic: false,
        dataPoints: series.length,
        min: parseFloat(minValue.toFixed(2)),
        max: parseFloat(maxValue.toFixed(2)),
        avg: parseFloat(avgValue.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('[Series API] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
