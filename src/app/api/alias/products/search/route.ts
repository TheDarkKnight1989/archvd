/**
 * Alias Product Search API
 * GET /api/alias/products/search?q=<query>&brand=<brand>&limit=<limit>
 * Feature-flagged read-only endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAliasEnabled, isAliasFullyConfigured, isAliasMockMode } from '@/lib/config/alias';
import { createUserAliasService } from '@/lib/integrations/alias';
import { logger } from '@/lib/logger';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Check feature flag
    if (!isAliasEnabled()) {
      logger.info('[API /alias/products/search] Feature disabled');
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
      logger.info('[API /alias/products/search] Mock mode active');

      // Parse query params
      const searchParams = request.nextUrl.searchParams;
      const query = searchParams.get('q') || searchParams.get('query') || '';
      const brand = searchParams.get('brand') || undefined;
      const limit = parseInt(searchParams.get('limit') || '10', 10);
      const page = parseInt(searchParams.get('page') || '1', 10);

      // Read mock fixture
      const fixturesPath = path.join(process.cwd(), 'fixtures', 'alias', 'products-search.json');
      const fixtureData = await fs.readFile(fixturesPath, 'utf-8');
      const mockData = JSON.parse(fixtureData);

      // Filter by query (case-insensitive match on name, brand, or SKU)
      let filteredResults = mockData.results;
      if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        filteredResults = mockData.results.filter((product: any) =>
          product.name?.toLowerCase().includes(lowerQuery) ||
          product.brand?.toLowerCase().includes(lowerQuery) ||
          product.sku?.toLowerCase().includes(lowerQuery) ||
          product.model?.toLowerCase().includes(lowerQuery)
        );
      }

      // Filter by brand if specified
      if (brand) {
        filteredResults = filteredResults.filter((product: any) =>
          product.brand?.toLowerCase() === brand.toLowerCase()
        );
      }

      const duration = Date.now() - startTime;

      return NextResponse.json({
        results: filteredResults.slice(0, limit).map((product: any) => ({
          id: product.id,
          slug: product.slug,
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          model: product.model,
          colorway: product.colorway,
          image: product.mainPictureUrl,
          retailPrice: product.retailPrice,
          retailCurrency: product.retailCurrency,
          releaseDate: product.releaseDate,
          category: product.category,
        })),
        pagination: {
          total: filteredResults.length,
          page,
          limit,
          hasMore: filteredResults.length > limit,
        },
        _meta: {
          duration_ms: duration,
          source: 'alias_mock',
          mode: 'mock',
        },
      });
    }

    if (!isAliasFullyConfigured()) {
      logger.warn('[API /alias/products/search] Not fully configured');
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

    // 4. Parse query params
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const brand = searchParams.get('brand') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    if (!query.trim()) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Query parameter "q" is required',
        },
        { status: 400 }
      );
    }

    // 5. Create Alias service for user
    // TODO: For Phase 1, use system-level service (no user token needed for search)
    // In Phase 2, we'll use user tokens from alias_accounts table
    const aliasService = await createUserAliasService(user.id);

    if (!aliasService) {
      // TODO(auth): User hasn't connected Alias account yet
      logger.info('[API /alias/products/search] User not connected', {
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

    // 6. Execute search
    const results = await aliasService.searchProducts({
      query,
      brand,
      limit,
      page,
    });

    const duration = Date.now() - startTime;

    // 7. Return sanitized shape matching our Market overlay format
    return NextResponse.json({
      results: results.results.map((product) => ({
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        model: product.model,
        colorway: product.colorway,
        image: product.mainPictureUrl,
        retailPrice: product.retailPrice,
        retailCurrency: product.retailCurrency,
        releaseDate: product.releaseDate,
        category: product.category,
      })),
      pagination: {
        total: results.total,
        page: results.page,
        limit: results.limit,
        hasMore: results.hasMore,
      },
      _meta: {
        duration_ms: duration,
        source: 'alias_goat',
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[API /alias/products/search] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to search products',
        code: error.code || 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}
