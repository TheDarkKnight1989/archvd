// Releases Worker - Scrapes upcoming releases from official retailer websites
// Node runtime required for cheerio
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as cheerio from 'cheerio'

interface ReleaseData {
  brand: string
  model: string
  colorway?: string
  release_date: string
  source_url?: string
  image_url?: string
  slug?: string
  skus: string[]
  raw_title: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse UK date formats: "15 Nov", "15 November", "15/11/2024", etc.
 */
function parseUkDate(dateStr: string): string | null {
  try {
    const cleaned = dateStr.trim()
    const currentYear = new Date().getFullYear()

    // Format: "15 Nov" or "15 November"
    const monthDayMatch = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)/)
    if (monthDayMatch) {
      const day = monthDayMatch[1]
      const month = monthDayMatch[2]
      const dateObj = new Date(`${day} ${month} ${currentYear}`)
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().split('T')[0]
      }
    }

    // Format: "15/11/2024" or "15-11-2024"
    const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0')
      const month = dmyMatch[2].padStart(2, '0')
      const year = dmyMatch[3]
      return `${year}-${month}-${day}`
    }

    // Fallback: try direct parse
    const dateObj = new Date(cleaned)
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Normalize title by removing extra whitespace and special characters
 */
function normaliseTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .substring(0, 200) // Limit length
}

/**
 * Extract SKU candidates from text using regex patterns
 * Nike format: AA####-### or DZ####-### (2 letters, 4 digits, dash, 3 digits)
 */
function extractSkuCandidates(text: string): string[] {
  const skuPattern = /\b[A-Z]{2}\d{4}-\d{3}\b/g
  const matches = text.match(skuPattern)
  return matches ? Array.from(new Set(matches)) : []
}

/**
 * Split title into brand, model, colorway
 */
function parseTitleParts(title: string, defaultBrand: string): { brand: string; model: string; colorway: string } {
  const normalized = normaliseTitle(title)

  // Try to extract brand from title
  const brandMatch = normalized.match(/^(Nike|Jordan|Adidas|New Balance|Asics|Vans|Converse)\s+/i)
  const brand = brandMatch ? brandMatch[1] : defaultBrand

  // Remove brand from title
  let remainder = brandMatch ? normalized.replace(brandMatch[0], '').trim() : normalized

  // Try to find colorway in quotes or after dash
  const colorwayMatch = remainder.match(/[""']([^""']+)[""']|[-–]\s*(.+)$/)
  const colorway = colorwayMatch ? (colorwayMatch[1] || colorwayMatch[2]).trim() : ''

  // Model is what's left
  const model = colorwayMatch
    ? remainder.replace(colorwayMatch[0], '').trim()
    : remainder

  return {
    brand: brand.substring(0, 50),
    model: model.substring(0, 100),
    colorway: colorway.substring(0, 100),
  }
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArchvdBot/1.0)',
      },
    })
    if (res.status === 429) {
      const delay = Math.pow(2, i) * 1000 // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay))
      continue
    }
    return res
  }
  throw new Error('Rate limited after retries')
}

// ============================================================================
// Domain-Specific Parsers
// ============================================================================

async function parseNikeLaunch(html: string, baseUrl: string): Promise<ReleaseData[]> {
  const $ = cheerio.load(html)
  const releases: ReleaseData[] = []

  // Nike uses various selectors - try common patterns
  const cards = $('div[class*="product-card"], article[class*="launch"], div[data-testid*="product"]').slice(0, 50)

  cards.each((_, element) => {
    try {
      const $card = $(element)

      // Extract title
      const titleEl = $card.find('h3, h4, div[class*="title"], div[class*="product-name"]').first()
      const rawTitle = titleEl.text().trim()
      if (!rawTitle) return

      // Extract image
      const imgEl = $card.find('img').first()
      const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || ''

      // Extract date
      const dateEl = $card.find('[class*="date"], time, span[class*="launch"]').first()
      const dateText = dateEl.text().trim()
      const releaseDate = parseUkDate(dateText)
      if (!releaseDate) return // Skip if no valid date

      // Extract product URL
      const linkEl = $card.find('a').first()
      const productUrl = linkEl.attr('href') || ''
      const fullUrl = productUrl.startsWith('http') ? productUrl : `${baseUrl}${productUrl}`

      // Extract SKUs from title and card text
      const cardText = $card.text()
      const skus = extractSkuCandidates(`${rawTitle} ${cardText}`)

      // Parse title parts
      const { brand, model, colorway } = parseTitleParts(rawTitle, 'Nike')

      releases.push({
        brand,
        model,
        colorway: colorway || undefined,
        release_date: releaseDate,
        source_url: fullUrl || undefined,
        image_url: imageUrl || undefined,
        slug: productUrl.split('/').filter(Boolean).pop() || undefined,
        skus,
        raw_title: rawTitle,
      })
    } catch (err) {
      console.error('[Nike Parser] Card parse error:', err)
    }
  })

  return releases
}

async function parseSizeLaunch(html: string, baseUrl: string): Promise<ReleaseData[]> {
  const $ = cheerio.load(html)
  const releases: ReleaseData[] = []

  // Size? uses product cards in launch section
  const cards = $('div[class*="product"], article[class*="launch"], li[class*="item"]').slice(0, 50)

  cards.each((_, element) => {
    try {
      const $card = $(element)

      // Extract title
      const titleEl = $card.find('h2, h3, h4, a[class*="title"], span[class*="name"]').first()
      const rawTitle = titleEl.text().trim()
      if (!rawTitle) return

      // Extract image
      const imgEl = $card.find('img').first()
      const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-original') || ''

      // Extract date
      const dateEl = $card.find('[class*="date"], time, span[class*="release"]').first()
      const dateText = dateEl.attr('datetime') || dateEl.text().trim()
      const releaseDate = parseUkDate(dateText)
      if (!releaseDate) return

      // Extract product URL
      const linkEl = $card.find('a').first()
      const productUrl = linkEl.attr('href') || ''
      const fullUrl = productUrl.startsWith('http') ? productUrl : `${baseUrl}${productUrl}`

      // Extract SKUs
      const cardText = $card.text()
      const skus = extractSkuCandidates(`${rawTitle} ${cardText}`)

      // Determine brand from title or assume from Size? context
      const { brand, model, colorway } = parseTitleParts(rawTitle, 'Nike')

      releases.push({
        brand,
        model,
        colorway: colorway || undefined,
        release_date: releaseDate,
        source_url: fullUrl || undefined,
        image_url: imageUrl || undefined,
        slug: productUrl.split('/').filter(Boolean).pop() || undefined,
        skus,
        raw_title: rawTitle,
      })
    } catch (err) {
      console.error('[Size? Parser] Card parse error:', err)
    }
  })

  return releases
}

async function parseFootpatrolLaunch(html: string, baseUrl: string): Promise<ReleaseData[]> {
  const $ = cheerio.load(html)
  const releases: ReleaseData[] = []

  // Footpatrol similar structure to Size?
  const cards = $('div[class*="product"], article[class*="launch"], li[class*="grid-item"]').slice(0, 50)

  cards.each((_, element) => {
    try {
      const $card = $(element)

      // Extract title
      const titleEl = $card.find('h2, h3, h4, a[class*="title"], p[class*="name"]').first()
      const rawTitle = titleEl.text().trim()
      if (!rawTitle) return

      // Extract image
      const imgEl = $card.find('img').first()
      const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-image') || ''

      // Extract date
      const dateEl = $card.find('[class*="date"], time, span[class*="launch"]').first()
      const dateText = dateEl.attr('datetime') || dateEl.text().trim()
      const releaseDate = parseUkDate(dateText)
      if (!releaseDate) return

      // Extract product URL
      const linkEl = $card.find('a').first()
      const productUrl = linkEl.attr('href') || ''
      const fullUrl = productUrl.startsWith('http') ? productUrl : `${baseUrl}${productUrl}`

      // Extract SKUs
      const cardText = $card.text()
      const skus = extractSkuCandidates(`${rawTitle} ${cardText}`)

      // Parse title
      const { brand, model, colorway } = parseTitleParts(rawTitle, 'Nike')

      releases.push({
        brand,
        model,
        colorway: colorway || undefined,
        release_date: releaseDate,
        source_url: fullUrl || undefined,
        image_url: imageUrl || undefined,
        slug: productUrl.split('/').filter(Boolean).pop() || undefined,
        skus,
        raw_title: rawTitle,
      })
    } catch (err) {
      console.error('[Footpatrol Parser] Card parse error:', err)
    }
  })

  return releases
}

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

    for (const source of sources) {
      try {
        console.log(`[Releases Worker] Processing ${source.source_name}...`)

        // Fetch HTML
        const response = await fetchWithRetry(source.source_url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const html = await response.text()

        // Extract base URL for relative links
        const baseUrl = new URL(source.source_url).origin

        // Parse based on source
        let releases: ReleaseData[] = []
        switch (source.source_name) {
          case 'nike':
            releases = await parseNikeLaunch(html, baseUrl)
            break
          case 'size':
            releases = await parseSizeLaunch(html, baseUrl)
            break
          case 'footpatrol':
            releases = await parseFootpatrolLaunch(html, baseUrl)
            break
          default:
            console.warn(`[Releases Worker] Unknown source: ${source.source_name}`)
            continue
        }

        metrics.releases_found += releases.length
        console.log(`[Releases Worker] Found ${releases.length} releases from ${source.source_name}`)

        // Process each release
        for (const release of releases) {
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
                  meta: { raw_title: release.raw_title },
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
              metrics.errors.push(`${source.source_name} - ${release.raw_title}: ${releaseError.message}`)
              continue
            }

            if (!insertedRelease) {
              metrics.updated++
            } else {
              metrics.inserted++
            }

            // Process SKUs if available
            if (release.skus.length > 0 && insertedRelease) {
              for (const sku of release.skus) {
                try {
                  const skuUpper = sku.toUpperCase()

                  // Ensure SKU exists in product_catalog (upsert minimal row)
                  await supabase.from('public.product_catalog').upsert(
                    {
                      sku: skuUpper,
                      brand: release.brand,
                      model: release.model,
                      colorway: release.colorway || null,
                      release_date: release.release_date,
                      image_url: release.image_url || null,
                      meta: { source: source.source_name, auto_created: true },
                    },
                    {
                      onConflict: 'sku',
                      ignoreDuplicates: true,
                    }
                  )

                  // Link release to product via release_products
                  const { error: linkError } = await supabase
                    .from('public.release_products')
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
              `${source.source_name} - ${release.raw_title}: ${processError.message}`
            )
          }
        }

        metrics.sources_processed++

        // Rate limit between sources (5 seconds)
        if (metrics.sources_processed < sources.length) {
          await new Promise((r) => setTimeout(r, 5000))
        }
      } catch (sourceError: any) {
        console.error(`[Releases Worker] ${source.source_name} failed:`, sourceError)
        metrics.errors.push(`${source.source_name}: ${sourceError.message}`)
      }
    }

    // Log to worker_logs
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

    return NextResponse.json({
      inserted: metrics.inserted,
      updated: metrics.updated,
      linked: metrics.linked,
      errors: metrics.errors,
    })
  } catch (error: any) {
    console.error('[Releases Worker] Fatal error:', error)

    // Log failure
    try {
      await supabase.from('public.worker_logs').insert({
        worker_name: 'releases_worker',
        started_at: metrics.started_at,
        completed_at: new Date().toISOString(),
        status: 'failed',
        metrics: {
          ...metrics,
          fatal_error: error.message,
        },
      })
    } catch (logError) {
      console.error('[Releases Worker] Failed to log error:', logError)
    }

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

// Allow GET for manual testing (same logic as POST)
export async function GET(request: NextRequest) {
  return POST(request)
}
