/**
 * V4 Unified Search API
 *
 * POST /api/v4/search
 *
 * Searches across:
 * - Local database (inventory_v4_style_catalog)
 * - StockX API
 * - Alias API
 *
 * REQUIRES AUTHENTICATION - prevents abuse of external API calls.
 *
 * Request body:
 * {
 *   query: string           // Required: search query (SKU, name, or URL)
 *   limit?: number          // Optional: max results (default: 10)
 *   includeExternal?: boolean // Optional: include StockX/Alias APIs (default: true)
 * }
 *
 * Response:
 * {
 *   results: SearchResultV4[]
 *   query: string
 *   inputType: InputType
 *   timing: { total: number, local?: number, stockx?: number, alias?: number }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
// Import from server entry point (has `import 'server-only'` guard)
import { unifiedSearchV4 } from '@/lib/inventory-v4/server'
import type { SearchResponseV4 } from '@/lib/inventory-v4/types'

// Force Node.js runtime - this route uses service role key and must not run on Edge
export const runtime = 'nodejs'

// Disable caching - search results are user-specific and shouldn't be cached
export const dynamic = 'force-dynamic'

interface SearchRequestBody {
  query: string
  limit?: number
  includeExternal?: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse<SearchResponseV4 | { error: string }>> {
  try {
    // Auth gate - prevent anonymous abuse of external API calls
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as SearchRequestBody

    // Validate required fields
    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "query" field' },
        { status: 400 }
      )
    }

    const query = body.query.trim()
    if (query.length === 0) {
      return NextResponse.json(
        { error: 'Query cannot be empty' },
        { status: 400 }
      )
    }

    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Validate optional fields (max 25 to match search module limit)
    const limit = body.limit ?? 10
    if (typeof limit !== 'number' || limit < 1 || limit > 25) {
      return NextResponse.json(
        { error: 'Limit must be a number between 1 and 25' },
        { status: 400 }
      )
    }

    // Validate includeExternal type (prevent "false" string being truthy)
    if (body.includeExternal !== undefined && typeof body.includeExternal !== 'boolean') {
      return NextResponse.json(
        { error: '"includeExternal" must be a boolean' },
        { status: 400 }
      )
    }
    const includeExternal = body.includeExternal ?? true

    // Execute search
    const result = await unifiedSearchV4(query, {
      limit,
      includeExternal,
    })

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[API V4 Search] Error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Search failed: ${message}` },
      { status: 500 }
    )
  }
}

// Also support GET for simple queries
export async function GET(request: NextRequest): Promise<NextResponse<SearchResponseV4 | { error: string }>> {
  try {
    // Auth gate - prevent anonymous abuse of external API calls
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const rawQuery = searchParams.get('q') || searchParams.get('query')

    if (!rawQuery) {
      return NextResponse.json(
        { error: 'Missing query parameter "q" or "query"' },
        { status: 400 }
      )
    }

    // Apply same validation as POST
    const query = rawQuery.trim()
    if (query.length === 0) {
      return NextResponse.json(
        { error: 'Query cannot be empty' },
        { status: 400 }
      )
    }

    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Parse limit with NaN fallback to default (max 25 to match search module)
    const parsedLimit = parseInt(searchParams.get('limit') || '10', 10)
    const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(Math.max(parsedLimit, 1), 25)

    const includeExternal = searchParams.get('external') !== 'false'

    const result = await unifiedSearchV4(query, {
      limit,
      includeExternal,
    })

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[API V4 Search] Error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Search failed: ${message}` },
      { status: 500 }
    )
  }
}
