import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Watchlist Alerts API
 * Returns recent watchlist alerts (past 7 days) with product details
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;
    const currency = (searchParams.get('currency') || 'GBP') as 'GBP' | 'EUR' | 'USD';
    const days = parseInt(searchParams.get('days') || '7', 10);

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch triggered watchlist items from past N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: watchlistItems, error: watchlistError } = await supabase
      .from('watchlist_items')
      .select(`
        id,
        sku,
        size,
        target_price,
        currency,
        last_triggered_at,
        watchlists!inner(name)
      `)
      .eq('user_id', user.id)
      .not('last_triggered_at', 'is', null)
      .gte('last_triggered_at', cutoffDate.toISOString())
      .order('last_triggered_at', { ascending: false });

    if (watchlistError) {
      logger.error('[Watchlist Alerts] Error fetching alerts', {
        message: watchlistError.message,
        user_id: user.id,
      });
      throw watchlistError;
    }

    if (!watchlistItems || watchlistItems.length === 0) {
      const duration = Date.now() - startTime;
      logger.apiRequest('/api/watchlists/alerts',
        { user_id: user.id, currency, days },
        duration,
        { alertCount: 0 }
      );

      return NextResponse.json({
        alerts: [],
        count: 0,
        _meta: { duration_ms: duration },
      });
    }

    // Enrich with product details and current prices
    const enrichedAlerts = await Promise.all(
      watchlistItems.map(async (item: any) => {
        const isPokemon = item.sku.startsWith('PKMN-');

        let productName = item.sku;
        let imageUrl = '';
        let currentPrice: number | null = null;

        if (isPokemon) {
          // Fetch Pokémon details
          const { data: pokemonData } = await supabase
            .from('tcg_latest_prices')
            .select('name, image_url, median_price, currency')
            .eq('sku', item.sku)
            .limit(1)
            .single();

          if (pokemonData) {
            productName = pokemonData.name;
            imageUrl = pokemonData.image_url || '';
            currentPrice = parseFloat(pokemonData.median_price);
          }
        } else {
          // Fetch sneaker details
          const { data: sneakerData } = await supabase
            .from('sneaker_latest_prices')
            .select('brand, model, image_url, median_price, currency')
            .eq('sku', item.sku)
            .eq('size', item.size || 'UK9')
            .limit(1)
            .single();

          if (sneakerData) {
            productName = `${sneakerData.brand} ${sneakerData.model}`;
            imageUrl = sneakerData.image_url || '';
            currentPrice = parseFloat(sneakerData.median_price);
          }
        }

        // Calculate delta percentage
        const targetPrice = parseFloat(item.target_price);
        const deltaPct = currentPrice && targetPrice > 0
          ? ((currentPrice - targetPrice) / targetPrice) * 100
          : null;

        // Format triggered timestamp
        const triggeredAt = new Date(item.last_triggered_at);
        const now = new Date();
        const diffMs = now.getTime() - triggeredAt.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let triggeredAtFormatted: string;
        if (diffMins < 1) triggeredAtFormatted = 'Just now';
        else if (diffMins < 60) triggeredAtFormatted = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        else if (diffHours < 24) triggeredAtFormatted = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        else triggeredAtFormatted = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return {
          id: item.id,
          sku: item.sku,
          size: item.size,
          name: productName,
          imageUrl,
          targetPrice,
          currentPrice,
          deltaPct,
          currency: item.currency,
          watchlistName: item.watchlists?.name || 'Watchlist',
          triggeredAt: item.last_triggered_at,
          triggeredAtFormatted,
          category: isPokemon ? 'pokemon' : 'sneaker',
        };
      })
    );

    // Calculate category breakdown
    const categoryBreakdown = enrichedAlerts.reduce((acc: any, alert: any) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {});

    const duration = Date.now() - startTime;
    logger.apiRequest('/api/watchlists/alerts',
      { user_id: user.id, currency, days },
      duration,
      {
        alertCount: enrichedAlerts.length,
        categoryBreakdown,
      }
    );

    return NextResponse.json({
      alerts: enrichedAlerts,
      count: enrichedAlerts.length,
      _meta: {
        duration_ms: duration,
        days,
      },
    });

  } catch (error: any) {
    logger.error('[Watchlist Alerts] Error', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
