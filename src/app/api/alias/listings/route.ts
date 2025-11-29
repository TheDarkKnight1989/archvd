/**
 * Alias Listings API Route
 * List all listings for authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Get all listings for authenticated user
 * GET /api/alias/listings
 *
 * Query Parameters:
 * - status: Filter by listing status (LISTING_STATUS_ACTIVE, LISTING_STATUS_INACTIVE, etc.)
 * - catalog_id: Filter by catalog ID
 * - inventory_id: Filter by inventory ID
 * - limit: Number of listings to return (default: 50)
 * - offset: Number of listings to skip (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const catalogId = searchParams.get('catalog_id');
    const inventoryId = searchParams.get('inventory_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Build query
    let query = supabase
      .from('alias_listings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (catalogId) {
      query = query.eq('catalog_id', catalogId);
    }
    if (inventoryId) {
      query = query.eq('inventory_id', inventoryId);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: listings, error: fetchError } = await query;

    if (fetchError) {
      console.error('[Alias List Listings] Database error:', fetchError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch listings',
        },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('alias_listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (status) {
      countQuery = countQuery.eq('status', status);
    }
    if (catalogId) {
      countQuery = countQuery.eq('catalog_id', catalogId);
    }
    if (inventoryId) {
      countQuery = countQuery.eq('inventory_id', inventoryId);
    }

    const { count, error: countError } = await countQuery;

    return NextResponse.json({
      success: true,
      listings: listings || [],
      count: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    });

  } catch (error) {
    console.error('[Alias List Listings] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
