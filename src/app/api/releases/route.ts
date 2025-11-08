// Releases API - Returns upcoming/past releases with optional filtering
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month'); // YYYY-MM format
    const brand = searchParams.get('brand');
    const status = searchParams.get('status') || 'upcoming';
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = await createClient();

    let query = supabase
      .from('releases')
      .select(`
        *,
        release_products (
          sku,
          product_catalog (
            brand,
            model,
            colorway,
            image_url
          )
        )
      `)
      .order('release_date', { ascending: status === 'upcoming' });

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    }

    // Filter by month
    if (month) {
      const startDate = `${month}-01`;
      const endDate = `${month}-31`; // Simplified, works for all months
      query = query.gte('release_date', startDate).lte('release_date', endDate);
    }

    // Filter by brand
    if (brand) {
      query = query.ilike('brand', `%${brand}%`);
    }

    // Apply limit
    query = query.limit(limit);

    const { data: releases, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch releases: ${error.message}`);
    }

    // Transform data to include SKUs array
    const transformedReleases = (releases || []).map((release: any) => ({
      ...release,
      skus: release.release_products?.map((rp: any) => rp.sku) || [],
      products: release.release_products?.map((rp: any) => rp.product_catalog).filter(Boolean) || [],
      release_products: undefined, // Remove nested structure
    }));

    return NextResponse.json({
      releases: transformedReleases,
      count: transformedReleases.length,
      filters: { month, brand, status, limit },
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
