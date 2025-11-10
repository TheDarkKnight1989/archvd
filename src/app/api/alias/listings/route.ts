/**
 * Alias Listings API
 * GET /api/alias/listings?status=<status>&page=<page>&limit=<limit>
 * Fetches user's listings and upserts to alias_listings table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAliasEnabled, isAliasFullyConfigured, isAliasMockMode } from '@/lib/config/alias';
import { createUserAliasService } from '@/lib/integrations/alias';
import { logger } from '@/lib/logger';
import type { GoatListing } from '@/lib/services/goat';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Check feature flag
    if (!isAliasEnabled()) {
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message: 'Alias integration is not enabled',
          code: 'ALIAS_DISABLED',
        },
        { status: 501 }
      );
    }

    // 2. Check if mock mode is enabled
    if (isAliasMockMode()) {
      logger.info('[API /alias/listings] Mock mode active');

      // Authenticate user for database operations
      const supabase = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Parse query params
      const searchParams = request.nextUrl.searchParams;
      const status = searchParams.get('status') as 'active' | 'sold' | 'cancelled' | 'expired' | null;
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

      // Read mock fixture
      const fixturesPath = path.join(process.cwd(), 'fixtures', 'alias', 'listings.json');
      const fixtureData = await fs.readFile(fixturesPath, 'utf-8');
      const mockData = JSON.parse(fixtureData);

      // Filter by status if specified
      let filteredListings = mockData.listings;
      if (status) {
        filteredListings = mockData.listings.filter((listing: any) => listing.status === status);
      }

      // Upsert mock data to database for UI testing
      const mockListingsForDb = filteredListings.map((listing: any) => ({
        user_id: user.id,
        alias_account_id: null, // No real account in mock mode
        alias_listing_id: listing.id,
        alias_product_id: listing.id,
        sku: listing.sku,
        size: listing.size,
        ask_price: listing.price,
        currency: listing.currency,
        status: listing.status,
        views: listing.views || 0,
        favorites: listing.favorites || 0,
        listed_at: listing.listedAt,
        synced_at: new Date().toISOString(),
      }));

      // Upsert to database
      if (mockListingsForDb.length > 0) {
        const { error: upsertError } = await supabase
          .from('alias_listings')
          .upsert(mockListingsForDb, {
            onConflict: 'alias_listing_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          logger.error('[API /alias/listings] Mock upsert failed', {
            error: upsertError.message,
          });
        }
      }

      const duration = Date.now() - startTime;

      return NextResponse.json({
        listings: filteredListings.slice((page - 1) * limit, page * limit),
        pagination: {
          page,
          limit,
          total: filteredListings.length,
          totalPages: Math.ceil(filteredListings.length / limit),
        },
        lastSync: new Date().toISOString(),
        _meta: {
          duration_ms: duration,
          freshlyFetched: filteredListings.length,
          source: 'alias_mock',
          mode: 'mock',
        },
      });
    }

    if (!isAliasFullyConfigured()) {
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message: 'Alias integration is not fully configured',
          code: 'ALIAS_NOT_CONFIGURED',
        },
        { status: 501 }
      );
    }

    // 3. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse query params
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as 'active' | 'sold' | 'cancelled' | 'expired' | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100); // Max 100

    // 4. Check if user has Alias account
    const { data: aliasAccount, error: accountError } = await supabase
      .from('alias_accounts')
      .select('id, status, last_sync_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (accountError || !aliasAccount) {
      logger.info('[API /alias/listings] User not connected', {
        user_id: user.id,
      });
      return NextResponse.json(
        {
          error: 'Not Implemented',
          message: 'Please connect your Alias (GOAT) account first',
          code: 'ALIAS_NOT_CONNECTED',
        },
        { status: 501 }
      );
    }

    // 5. Create Alias service for user
    const aliasService = await createUserAliasService(user.id);

    if (!aliasService) {
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to initialize Alias service',
        },
        { status: 500 }
      );
    }

    // 6. Fetch listings from Alias API
    const listings = await aliasService.getListings({
      status: status || undefined,
      page,
      limit,
    });

    logger.info('[API /alias/listings] Fetched from Alias', {
      user_id: user.id,
      count: listings.length,
      status,
    });

    // 7. Upsert to alias_listings table
    const upsertedCount = await upsertListings(supabase, user.id, aliasAccount.id, listings);

    logger.info('[API /alias/listings] Upserted to database', {
      user_id: user.id,
      count: upsertedCount,
    });

    // 8. Update last_sync_at in alias_accounts
    await supabase
      .from('alias_accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', aliasAccount.id);

    // 9. Fetch paginated results from database (single source of truth)
    const { data: dbListings, error: dbError, count: totalCount } = await supabase
      .from('alias_listings')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('listed_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (dbError) {
      throw dbError;
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      listings: dbListings || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
      lastSync: aliasAccount.last_sync_at,
      _meta: {
        duration_ms: duration,
        freshlyFetched: listings.length,
        source: 'alias_goat',
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[API /alias/listings] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch listings',
      },
      { status: 500 }
    );
  }
}

/**
 * Upsert listings to database (idempotent)
 */
async function upsertListings(
  supabase: any,
  userId: string,
  aliasAccountId: string,
  listings: GoatListing[]
): Promise<number> {
  if (listings.length === 0) {
    return 0;
  }

  const rows = listings.map((listing) => ({
    user_id: userId,
    alias_account_id: aliasAccountId,
    alias_listing_id: listing.id,
    alias_product_id: listing.productId,
    sku: listing.sku,
    product_slug: listing.productSlug || null,
    product_name: null, // Not in listing response, would need separate fetch
    brand: null,
    model: null,
    colorway: null,
    image_url: null,
    size: listing.size,
    condition: listing.condition,
    box_condition: listing.boxCondition || null,
    ask_price: listing.price,
    currency: listing.currency,
    status: listing.status,
    quantity: listing.quantity,
    views: listing.views || 0,
    favorites: listing.favorites || 0,
    listed_at: listing.listedAt,
    expires_at: listing.expiresAt || null,
    sold_at: listing.status === 'sold' ? new Date().toISOString() : null,
    last_price_update: listing.lastPriceUpdate || null,
    synced_at: new Date().toISOString(),
  }));

  // Upsert in batches of 50
  const batchSize = 50;
  let upsertedCount = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const { error } = await supabase.from('alias_listings').upsert(batch, {
      onConflict: 'alias_listing_id',
      ignoreDuplicates: false, // Update existing
    });

    if (error) {
      logger.error('[upsertListings] Batch upsert failed', {
        batchIndex: i / batchSize,
        error: error.message,
      });
      throw error;
    }

    upsertedCount += batch.length;
  }

  return upsertedCount;
}
