/**
 * Alias Product Details API
 * GET /api/alias/products/[id]
 * Returns detailed product information
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAliasEnabled, isAliasMockMode } from '@/lib/config/alias';
import { logger } from '@/lib/logger';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    // Await params (Next.js 16 requirement)
    const { id } = await params;

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
      logger.info('[API /alias/products/[id]] Mock mode active', { id });

      // Read mock products fixture
      const fixturesPath = path.join(process.cwd(), 'fixtures', 'alias', 'products-search.json');
      const fixtureData = await fs.readFile(fixturesPath, 'utf-8');
      const mockData = JSON.parse(fixtureData);

      // Find product by ID
      const product = mockData.results.find((p: any) => p.id === id);

      if (!product) {
        return NextResponse.json(
          {
            error: 'Not Found',
            message: `Product with ID ${id} not found`,
          },
          { status: 404 }
        );
      }

      const duration = Date.now() - startTime;

      return NextResponse.json({
        product: {
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
          description: product.description || null,
        },
        _meta: {
          duration_ms: duration,
          source: 'alias_mock',
          mode: 'mock',
        },
      });
    }

    // 3. Live mode (not yet implemented)
    return NextResponse.json(
      {
        error: 'Not Implemented',
        message: 'Live mode product details not yet implemented',
        code: 'ALIAS_LIVE_NOT_IMPLEMENTED',
      },
      { status: 501 }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[API /alias/products/[id]] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch product details',
      },
      { status: 500 }
    );
  }
}
