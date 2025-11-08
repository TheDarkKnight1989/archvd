// Releases API - Returns upcoming/past releases with optional filtering
// Updated to use simplified releases table with Matrix V2 pipeline
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Filters
    const brand = searchParams.get('brand');
    const q = searchParams.get('q'); // Search query
    const month = searchParams.get('month'); // YYYY-MM format
    const status = searchParams.get('status'); // upcoming | dropped | tba
    const retailer = searchParams.get('retailer');
    const cursor = searchParams.get('cursor'); // For pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    const supabase = await createClient();

    // Build query - use new releases table
    let query = supabase
      .from('releases')
      .select('*', { count: 'exact' })
      .order('release_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (brand && brand !== 'All Brands') {
      query = query.eq('brand', brand);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // Filter by month
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1).toISOString();
      const endDate = new Date(year, monthNum, 0, 23, 59, 59).toISOString();

      query = query.gte('release_date', startDate).lte('release_date', endDate);
    }

    // Full-text search
    if (q && q.trim()) {
      // Simple ILIKE search across title, brand, model, sku
      query = query.or(`title.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%,sku.ilike.%${q}%`);
    }

    // Cursor-based pagination
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: releases, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch releases: ${error.message}`);
    }

    // Compute next cursor
    let nextCursor: string | null = null;
    if (releases && releases.length === limit) {
      nextCursor = releases[releases.length - 1].created_at;
    }

    return NextResponse.json({
      items: releases || [],
      nextCursor,
      total: count || 0,
      filters: { brand, q, month, status, retailer, limit },
    });

  } catch (error: any) {
    console.error('[Releases API] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST endpoint for adding releases (admin/worker use)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, model, colorway, release_date, source, source_url, image_url, slug, skus } = body;

    if (!brand || !model || !release_date || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: brand, model, release_date, source' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify source is whitelisted
    const { data: whitelisted } = await supabase
      .from('release_sources_whitelist')
      .select('enabled')
      .eq('domain', new URL(source_url || `https://${source}`).hostname)
      .single();

    if (!whitelisted?.enabled) {
      return NextResponse.json(
        { error: 'Source domain not whitelisted' },
        { status: 403 }
      );
    }

    // Insert release
    const { data: release, error: releaseError } = await supabase
      .from('releases')
      .upsert({
        brand,
        model,
        colorway,
        release_date,
        source,
        source_url,
        image_url,
        slug,
        status: new Date(release_date) > new Date() ? 'upcoming' : 'past',
      }, {
        onConflict: 'brand,model,colorway,release_date,source',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (releaseError) {
      throw new Error(`Failed to insert release: ${releaseError.message}`);
    }

    // Link SKUs if provided
    if (skus && Array.isArray(skus) && skus.length > 0) {
      const releaseProducts = skus.map((sku: string) => ({
        release_id: release.id,
        sku: sku.toUpperCase(),
      }));

      const { error: linkError } = await supabase
        .from('release_products')
        .upsert(releaseProducts, {
          onConflict: 'release_id,sku',
          ignoreDuplicates: true,
        });

      if (linkError) {
        console.error('[Releases API] Failed to link SKUs:', linkError.message);
      }
    }

    return NextResponse.json({
      release,
      message: 'Release created successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('[Releases API] Error:', error.message);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
