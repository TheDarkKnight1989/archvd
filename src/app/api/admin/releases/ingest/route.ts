// Admin Ingest - Manually import release JSON data (dev/testing only)
// Node runtime required for server components
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ReleaseInput {
  brand: string
  model: string
  colorway?: string
  release_date: string // YYYY-MM-DD
  image_url?: string
  slug?: string
  source: string
  source_url?: string
  region?: string
  status?: 'upcoming' | 'past' | 'unknown'
  skus?: string[]
  meta?: any
}

interface IngestRequest {
  releases: ReleaseInput[]
}

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET
  const secretFromQuery = request.nextUrl.searchParams.get('secret')
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` || secretFromQuery === cronSecret

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Dev-only guard (optional - remove if you want to use in prod)
  const isDev = process.env.NODE_ENV === 'development'
  if (!isDev) {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    )
  }

  const supabase = await createClient()

  const metrics = {
    inserted: 0,
    updated: 0,
    linked: 0,
    errors: [] as string[],
  }

  try {
    const body: IngestRequest = await request.json()

    if (!body.releases || !Array.isArray(body.releases)) {
      return NextResponse.json(
        { error: 'Invalid request: releases array required' },
        { status: 400 }
      )
    }

    console.log(`[Admin Ingest] Processing ${body.releases.length} releases...`)

    for (const release of body.releases) {
      try {
        // Validate required fields
        if (!release.brand || !release.model || !release.release_date || !release.source) {
          metrics.errors.push(`Missing required fields: ${JSON.stringify(release)}`)
          continue
        }

        // Auto-determine status if not provided
        const status = release.status || (new Date(release.release_date) > new Date() ? 'upcoming' : 'past')

        // Generate slug if not provided
        const slug = release.slug ||
          `${release.brand}-${release.model}-${release.colorway || ''}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')

        // Upsert release
        const { data: insertedRelease, error: releaseError } = await supabase
          .from('releases')
          .upsert(
            {
              brand: release.brand,
              model: release.model,
              colorway: release.colorway || null,
              release_date: release.release_date,
              source: release.source,
              source_url: release.source_url || null,
              image_url: release.image_url || null,
              slug,
              region: release.region || 'GB',
              status,
              meta: release.meta || { imported: true, imported_at: new Date().toISOString() },
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

        // Process SKUs if provided
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
                  meta: { source: release.source, admin_imported: true },
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

    console.log(`[Admin Ingest] Complete - Inserted: ${metrics.inserted}, Updated: ${metrics.updated}, Linked: ${metrics.linked}`)

    return NextResponse.json({
      inserted: metrics.inserted,
      updated: metrics.updated,
      linked: metrics.linked,
      errors: metrics.errors,
    })
  } catch (error: any) {
    console.error('[Admin Ingest] Fatal error:', error)

    return NextResponse.json(
      {
        inserted: 0,
        updated: 0,
        linked: 0,
        errors: [error.message],
      },
      { status: 500 }
    )
  }
}
