/**
 * V4 Style Resolve API
 *
 * POST /api/v4/style/resolve
 *
 * Resolves a SKU to a style_catalog entry, creating it if needed.
 * When created, enqueues sync jobs for StockX and Alias.
 *
 * Request body:
 * {
 *   styleId: string           // Required: SKU (e.g., "DD1391-100")
 *   externalIds?: {           // Optional: provider IDs from search
 *     stockxProductId?: string
 *     stockxUrlKey?: string
 *     aliasCatalogId?: string
 *   }
 *   name?: string             // Optional: product name
 *   brand?: string            // Optional: brand name
 *   colorway?: string         // Optional: colorway
 *   imageUrl?: string         // Optional: image URL
 * }
 *
 * Response:
 * {
 *   style: StyleCatalogV4
 *   wasCreated: boolean
 *   syncJobs: Array<{ id: string, provider: 'stockx' | 'alias' }>
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrCreateStyleV4 } from '@/lib/inventory-v4/server'
import type { StyleCatalogV4, SyncProvider } from '@/lib/inventory-v4/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ResolveRequestBody {
  styleId: string
  externalIds?: {
    stockxProductId?: string
    stockxUrlKey?: string
    aliasCatalogId?: string
  }
  name?: string
  brand?: string
  colorway?: string
  imageUrl?: string
}

interface ResolveResponse {
  style: StyleCatalogV4
  wasCreated: boolean
  syncJobs: Array<{ id: string; provider: SyncProvider }>
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ResolveResponse | { error: string }>> {
  try {
    // Auth gate
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as ResolveRequestBody

    // Validate required field
    if (!body.styleId || typeof body.styleId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "styleId" field' },
        { status: 400 }
      )
    }

    const styleId = body.styleId.trim().toUpperCase()
    if (styleId.length < 3) {
      return NextResponse.json(
        { error: 'styleId must be at least 3 characters' },
        { status: 400 }
      )
    }

    // Call existing resolve function
    const result = await resolveOrCreateStyleV4({
      styleId,
      stockxProductId: body.externalIds?.stockxProductId ?? null,
      stockxUrlKey: body.externalIds?.stockxUrlKey ?? null,
      aliasCatalogId: body.externalIds?.aliasCatalogId ?? null,
      name: body.name ?? null,
      brand: body.brand ?? null,
      colorway: body.colorway ?? null,
      imageUrl: body.imageUrl ?? null,
    })

    if (!result.style) {
      return NextResponse.json(
        { error: 'Failed to resolve or create style' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      style: result.style,
      wasCreated: result.wasCreated,
      syncJobs: result.syncJobs ?? [],
    })
  } catch (error) {
    console.error('[API V4 Style Resolve] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Resolve failed: ${message}` },
      { status: 500 }
    )
  }
}
