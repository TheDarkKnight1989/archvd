/**
 * Alias Regions API Route
 * GET /api/alias/regions
 *
 * Fetches all available regions from Alias API
 */

import { NextResponse } from 'next/server';
import { createAliasClient } from '@/lib/services/alias';
import { getAliasRegions, getUKRegionId } from '@/lib/services/alias/regions';
import {
  AliasAPIError,
  AliasAuthenticationError,
} from '@/lib/services/alias/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/alias/regions
 * Returns all available regions from Alias API
 */
export async function GET() {
  try {
    const client = createAliasClient();

    // Fetch all regions
    const regions = await getAliasRegions(client);

    // Also fetch UK region ID for convenience
    const ukRegionId = await getUKRegionId(client);

    console.log('[Alias Regions] Fetched regions:', {
      total: regions.length,
      ukRegionId,
      regions: regions.map(r => ({ id: r.id, name: r.name })),
    });

    return NextResponse.json({
      success: true,
      regions,
      ukRegionId,
      count: regions.length,
    });

  } catch (error) {
    console.error('[Alias Regions] Error:', error);

    if (error instanceof AliasAuthenticationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication Error',
          message: error.message,
          hint: 'Check that ALIAS_PAT environment variable is set correctly',
        },
        { status: 401 }
      );
    }

    if (error instanceof AliasAPIError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Alias API Error',
          message: error.message,
          statusCode: error.statusCode,
          userMessage: error.getUserMessage(),
        },
        { status: error.statusCode }
      );
    }

    // Unknown error
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
