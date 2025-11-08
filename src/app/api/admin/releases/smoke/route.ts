// Smoke test endpoint - Test release parsing without DB writes
// Node runtime required for cheerio (used in adapters)
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getAllAdapters } from '../../../workers/releases/adapters'
import type { ExtractionStrategy } from '../../../workers/releases/adapters'

interface SmokeSummary {
  domain: string
  status: number
  htmlLength: number
  strategy: ExtractionStrategy
  parsedCount: number
  sampleTitles: string[]
  warnings: string[]
  errors: string[]
  error?: string
}

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const secretFromQuery = request.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  if (secretFromQuery !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: SmokeSummary[] = []

  // Get all available adapters
  const adapters = getAllAdapters()

  for (const adapter of adapters) {
    try {
      console.log(`[Smoke Test] Testing ${adapter.name}...`)

      // Use adapter to fetch and parse
      const result = await adapter.fetchIndex({ debug: true })

      results.push({
        domain: adapter.name,
        status: result.releases.length > 0 ? 200 : 204,
        htmlLength: result.metadata?.htmlLength || 0,
        strategy: result.strategy,
        parsedCount: result.releases.length,
        sampleTitles: result.releases.slice(0, 5).map(r => r.raw_title || r.title),
        warnings: result.metadata?.warnings || [],
        errors: result.metadata?.errors || [],
      })

      console.log(
        `[Smoke Test] ${adapter.name}: ${result.releases.length} releases found using strategy: ${result.strategy}`
      )

      // Small delay between requests
      await new Promise(r => setTimeout(r, 2000))
    } catch (error: any) {
      results.push({
        domain: adapter.name,
        status: 0,
        htmlLength: 0,
        strategy: 'html-fallback',
        parsedCount: 0,
        sampleTitles: [],
        warnings: [],
        errors: [error.message],
        error: error.message,
      })
    }
  }

  return NextResponse.json({
    success: true,
    results,
    timestamp: new Date().toISOString(),
  })
}
