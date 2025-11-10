// Scraper API for thedropdate.com releases
// Fetches, parses, and upserts release data to Supabase
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as cheerio from 'cheerio'

// In-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 60 * 1000 // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const lastRequest = rateLimitMap.get(userId)

  if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
    return false
  }

  rateLimitMap.set(userId, now)
  return true
}

// Cache helpers
async function getCachedHtml(supabase: any, cacheKey: string): Promise<string | null> {
  const { data } = await supabase
    .from('scrape_cache')
    .select('html, expires_at')
    .eq('cache_key', cacheKey)
    .single()

  if (!data || new Date(data.expires_at) < new Date()) {
    return null
  }

  return data.html
}

async function setCachedHtml(supabase: any, cacheKey: string, html: string, ttlHours: number = 6) {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

  await supabase
    .from('scrape_cache')
    .upsert({
      cache_key: cacheKey,
      html,
      expires_at: expiresAt.toISOString(),
      fetched_at: new Date().toISOString(),
    }, {
      onConflict: 'cache_key',
    })
}

// Fetch HTML from thedropdate.com with caching
async function fetchPageHtml(supabase: any, page: number): Promise<string | null> {
  const cacheKey = `thedropdate:page:${page}`

  // Check cache first
  const cached = await getCachedHtml(supabase, cacheKey)
  if (cached) {
    console.log(`[Scraper] Cache hit for ${cacheKey}`)
    return cached
  }

  console.log(`[Scraper] Cache miss for ${cacheKey}, fetching...`)

  try {
    const url = `https://thedropdate.com/releases${page > 1 ? `?page=${page}` : ''}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ArchvdBot/1.0 (+https://archvd.io)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      console.error(`[Scraper] HTTP ${response.status} for ${url}`)
      return null
    }

    const html = await response.text()

    // Cache for 6 hours
    await setCachedHtml(supabase, cacheKey, html, 6)

    return html
  } catch (error: any) {
    console.error(`[Scraper] Fetch error for page ${page}:`, error.message)
    return null
  }
}

// Parse release cards from HTML
function parseReleaseCards(html: string): Array<{
  external_id: string
  title: string
  brand: string
  model: string
  colorway: string | null
  sku: string | null
  release_date: string | null
  price_gbp: number | null
  image_url: string | null
  product_url: string | null
  retailers: Array<{ name: string; url: string }>
}> {
  const $ = cheerio.load(html)
  const cards: any[] = []

  // Try multiple selectors for cards
  const cardSelectors = [
    'a[href*="/sneakers/"]',  // thedropdate.com uses links with /sneakers/ in href
    'a.group',  // thedropdate.com uses <a class="group ..."> for each card
    '.release-card',
    '.product-card',
    '.item-card',
    'article',
  ]

  let cardElements: any = null

  for (const selector of cardSelectors) {
    cardElements = $(selector)
    if (cardElements.length > 0) {
      console.log(`[Scraper] Found ${cardElements.length} cards using selector: ${selector}`)
      break
    }
  }

  if (!cardElements || cardElements.length === 0) {
    console.warn('[Scraper] No release cards found on page')
    console.warn(`[Scraper] HTML sample: ${html.substring(0, 500)}`)
    return []
  }

  cardElements.each((_, cardEl) => {
    const $card = $(cardEl)

    try {
      // Extract product URL (required for external_id)
      // $card is now the <a> tag itself
      const productUrl = $card.attr('href')

      if (!productUrl) {
        return // Skip cards without URL
      }

      // Generate external_id from URL slug
      const urlPath = productUrl.split('/').filter(Boolean).pop() || productUrl
      const external_id = urlPath.replace(/[^a-z0-9-]/gi, '-').toLowerCase()

      // Extract title from h2
      let title = $card.find('h2').first().text().trim()

      if (!title) {
        // Fallback to img alt text
        title = $card.find('img').first().attr('alt')?.trim() || 'Untitled Release'
      }

      // Extract image
      const img = $card.find('img').first()
      const image_url = img.attr('src') || img.attr('data-src') || null

      // Extract brand (from badge or first word of title)
      let brand = $card.find('.brand-badge, .brand-label').first().text().trim()
      if (!brand && title) {
        brand = title.split(' ')[0] || 'Unknown'
      }

      // Split title into model/colorway
      let model = title
      let colorway: string | null = null

      // Simple heuristic: if title has quotes, extract colorway
      const colorwayMatch = title.match(/[""](.*?)[""]/g)
      if (colorwayMatch && colorwayMatch.length > 0) {
        colorway = colorwayMatch[0].replace(/[""]/g, '')
        model = title.replace(colorwayMatch[0], '').trim()
      }

      // Extract SKU
      const skuSelectors = ['.sku', '.style-code', '[data-sku]']
      let sku: string | null = null
      for (const sel of skuSelectors) {
        sku = $card.find(sel).first().text().trim() || $card.find(sel).first().attr('data-sku') || null
        if (sku) break
      }

      // Extract release date from date badge
      // thedropdate.com uses a badge with month (text) and day (number)
      const dateBadge = $card.find('.absolute.left-3.top-3')
      let release_date: string | null = null

      if (dateBadge.length > 0) {
        const monthText = dateBadge.find('div').first().text().trim() // e.g., "Nov"
        const dayText = dateBadge.find('div').eq(1).text().trim() // e.g., "11"

        if (monthText && dayText) {
          try {
            // Assume current or next year
            const currentYear = new Date().getFullYear()
            const dateString = `${monthText} ${dayText}, ${currentYear}`
            const parsed = new Date(dateString)

            if (!isNaN(parsed.getTime())) {
              // If the parsed date is in the past, assume next year
              if (parsed < new Date()) {
                parsed.setFullYear(currentYear + 1)
              }
              release_date = parsed.toISOString()
            }
          } catch {
            // Keep as null if parsing fails
          }
        }
      }

      // Extract price (GBP) from span.font-bold
      const priceSpan = $card.find('span.font-bold').first()
      let price_gbp: number | null = null

      if (priceSpan.length > 0) {
        const priceText = priceSpan.text().trim() // e.g., "£180"
        const priceMatch = priceText.match(/[\d.]+/)
        if (priceMatch) {
          price_gbp = parseFloat(priceMatch[0])
        }
      }

      // Extract retailers
      const retailers: Array<{ name: string; url: string }> = []
      $card.find('.retailer-link, .store-link, a[href*="nike"], a[href*="adidas"], a[href*="size"]').each((_, linkEl) => {
        const $link = $(linkEl)
        const name = $link.text().trim() || new URL($link.attr('href') || '').hostname
        const url = $link.attr('href')

        if (name && url && url.startsWith('http')) {
          retailers.push({ name, url })
        }
      })

      cards.push({
        external_id,
        title,
        brand,
        model,
        colorway,
        sku,
        release_date,
        price_gbp,
        image_url,
        product_url: productUrl.startsWith('http') ? productUrl : `https://thedropdate.com${productUrl}`,
        retailers,
      })
    } catch (error: any) {
      console.error('[Scraper] Error parsing card:', error.message)
    }
  })

  return cards
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Get current user for rate limiting (optional - RLS will handle auth)
    const { data: { user } } = await supabase.auth.getUser()

    // Rate limiting (only if user is available)
    if (user && !checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded - Please wait 1 minute between requests' },
        { status: 429 }
      )
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const pagesParam = parseInt(searchParams.get('pages') || '3', 10)
    const pages = Math.min(Math.max(pagesParam, 1), 10) // Clamp between 1-10

    console.log(`[Scraper] Starting ingest from thedropdate.com (${pages} pages)`)

    let pagesFetched = 0
    let itemsInserted = 0
    let itemsUpdated = 0
    let itemsSkipped = 0
    const errors: string[] = []

    // Fetch and parse pages
    for (let page = 1; page <= pages; page++) {
      console.log(`[Scraper] Fetching page ${page}/${pages}`)

      const html = await fetchPageHtml(supabase, page)

      if (!html) {
        errors.push(`Failed to fetch page ${page}`)
        continue
      }

      pagesFetched++

      const cards = parseReleaseCards(html)
      console.log(`[Scraper] Parsed ${cards.length} cards from page ${page}`)

      // Upsert each card to database
      for (const card of cards) {
        try {
          const { data: existing } = await supabase
            .from('releases')
            .select('id')
            .eq('external_id', card.external_id)
            .single()

          const { error: upsertError } = await supabase
            .from('releases')
            .upsert({
              source: 'thedropdate',
              ...card,
              retailers: card.retailers,
            }, {
              onConflict: 'external_id',
            })

          if (upsertError) {
            errors.push(`Failed to upsert ${card.external_id}: ${upsertError.message}`)
            itemsSkipped++
          } else {
            if (existing) {
              itemsUpdated++
            } else {
              itemsInserted++
            }
          }
        } catch (error: any) {
          errors.push(`Error processing ${card.external_id}: ${error.message}`)
          itemsSkipped++
        }
      }

      // Polite crawling: add jitter between pages
      if (page < pages) {
        const jitter = 800 + Math.random() * 400 // 800-1200ms
        await new Promise(resolve => setTimeout(resolve, jitter))
      }
    }

    const duration_ms = Date.now() - startTime

    // Log ingest run
    await supabase
      .from('release_ingest_logs')
      .insert({
        source: 'thedropdate',
        pages_fetched: pagesFetched,
        items_inserted: itemsInserted,
        items_updated: itemsUpdated,
        items_skipped: itemsSkipped,
        errors: errors,
        duration_ms,
      })

    console.log(`[Scraper] Complete: ${itemsInserted} inserted, ${itemsUpdated} updated, ${itemsSkipped} skipped in ${duration_ms}ms`)

    return NextResponse.json({
      success: true,
      pages_fetched: pagesFetched,
      items_inserted: itemsInserted,
      items_updated: itemsUpdated,
      items_skipped: itemsSkipped,
      duration_ms,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors
    })

  } catch (error: any) {
    console.error('[Scraper] Fatal error:', error)

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
