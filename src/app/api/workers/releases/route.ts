// Releases Worker - Fetch releases using structured data adapters
// Node runtime required for cheerio (used in adapters)
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdapter } from './adapters'
import type { ExtractionStrategy } from './adapters'

// ============================================================================
// Main Worker Handler
// ============================================================================

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET from header or query parameter
  const authHeader = request.headers.get('authorization')
  const secretFromQuery = request.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` || secretFromQuery === cronSecret

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check for debug mode
  const debugMode = request.nextUrl.searchParams.get('debug') === '1'

  const supabase = await createClient()

  const metrics = {
    started_at: new Date().toISOString(),
    sources_processed: 0,
    releases_found: 0,
    inserted: 0,
    updated: 0,
    linked: 0,
    errors: [] as string[],
  }

  // Debug info
  const debugInfo: Array<{
    domain: string
    status: number
    htmlLength: number
    strategy: ExtractionStrategy
    parsedCount: number
    sampleTitles?: string[]
    warnings?: string[]
    errors?: string[]
    reasons?: string[]
  }> = []

  try {
    // Fetch enabled sources from whitelist
    const { data: sources, error: sourcesError } = await supabase
      .from('release_sources_whitelist')
      .select('*')
      .eq('enabled', true)

    if (sourcesError) {
      throw new Error(`Failed to fetch sources: ${sourcesError.message}`)
    }

    if (!sources || sources.length === 0) {
      return NextResponse.json({
        inserted: 0,
        updated: 0,
        linked: 0,
        errors: ['No enabled sources found in whitelist'],
      })
    }

    // In debug mode, also fetch disabled sources to show why they're skipped
    if (debugMode) {
      const { data: disabledSources } = await supabase
        .from('release_sources_whitelist')
        .select('*')
        .eq('enabled', false)

      if (disabledSources && disabledSources.length > 0) {
        console.log(`[Releases Worker] Skipping ${disabledSources.length} disabled source(s)`)
        for (const disabled of disabledSources) {
          console.log(`[Releases Worker] - ${disabled.source_name}: disabled (source requires JS-rendered JSON feed)`)

          debugInfo.push({
            domain: disabled.source_name,
            status: 0, // 0 indicates skipped/disabled
            htmlLength: 0,
            strategy: 'html-fallback' as ExtractionStrategy,
            parsedCount: 0,
            sampleTitles: [],
            warnings: ['Source is disabled in whitelist'],
            errors: [],
            reasons: [
              'Source disabled: requires JS-rendered JSON feed',
              'Page has no __NEXT_DATA__, JSON-LD, or embedded JSON available',
              'Cannot reliably extract launch data until structured data is provided'
            ],
          })
        }
      }
    }

    // Process each source
    for (const source of sources) {
      try {
        console.log(`[Releases Worker] Processing ${source.source_name}...`)
        metrics.sources_processed++

        // Get adapter for this source
        const adapter = getAdapter(source.source_name)

        if (!adapter) {
          const error = `No adapter found for source: ${source.source_name}`
          console.warn(`[Releases Worker] ${error}`)
          metrics.errors.push(error)
          continue
        }

        // Use adapter to fetch and parse releases
        const result = await adapter.fetchIndex({ debug: debugMode })

        if (debugMode) {
          console.log(`[Releases Worker] ${source.source_name} strategy: ${result.strategy}`)
          console.log(`[Releases Worker] ${source.source_name} found: ${result.releases.length} releases`)
        }

        metrics.releases_found += result.releases.length

        // Build debug info for this source
        const sourceDebug = {
          domain: source.source_name,
          status: result.releases.length > 0 ? 200 : 204,
          htmlLength: result.metadata?.htmlLength || 0,
          strategy: result.strategy,
          parsedCount: result.releases.length,
          sampleTitles: result.releases.slice(0, 3).map(r => r.raw_title || r.title),
          warnings: result.metadata?.warnings || [],
          errors: result.metadata?.errors || [],
          reasons: [] as string[],
        }

        // Add reasons when zero items found
        if (result.releases.length === 0) {
          sourceDebug.reasons = [
            `Strategy used: ${result.strategy}`,
            ...(result.metadata?.warnings || []),
            ...(result.metadata?.errors || []),
          ]

          if (sourceDebug.reasons.length === 0) {
            sourceDebug.reasons.push('No structured data found in page')
          }
        }

        if (debugMode) {
          debugInfo.push(sourceDebug)
        }

        // Add warnings/errors to metrics
        if (result.metadata?.errors && result.metadata.errors.length > 0) {
          metrics.errors.push(...result.metadata.errors)
        }
        if (result.metadata?.warnings && result.metadata.warnings.length > 0) {
          metrics.errors.push(...result.metadata.warnings)
        }

        // Process each release
        for (const release of result.releases) {
          try {
            const status = new Date(release.release_date) > new Date() ? 'upcoming' : 'past'

            // Upsert release
            const { data: insertedRelease, error: releaseError } = await supabase
              .from('public.releases')
              .upsert(
                {
                  brand: release.brand,
                  model: release.model,
                  colorway: release.colorway || null,
                  release_date: release.release_date,
                  source: source.source_name,
                  source_url: release.source_url || null,
                  image_url: release.image_url || null,
                  slug: release.slug || null,
                  status,
                  meta: {
                    raw_title: release.raw_title || release.title,
                    extraction_strategy: result.strategy,
                  },
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'brand,model,colorway,release_date,source',
                  ignoreDuplicates: false,
                }
              )
              .select('id')
              .single()

            if (releaseError) {
              metrics.errors.push(`${release.brand} ${release.model}: ${releaseError.message}`)
              continue
            }

            if (!insertedRelease) {
              metrics.updated++
            } else {
              metrics.inserted++
            }

            // Process SKUs
            if (release.skus && release.skus.length > 0 && insertedRelease) {
              for (const sku of release.skus) {
                try {
                  const skuUpper = sku.toUpperCase()

                  // Ensure SKU exists in product_catalog
                  await supabase.from('product_catalog').upsert(
                    {
                      sku: skuUpper,
                      brand: release.brand,
                      model: release.model,
                      colorway: release.colorway || null,
                      release_date: release.release_date,
                      image_url: release.image_url || null,
                      meta: {
                        source: source.source_name,
                        extraction_strategy: result.strategy,
                      },
                    },
                    {
                      onConflict: 'sku',
                      ignoreDuplicates: true,
                    }
                  )

                  // Link release to product
                  const { error: linkError } = await supabase
                    .from('release_products')
                    .upsert(
                      {
                        release_id: insertedRelease.id,
                        sku: skuUpper,
                      },
                      {
                        onConflict: 'release_id,sku',
                        ignoreDuplicates: true,
                      }
                    )

                  if (!linkError) {
                    metrics.linked++
                  }
                } catch (skuError: any) {
                  metrics.errors.push(`SKU ${sku}: ${skuError.message}`)
                }
              }
            }
          } catch (processError: any) {
            metrics.errors.push(
              `${release.brand} ${release.model}: ${processError.message}`
            )
          }
        }

        // Rate limiting: delay between sources
        await new Promise(r => setTimeout(r, 1000))

      } catch (sourceError: any) {
        console.error(`[Releases Worker] Error processing ${source.source_name}:`, sourceError)
        metrics.errors.push(`${source.source_name}: ${sourceError.message}`)
      }
    }

    console.log(
      `[Releases Worker] Complete - Inserted: ${metrics.inserted}, Updated: ${metrics.updated}, Linked: ${metrics.linked}`
    )

    // Log to worker_logs table
    try {
      await supabase.from('public.worker_logs').insert({
        worker_name: 'releases_worker',
        started_at: metrics.started_at,
        completed_at: new Date().toISOString(),
        status: metrics.errors.length > 0 ? 'partial_success' : 'success',
        metrics,
      })
    } catch (logError) {
      console.error('[Releases Worker] Failed to log metrics:', logError)
    }

    const response: any = {
      inserted: metrics.inserted,
      updated: metrics.updated,
      linked: metrics.linked,
      errors: metrics.errors,
    }

    // Include debug info if requested
    if (debugMode) {
      response.debug = {
        sources: debugInfo,
        metrics,
      }
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[Releases Worker] Fatal error:', error)

    // Log failure
    try {
      await supabase.from('public.worker_logs').insert({
        worker_name: 'releases_worker',
        started_at: metrics.started_at,
        completed_at: new Date().toISOString(),
        status: 'failed',
        metrics: { ...metrics, fatal_error: error.message },
      })
    } catch (logError) {
      console.error('[Releases Worker] Failed to log error:', logError)
    }

    return NextResponse.json(
      { inserted: 0, updated: 0, linked: 0, errors: [error.message] },
      { status: 500 }
    )
  }
}

// Allow GET for manual testing (same logic as POST)
export async function GET(request: NextRequest) {
  return POST(request)
}
