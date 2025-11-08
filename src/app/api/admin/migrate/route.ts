/**
 * Temporary admin endpoint to apply database migration
 * Protected by CRON_SECRET
 * DELETE THIS FILE after running the migration!
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const secretFromQuery = request.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` || secretFromQuery === cronSecret

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const errors: string[] = []

  try {
    console.log('[Migrate] Starting database migration...')

    // Step 1: Rename columns in release_sources_whitelist
    console.log('[Migrate] Step 1: Checking release_sources_whitelist columns')

    // We can't execute raw SQL via Supabase JS client easily
    // So we'll use a workaround: update the data after checking structure

    const { data: sources, error: sourcesError } = await supabase
      .from('release_sources_whitelist')
      .select('*')
      .limit(1)

    if (sourcesError) {
      errors.push(`Failed to query release_sources_whitelist: ${sourcesError.message}`)
    } else {
      console.log('[Migrate] release_sources_whitelist table exists')
      console.log('[Migrate] Sample row:', sources?.[0])

      // Check if columns need migration
      const firstRow = sources?.[0]
      if (firstRow && ('domain' in firstRow || 'name' in firstRow)) {
        errors.push('❌ Column migration required but cannot be done via Supabase JS client')
        errors.push('Please run the SQL migration manually via Supabase SQL Editor')
        errors.push('File: supabase/migrations/20250108_fix_release_sources_columns.sql')
      } else if (firstRow && !('source_name' in firstRow)) {
        errors.push('⚠️  Unknown table structure - manual migration required')
      } else {
        console.log('[Migrate] ✓ Columns already migrated or correct')
      }
    }

    // Step 2: Create worker_logs table
    console.log('[Migrate] Step 2: Checking worker_logs table')
    const { error: logsError } = await supabase
      .from('worker_logs')
      .select('*')
      .limit(1)

    if (logsError) {
      errors.push(`worker_logs table missing: ${logsError.message}`)
      errors.push('Please create it via SQL Editor')
    } else {
      console.log('[Migrate] ✓ worker_logs table exists')
    }

    console.log('[Migrate] Migration check complete')

    return NextResponse.json({
      status: errors.length === 0 ? 'ready' : 'needs_migration',
      errors,
      instructions: errors.length > 0 ? [
        '1. Go to Supabase Dashboard > SQL Editor',
        '2. Open: supabase/migrations/20250108_fix_release_sources_columns.sql',
        '3. Copy the entire SQL content',
        '4. Paste into SQL Editor and click Run',
        '5. Verify with: node scripts/check-db-state.mjs',
        '6. Delete this file: src/app/api/admin/migrate/route.ts'
      ] : [
        'Migration already applied!',
        'You can delete this file: src/app/api/admin/migrate/route.ts'
      ]
    })
  } catch (error: any) {
    console.error('[Migrate] Error:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
        errors
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
