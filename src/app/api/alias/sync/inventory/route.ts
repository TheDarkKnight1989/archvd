/**
 * Alias Inventory Sync API Route
 * POST /api/alias/sync/inventory
 *
 * Syncs Alias market data for all inventory items that have Alias catalog mappings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAliasClient } from '@/lib/services/alias';
import { syncAllAliasMarketData } from '@/lib/services/alias/sync';
import {
  AliasAPIError,
  AliasAuthenticationError,
} from '@/lib/services/alias/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * POST /api/alias/sync/inventory
 * Syncs market data from Alias API for all mapped inventory items
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { limit } = body;

    console.log('[Alias Inventory Sync] Starting sync', { limit });

    const client = createAliasClient();

    // Sync all Alias market data
    const result = await syncAllAliasMarketData(client, {
      limit: limit || undefined,
    });

    console.log('[Alias Inventory Sync] Sync complete:', {
      totalItems: result.totalItems,
      successCount: result.successCount,
      errorCount: result.errorCount,
    });

    return NextResponse.json({
      success: true,
      totalItems: result.totalItems,
      successCount: result.successCount,
      errorCount: result.errorCount,
      results: result.results,
    });

  } catch (error) {
    console.error('[Alias Inventory Sync] Error:', error);

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
