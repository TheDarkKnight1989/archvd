/**
 * Size? adapter
 *
 * Strategy:
 * 1. Parse __NEXT_DATA__ (primary - Size? uses Next.js)
 * 2. Check for window.__INITIAL_STATE__ or embedded JSON
 * 3. Look for JSON feeds/endpoints
 * 4. NO CSS-based HTML scraping
 */

import * as cheerio from 'cheerio'
import {
  ReleaseAdapter,
  AdapterResult,
  NormalizedRelease,
  FetchOptions,
  ExtractionStrategy,
} from './types'
import {
  fetchWithRetry,
  parseUkDate,
  parseTitleParts,
  createSlug,
  extractSkusFromText,
  isLikelyDynamic,
} from './utils'

export class SizeAdapter implements ReleaseAdapter {
  readonly name = 'size'
  readonly url = 'https://www.size.co.uk/page/sizepreviews-launches/'

  async fetchIndex(options?: FetchOptions): Promise<AdapterResult> {
    const { debug = false } = options || {}
    const warnings: string[] = []
    const errors: string[] = []

    try {
      // Fetch HTML
      const response = await fetchWithRetry(this.url, {
        retries: 3,
        timeout: 30000,
        delay: 1000,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()

      if (debug) {
        console.log(`[Size? Adapter] Fetched ${html.length} bytes`)
      }

      // Check if likely dynamic
      if (isLikelyDynamic(html)) {
        warnings.push('Page appears to be JS-rendered (client-side only)')
        if (debug) {
          console.warn('[Size? Adapter] Page is likely dynamically rendered')
        }
      }

      // Try strategies in order
      let releases: NormalizedRelease[] = []
      let strategy: ExtractionStrategy = 'html-fallback'

      // Strategy 1: __NEXT_DATA__ (primary for Size?)
      const nextDataResult = this.parseNextData(html, debug)
      if (nextDataResult.releases.length > 0) {
        releases = nextDataResult.releases
        strategy = 'nextdata'
        if (debug) {
          console.log(`[Size? Adapter] __NEXT_DATA__ extracted ${releases.length} releases`)
        }
      }

      // Strategy 2: Embedded JSON in script tags
      if (releases.length === 0) {
        const scriptJsonResult = this.parseScriptJson(html, debug)
        if (scriptJsonResult.releases.length > 0) {
          releases = scriptJsonResult.releases
          strategy = 'script-json'
          if (debug) {
            console.log(`[Size? Adapter] Script JSON extracted ${releases.length} releases`)
          }
        }
      }

      // Strategy 3: JSON-LD (fallback)
      if (releases.length === 0) {
        const jsonLdResult = this.parseJsonLd(html, debug)
        if (jsonLdResult.releases.length > 0) {
          releases = jsonLdResult.releases
          strategy = 'jsonld'
          if (debug) {
            console.log(`[Size? Adapter] JSON-LD extracted ${releases.length} releases`)
          }
        }
      }

      // No data found
      if (releases.length === 0) {
        warnings.push('No structured data found in page')
        warnings.push('Size? page may require JavaScript to render launches')
        if (debug) {
          console.warn('[Size? Adapter] No releases found with any strategy')
        }
      }

      return {
        releases,
        strategy,
        metadata: {
          htmlLength: html.length,
          itemsFound: releases.length,
          warnings,
          errors,
        },
      }
    } catch (error: any) {
      errors.push(`Size? fetch failed: ${error.message}`)

      return {
        releases: [],
        strategy: 'html-fallback',
        metadata: {
          htmlLength: 0,
          itemsFound: 0,
          warnings,
          errors,
        },
      }
    }
  }

  /**
   * Parse Next.js __NEXT_DATA__ (primary strategy)
   */
  private parseNextData(html: string, debug = false): { releases: NormalizedRelease[] } {
    const releases: NormalizedRelease[] = []

    try {
      const $ = cheerio.load(html)
      const nextDataScript = $('#__NEXT_DATA__')

      if (nextDataScript.length === 0) {
        return { releases }
      }

      const content = nextDataScript.html()
      if (!content) return { releases }

      const data = JSON.parse(content)

      // Navigate the Next.js data structure for Size?
      const pageProps = data?.props?.pageProps

      if (!pageProps) return { releases }

      // Size? specific paths (may vary):
      // - pageProps.launches
      // - pageProps.data.launches
      // - pageProps.initialData.launches
      // - pageProps.pageData.items
      const launches =
        pageProps.launches ||
        pageProps.data?.launches ||
        pageProps.initialData?.launches ||
        pageProps.pageData?.items ||
        pageProps.items ||
        []

      if (!Array.isArray(launches)) {
        if (debug) {
          console.warn('[Size? Adapter] __NEXT_DATA__ found but no launches array')
          console.log('[Size? Adapter] Available keys:', Object.keys(pageProps))
        }
        return { releases }
      }

      for (const launch of launches) {
        const release = this.normalizeLaunch(launch)
        if (release) {
          releases.push(release)
        }
      }
    } catch (error: any) {
      if (debug) {
        console.error(`[Size? Adapter] __NEXT_DATA__ parse error: ${error.message}`)
      }
    }

    return { releases }
  }

  /**
   * Normalize Size? launch data to our schema
   */
  private normalizeLaunch(launch: any): NormalizedRelease | null {
    try {
      const title =
        launch.title ||
        launch.name ||
        launch.productName ||
        launch.displayName

      if (!title) return null

      const { brand, model, colorway } = parseTitleParts(title, 'Nike')

      const releaseDate =
        launch.releaseDate ||
        launch.launchDate ||
        launch.date ||
        launch.releaseDateTime

      if (!releaseDate) return null

      const parsedDate = parseUkDate(releaseDate)
      if (!parsedDate) return null

      const imageUrl =
        launch.imageUrl ||
        launch.image ||
        launch.images?.[0] ||
        launch.media?.imageUrl ||
        launch.thumbnail

      const url =
        launch.url ||
        launch.productUrl ||
        launch.link ||
        launch.slug

      const skus = extractSkusFromText(
        `${title} ${launch.sku || launch.styleCode || ''}`,
        brand.toLowerCase()
      )

      const slug = createSlug(brand, model, colorway)

      return {
        title,
        brand,
        model,
        colorway: colorway || undefined,
        release_date: parsedDate,
        image_url: imageUrl || undefined,
        source_url: url ? (url.startsWith('http') ? url : `https://www.size.co.uk${url}`) : undefined,
        slug,
        skus,
        raw_title: title,
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Parse embedded JSON in script tags
   */
  private parseScriptJson(html: string, debug = false): { releases: NormalizedRelease[] } {
    const releases: NormalizedRelease[] = []

    try {
      const $ = cheerio.load(html)

      // Look for common patterns
      const scripts = $('script:not([src])')

      scripts.each((_, script) => {
        try {
          const content = $(script).html() || ''

          // Try to find JSON assignments
          const patterns = [
            /window\.__INITIAL_STATE__\s*=\s*({.+?});/s,
            /window\.__STATE__\s*=\s*({.+?});/s,
            /var\s+launches\s*=\s*(\[.+?\]);/s,
            /const\s+launches\s*=\s*(\[.+?\]);/s,
          ]

          for (const pattern of patterns) {
            const match = content.match(pattern)
            if (match && match[1]) {
              try {
                const data = JSON.parse(match[1])
                const items = Array.isArray(data) ? data : [data]

                for (const item of items) {
                  const release = this.normalizeLaunch(item)
                  if (release) {
                    releases.push(release)
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        } catch (error) {
          // Ignore script parsing errors
        }
      })
    } catch (error: any) {
      if (debug) {
        console.error(`[Size? Adapter] Script JSON parse error: ${error.message}`)
      }
    }

    return { releases }
  }

  /**
   * Parse JSON-LD (fallback strategy)
   */
  private parseJsonLd(html: string, debug = false): { releases: NormalizedRelease[] } {
    const releases: NormalizedRelease[] = []

    try {
      const $ = cheerio.load(html)
      const jsonLdScripts = $('script[type="application/ld+json"]')

      jsonLdScripts.each((_, script) => {
        try {
          const content = $(script).html()
          if (!content) return

          const data = JSON.parse(content)

          // Handle ItemList or Product types
          if (data['@type'] === 'ItemList' || data['@type'] === 'Product') {
            const items = Array.isArray(data.itemListElement)
              ? data.itemListElement
              : [data]

            for (const item of items) {
              const release = this.normalizeLaunch(item)
              if (release) {
                releases.push(release)
              }
            }
          }
        } catch (error: any) {
          if (debug) {
            console.warn(`[Size? Adapter] JSON-LD parse error: ${error.message}`)
          }
        }
      })
    } catch (error: any) {
      if (debug) {
        console.error(`[Size? Adapter] JSON-LD extraction failed: ${error.message}`)
      }
    }

    return { releases }
  }
}
