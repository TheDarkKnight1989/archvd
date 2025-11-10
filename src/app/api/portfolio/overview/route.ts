import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Portfolio Overview API
 * Returns KPIs, 30-day value history, and category breakdown
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const currency = (searchParams.get('currency') || 'GBP') as 'GBP' | 'EUR' | 'USD';

    const supabase = await createClient();

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all active inventory items with latest prices
    const { data: items, error: itemsError } = await supabase
      .from('portfolio_latest_prices')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (itemsError) {
      throw itemsError;
    }

    if (!items || items.length === 0) {
      // Empty portfolio
      logger.apiRequest('/api/portfolio/overview',
        { currency, user_id: user.id },
        Date.now() - startTime,
        { itemCount: 0 }
      );

      return NextResponse.json({
        isEmpty: true,
        kpis: {
          estimatedValue: 0,
          invested: 0,
          unrealisedPL: 0,
          unrealisedPLDelta7d: null,
          roi: 0,
          missingPricesCount: 0,
        },
        series30d: [],
        categoryBreakdown: [],
        missingItems: [],
        meta: {
          pricesAsOf: new Date().toISOString(),
        },
      });
    }

    // Calculate KPIs
    let totalEstimatedValue = 0;
    let totalInvested = 0;
    let missingPricesCount = 0;
    let latestPriceTimestamp: Date | null = null;
    const missingItems: { id: string; sku: string; size_uk: string | null }[] = [];

    const categoryValues = new Map<string, number>();

    items.forEach((item: any) => {
      const quantity = item.quantity || 1;
      const purchasePrice = parseFloat(item.purchase_price || 0);
      const marketPrice = item.latest_market_price ? parseFloat(item.latest_market_price) : null;

      totalInvested += purchasePrice * quantity;

      if (marketPrice) {
        totalEstimatedValue += marketPrice * quantity;

        // Track latest price timestamp
        if (item.price_as_of) {
          const priceDate = new Date(item.price_as_of);
          if (latestPriceTimestamp === null || priceDate > latestPriceTimestamp) {
            latestPriceTimestamp = priceDate;
          }
        }

        // Category breakdown
        const category = item.category || 'Other';
        categoryValues.set(category, (categoryValues.get(category) || 0) + (marketPrice * quantity));
      } else {
        missingPricesCount++;
        // Track items missing prices
        missingItems.push({
          id: item.id,
          sku: item.sku,
          size_uk: item.size_uk || null,
        });
        // For items without market price, use purchase price as fallback
        totalEstimatedValue += purchasePrice * quantity;
        const category = item.category || 'Other';
        categoryValues.set(category, (categoryValues.get(category) || 0) + (purchasePrice * quantity));
      }
    });

    const unrealisedPL = totalEstimatedValue - totalInvested;
    const roi = totalInvested > 0 ? (unrealisedPL / totalInvested) * 100 : 0;

    // Build category breakdown
    const categoryBreakdown = Array.from(categoryValues.entries()).map(([category, value]) => ({
      category,
      value,
      percentage: totalEstimatedValue > 0 ? (value / totalEstimatedValue) * 100 : 0,
    })).sort((a, b) => b.value - a.value);

    // Fetch 30-day value history from portfolio_value_daily materialized view
    const { data: portfolioValues, error: valuesError } = await supabase
      .from('portfolio_value_daily')
      .select('day, value_base_gbp')
      .eq('user_id', user.id)
      .order('day', { ascending: true });

    if (valuesError) {
      logger.error('[Portfolio Overview] Error fetching portfolio values', {
        message: valuesError.message,
        user_id: user.id,
      });
    }

    // Convert to series30d format
    const series30d: { date: string; value: number | null }[] = [];
    const today = new Date();

    // Generate last 30 days
    const valueMap = new Map<string, number>();
    portfolioValues?.forEach((pv: any) => {
      valueMap.set(pv.day, parseFloat(pv.value_base_gbp));
    });

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const value = valueMap.get(dateStr) || null;
      series30d.push({
        date: dateStr,
        value,
      });
    }

    // Calculate 7d delta for P/L
    let unrealisedPLDelta7d = null;
    if (series30d.length >= 8) {
      const value7dAgo = series30d[series30d.length - 8]?.value;
      const valueToday = series30d[series30d.length - 1]?.value;

      if (value7dAgo && valueToday && value7dAgo > 0) {
        unrealisedPLDelta7d = ((valueToday - value7dAgo) / value7dAgo) * 100;
      }
    }

    // Prepare pricesAsOf timestamp
    const pricesAsOfTimestamp = latestPriceTimestamp || new Date();

    const responseData = {
      isEmpty: false,
      kpis: {
        estimatedValue: totalEstimatedValue,
        invested: totalInvested,
        unrealisedPL,
        unrealisedPLDelta7d,
        roi,
        missingPricesCount,
      },
      series30d,
      categoryBreakdown,
      missingItems,
      meta: {
        pricesAsOf: pricesAsOfTimestamp.toISOString(),
      },
    };

    // Calculate series metrics for logging
    const seriesLength = series30d.length;
    const nonNullPoints = series30d.filter(s => s.value !== null).length;
    const dateSpan = series30d.length > 0
      ? `${series30d[0].date} to ${series30d[series30d.length - 1].date}`
      : 'none';

    logger.apiRequest('/api/portfolio/overview',
      { currency, user_id: user.id },
      Date.now() - startTime,
      {
        itemCount: items.length,
        missingPricesCount,
        seriesLength,
        nonNullPoints,
        dateSpan,
      }
    );

    return NextResponse.json(responseData);

  } catch (error: any) {
    logger.error('[Portfolio Overview] Error', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
