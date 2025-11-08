import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

// Service role client for writing
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Rate limiting: simple in-memory store (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const limit = rateLimitMap.get(userId)

  if (!limit || limit.resetAt < now) {
    // Reset limit (1 request per minute)
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60000 })
    return true
  }

  if (limit.count >= 1) {
    return false // Rate limited
  }

  limit.count++
  return true
}

// Sleep utility with jitter
function sleep(ms: number, jitter = 0): Promise<void> {
  const actualMs = jitter > 0 ? ms + Math.random() * jitter : ms
  return new Promise(resolve => setTimeout(resolve, actualMs))
}

// Cache utilities
async function getCachedHtml(cacheKey: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('scrape_cache')
    .select('html, expires_at')
    .eq('cache_key', cacheKey)
    .single()

  if (error || !data) return null

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    // Delete expired cache
    await supabaseAdmin.from('scrape_cache').delete().eq('cache_key', cacheKey)
    return null
  }

  return data.html
}

async function setCachedHtml(cacheKey: string, html: string, ttlHours = 6): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

  await supabaseAdmin
    .from('scrape_cache')
    .upsert({
      cache_key: cacheKey,
      html,
      expires_at: expiresAt.toISOString(),
      fetched_at: new Date().toISOString(),
    })
}

// Fetch HTML with caching
async function fetchPageHtml(page: number): Promise<string | null> {
  const cacheKey = `thedropdate:page:${page}`

  // Check cache first
  const cached = await getCachedHtml(cacheKey)
  if (cached) {
    console.log(`[Scraper] Cache hit for ${cacheKey}`)
    return cached
  }

  // Fetch from source
  console.log(`[Scraper] Fetching ${cacheKey}`)
  const url = page === 1
    ? 'https://thedropdate.com/releases'
    : `https://thedropdate.com/releases?page=${page}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ArchvdBot/1.0 (+https://archvd.io)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    })

    if (!response.ok) {
      console.error(`[Scraper] HTTP ${response.status} for ${url}`)
      return null
    }

    const html = await response.text()

    // Cache for 6 hours
    await setCachedHtml(cacheKey, html, 6)

    return html
  } catch (error) {
    console.error(`[Scraper] Fetch error for ${url}:`, error)
    return null
  }
}

// Parse a single release from HTML card
function parseReleaseCard($: cheerio.CheerioAPI, card: cheerio.Element): any | null {
  try {
    const $card = $(card)

    // Extract product URL and external_id
    const productUrl = $card.find('a').first().attr('href') || ''
    const external_id = productUrl.split('/').pop() || `release-${Date.now()}`

    // Extract image
    const image_url = $card.find('img').first().attr('src') || $card.find('img').first().attr('data-src') || ''

    // Extract title (usually in h3 or product-title class)
    const title = $card.find('.product-title, h3, .release-title').first().text().trim() || ''

    // Extract brand (usually first word or has a brand badge)
    let brand = ''
    const brandBadge = $card.find('.brand-badge, .brand-label').first().text().trim()
    if (brandBadge) {
      brand = brandBadge
    } else if (title) {
      // Heuristic: first word is brand
      brand = title.split(' ')[0] || 'Unknown'
    }

    // Extract model/colorway (heuristic: title minus brand)
    const model = title.replace(brand, '').trim()
    let colorway = ''
    // If model has " - ", split it
    if (model.includes(' - ')) {
      const parts = model.split(' - ')
      colorway = parts[1] || ''
    }

    // Extract SKU
    const sku = $card.find('.sku, .style-code').first().text().trim() || null

    // Extract release date
    let release_date: string | null = null
    const dateText = $card.find('.release-date, .date').first().text().trim()
    if (dateText) {
      // Parse date (e.g., "15 Nov 2024")
      const parsed = new Date(dateText)
      if (!isNaN(parsed.getTime())) {
        // Convert to UTC midnight London time
        const utc = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0))
        release_date = utc.toISOString()
      }
    }

    // Extract price
    let price_gbp: number | null = null
    const priceText = $card.find('.price').first().text().trim()
    if (priceText) {
      const match = priceText.match(/[\d,]+\.?\d*/);
      if (match) {
        price_gbp = parseFloat(match[0].replace(',', ''))
      }
    }

    // Extract retailers (if present on card)
    const retailers: { name: string; url: string }[] = []
    $card.find('.retailer-link, .store-link').each((_, el) => {
      const name = $(el).text().trim()
      const url = $(el).attr('href') || ''
      if (name && url) {
        retailers.push({ name, url })
      }
    })

    return {
      source: 'thedropdate',
      external_id,
      title: title || 'Untitled Release',
      brand: brand || 'Unknown',
      model: model || title,
      colorway: colorway || null,
      sku,
      release_date,
      price_gbp,
      image_url: image_url.startsWith('//') ? `https:${image_url}` : image_url,
      product_url: productUrl.startsWith('http') ? productUrl : `https://thedropdate.com${productUrl}`,
      retailers,
    }
  } catch (error) {
    console.error('[Scraper] Parse error for card:', error)
    return null
  }
}

// Parse HTML page
function parsePage(html: string): any[] {
  const $ = cheerio.load(html)
  const releases: any[] = []

  // Find release cards (adjust selectors based on actual HTML structure)
  $('.release-card, .product-card, .item-card, article').each((_, card) => {
    const parsed = parseReleaseCard($, card)
    if (parsed && parsed.title !== 'Untitled Release') {
      releases.push(parsed)
    }
  })

  return releases
}

// Upsert releases to database
async function upsertReleases(releases: any[]): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const release of releases) {
    try {
      // Check if exists
      const { data: existing } = await supabaseAdmin
        .from('releases')
        .select('id, updated_at')
        .eq('external_id', release.external_id)
        .single()

      if (existing) {
        // Update
        const { error } = await supabaseAdmin
          .from('releases')
          .update(release)
          .eq('external_id', release.external_id)

        if (error) {
          console.error('[Scraper] Update error:', error)
          skipped++
        } else {
          updated++
        }
      } else {
        // Insert
        const { error } = await supabaseAdmin
          .from('releases')
          .insert(release)

        if (error) {
          console.error('[Scraper] Insert error:', error)
          skipped++
        } else {
          inserted++
        }
      }
    } catch (error) {
      console.error('[Scraper] Upsert error:', error)
      skipped++
    }
  }

  return { inserted, updated, skipped }
}

// Main handler
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user (simplified - in production, verify JWT properly)
    const userId = 'system' // For now, treat as system user

    // Rate limit check
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait 1 minute.' },
        { status: 429 }
      )
    }

    // Get pages param
    const { searchParams } = new URL(request.url)
    const pagesParam = searchParams.get('pages')
    const pages = pagesParam ? parseInt(pagesParam, 10) : 3

    if (pages < 1 || pages > 10) {
      return NextResponse.json({ error: 'Pages must be between 1 and 10' }, { status: 400 })
    }

    console.log(`[Scraper] Starting ingest for ${pages} pages`)

    let totalInserted = 0
    let totalUpdated = 0
    let totalSkipped = 0
    const errors: string[] = []

    // Fetch and parse pages
    for (let page = 1; page <= pages; page++) {
      try {
        const html = await fetchPageHtml(page)
        if (!html) {
          errors.push(`Failed to fetch page ${page}`)
          continue
        }

        const releases = parsePage(html)
        console.log(`[Scraper] Page ${page}: parsed ${releases.length} releases`)

        if (releases.length > 0) {
          const stats = await upsertReleases(releases)
          totalInserted += stats.inserted
          totalUpdated += stats.updated
          totalSkipped += stats.skipped
        }

        // Polite crawling: wait between pages
        if (page < pages) {
          await sleep(800, 400) // 800-1200ms
        }
      } catch (error) {
        const msg = `Error processing page ${page}: ${error}`
        console.error(`[Scraper] ${msg}`)
        errors.push(msg)
      }
    }

    const duration_ms = Date.now() - startTime

    // Log the run
    await supabaseAdmin.from('release_ingest_logs').insert({
      source: 'thedropdate',
      pages_fetched: pages,
      items_inserted: totalInserted,
      items_updated: totalUpdated,
      items_skipped: totalSkipped,
      errors: errors.length > 0 ? errors : [],
      duration_ms,
    })

    return NextResponse.json({
      success: true,
      pages_fetched: pages,
      items_inserted: totalInserted,
      items_updated: totalUpdated,
      items_skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms,
    })
  } catch (error) {
    console.error('[Scraper] Fatal error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
