/**
 * API Authentication Middleware
 * WHY: Protect service-only endpoints from public access
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Verify service-role or cron secret authorization
 * Used by scheduler and worker endpoints
 */
export function withServiceAuth(
  handler: (req: NextRequest) => Promise<Response>
) {
  return async (req: NextRequest) => {
    const authHeader = req.headers.get('authorization')
    const cronSecret = req.headers.get('x-cron-secret')

    // Allow cron secret (for Vercel cron jobs)
    if (cronSecret && cronSecret === process.env.CRON_SECRET) {
      return handler(req)
    }

    // Allow service role key (for internal API calls)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (authHeader && serviceKey) {
      const token = authHeader.replace('Bearer ', '')
      if (token === serviceKey) {
        return handler(req)
      }
    }

    return NextResponse.json(
      { error: 'Unauthorized - service role or cron secret required' },
      { status: 401 }
    )
  }
}
