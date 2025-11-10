/**
 * Alias Market Stats API
 * GET /api/alias/products/[id]/market?size=<size>
 * Returns market pricing data with 7-day sparkline history
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

    // 2. Parse query params
    const searchParams = request.nextUrl.searchParams;
    const size = searchParams.get('size');

    // 3. Check if mock mode is enabled
    if (isAliasMockMode()) {
      logger.info('[API /alias/products/[id]/market] Mock mode active', {
        id,
        size,
      });

      // Map product ID to fixture file
      const fixtureFileName = id + '.json';
      const fixturesPath = path.join(
        process.cwd(),
        'fixtures',
        'alias',
        'market',
        fixtureFileName
      );

      try {
        const fixtureData = await fs.readFile(fixturesPath, 'utf-8');
        const mockData = JSON.parse(fixtureData);

        // If size is specified, filter variants
        let variants = mockData.variants;
        if (size) {
          variants = mockData.variants.filter((v: any) => v.size === size);
        }

        const duration = Date.now() - startTime;

        return NextResponse.json({
          sku: mockData.sku,
          productTemplateId: mockData.productTemplateId,
          currency: mockData.currency,
          asOf: mockData.asOf,
          variants: variants.map((v: any) => ({
            size: v.size,
            lowestAsk: v.lowestAsk,
            highestBid: v.highestBid,
            lastSale: v.lastSale,
            salesCount: v.salesCount,
            askCount: v.askCount,
            bidCount: v.bidCount,
            salesLast72h: v.salesLast72h,
          })),
          priceHistory7d: mockData.priceHistory7d,
          _meta: {
            duration_ms: duration,
            source: 'alias_mock',
            mode: 'mock',
          },
        });
      } catch (fileError: any) {
        // If fixture file doesn't exist, return 404
        if (fileError.code === 'ENOENT') {
          logger.warn('[API /alias/products/[id]/market] Mock fixture not found', {
            id,
            expectedFile: fixtureFileName,
          });

          return NextResponse.json(
            {
              error: 'Not Found',
              message: `Market data for product ${id} not available in mock mode`,
            },
            { status: 404 }
          );
        }

        throw fileError;
      }
    }

    // 4. Live mode (not yet implemented)
    return NextResponse.json(
      {
        error: 'Not Implemented',
        message: 'Live mode market stats not yet implemented',
        code: 'ALIAS_LIVE_NOT_IMPLEMENTED',
      },
      { status: 501 }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('[API /alias/products/[id]/market] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message || 'Failed to fetch market stats',
      },
      { status: 500 }
    );
  }
}
