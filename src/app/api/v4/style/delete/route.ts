/**
 * V4 Style Delete API
 *
 * DELETE /api/v4/style/delete?styleId=DD1391-100
 *
 * Deletes a style from the V4 style catalog.
 * Also removes any pending sync jobs for that style.
 *
 * IMPORTANT: Does NOT touch V3/legacy tables.
 *
 * Query params:
 *   styleId: string  // Required: SKU to delete
 *
 * Response:
 * {
 *   deleted: boolean
 *   styleId: string
 *   syncJobsRemoved: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface DeleteResponse {
  deleted: boolean
  styleId: string
  syncJobsRemoved: number
}

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<DeleteResponse | { error: string }>> {
  try {
    // Auth gate
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const styleId = request.nextUrl.searchParams.get('styleId')

    // Validate required field
    if (!styleId || typeof styleId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "styleId" query parameter' },
        { status: 400 }
      )
    }

    const normalizedStyleId = styleId.trim().toUpperCase()
    if (normalizedStyleId.length < 3) {
      return NextResponse.json(
        { error: 'styleId must be at least 3 characters' },
        { status: 400 }
      )
    }

    // Check if style exists first
    const { data: existingStyle, error: checkError } = await supabase
      .from('inventory_v4_style_catalog')
      .select('style_id')
      .eq('style_id', normalizedStyleId)
      .maybeSingle()

    if (checkError) {
      console.error('[API V4 Style Delete] Check error:', checkError)
      return NextResponse.json(
        { error: `Failed to check style: ${checkError.message}` },
        { status: 500 }
      )
    }

    if (!existingStyle) {
      return NextResponse.json(
        { error: `Style "${normalizedStyleId}" not found in catalog` },
        { status: 404 }
      )
    }

    // Step 1: Delete any pending sync jobs for this style
    const { data: removedJobs, error: queueError } = await supabase
      .from('inventory_v4_sync_queue')
      .delete()
      .eq('style_id', normalizedStyleId)
      .select('id')

    if (queueError) {
      console.error('[API V4 Style Delete] Queue cleanup error:', queueError)
      // Non-fatal - continue with catalog delete
    }

    const syncJobsRemoved = removedJobs?.length ?? 0

    // Step 2: Delete from style catalog
    const { error: catalogError } = await supabase
      .from('inventory_v4_style_catalog')
      .delete()
      .eq('style_id', normalizedStyleId)

    if (catalogError) {
      console.error('[API V4 Style Delete] Catalog delete error:', catalogError)
      return NextResponse.json(
        { error: `Failed to delete style: ${catalogError.message}` },
        { status: 500 }
      )
    }

    console.log(`[API V4 Style Delete] Deleted ${normalizedStyleId}, removed ${syncJobsRemoved} sync jobs`)

    return NextResponse.json({
      deleted: true,
      styleId: normalizedStyleId,
      syncJobsRemoved,
    })
  } catch (error) {
    console.error('[API V4 Style Delete] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Delete failed: ${message}` },
      { status: 500 }
    )
  }
}
