/**
 * Footpatrol adapter
 *
 * Strategy:
 * 1. Parse embedded JSON in script tags (JD Group data-component patterns)
 * 2. Check for __NEXT_DATA__ or similar Next.js data
 * 3. Look for JSON-LD
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

export class FootpatrolAdapter implements ReleaseAdapter {
  readonly name = 'footpatrol'
  readonly url = 'https://www.footpatrol.com/pages/launch-page/'

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
        console.log(`[Footpatrol Adapter] Fetched ${html.length} bytes`)
      }

      // Check if likely dynamic
      if (isLikelyDynamic(html)) {
        warnings.push('Page appears to be JS-rendered (client-side only)')
        if (debug) {
          console.warn('[Footpatrol Adapter] Page is likely dynamically rendered')
        }
      }

      // Try strategies in order
      let releases: NormalizedRelease[] = []
      let strategy: ExtractionStrategy = 'html-fallback'

      // Strategy 1: Embedded JSON in script tags (JD Group pattern)
      const scriptJsonResult = this.parseScriptJson(html, debug)
      if (scriptJsonResult.releases.length > 0) {
        releases = scriptJsonResult.releases
        strategy = 'script-json'
        if (debug) {
          console.log(`[Footpatrol Adapter] Script JSON extracted ${releases.length} releases`)
        }
      }

      // Strategy 2: __NEXT_DATA__ or Shopify data
      if (releases.length === 0) {
        const shopifyResult = this.parseShopifyData(html, debug)
        if (shopifyResult.releases.length > 0) {
          releases = shopifyResult.releases
          strategy = 'nextdata'
          if (debug) {
            console.log(`[Footpatrol Adapter] Shopify data extracted ${releases.length} releases`)
          }
        }
      }

      // Strategy 3: JSON-LD
      if (releases.length === 0) {
        const jsonLdResult = this.parseJsonLd(html, debug)
        if (jsonLdResult.releases.length > 0) {
          releases = jsonLdResult.releases
          strategy = 'jsonld'
          if (debug) {
            console.log(`[Footpatrol Adapter] JSON-LD extracted ${releases.length} releases`)
          }
        }
      }

      // No data found
      if (releases.length === 0) {
        warnings.push('No structured data found in page')
        warnings.push('Footpatrol page may require JavaScript or use dynamic loading')
        if (debug) {
          console.warn('[Footpatrol Adapter] No releases found with any strategy')
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
      errors.push(`Footpatrol fetch failed: ${error.message}`)

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
   * Parse embedded JSON in script tags
   * JD Group sites often use data-component props with JSON
   */
  private parseScriptJson(html: string, debug = false): { releases: NormalizedRelease[] } {
    const releases: NormalizedRelease[] = []

    try {
      const $ = cheerio.load(html)

      // Look for script tags with JSON
      const scripts = $('script:not([src])')

      scripts.each((_, script) => {
        try {
          const content = $(script).html() || ''

          // Try to find JSON assignments or embedded data
          const patterns = [
            /window\.__INITIAL_STATE__\s*=\s*({.+?});/s,
            /window\.__STATE__\s*=\s*({.+?});/s,
            /var\s+launches\s*=\s*(\[.+?\]);/s,
            /const\s+products\s*=\s*(\[.+?\]);/s,
            /"launches":\s*(\[.+?\])/s,
            /"products":\s*(\[.+?\])/s,
          ]

          for (const pattern of patterns) {
            const match = content.match(pattern)
            if (match && match[1]) {
              try {
                const data = JSON.parse(match[1])
                const items = Array.isArray(data) ? data : [data]

                for (const item of items) {
                  const release = this.normalizeProduct(item)
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

      // Also check for data-component attributes with JSON
      $('[data-component]').each((_, element) => {
        try {
          const dataAttr = $(element).attr('data-component')
          if (dataAttr) {
            const data = JSON.parse(dataAttr)
            const release = this.normalizeProduct(data)
            if (release) {
              releases.push(release)
            }
          }
        } catch (error) {
          // Ignore parse errors
        }
      })
    } catch (error: any) {
      if (debug) {
        console.error(`[Footpatrol Adapter] Script JSON parse error: ${error.message}`)
      }
    }

    return { releases }
  }

  /**
   * Parse Shopify or Next.js data structures
   */
  private parseShopifyData(html: string, debug = false): { releases: NormalizedRelease[] } {
    const releases: NormalizedRelease[] = []

    try {
      const $ = cheerio.load(html)

      // Check for __NEXT_DATA__
      const nextDataScript = $('#__NEXT_DATA__')
      if (nextDataScript.length > 0) {
        const content = nextDataScript.html()
        if (content) {
          const data = JSON.parse(content)
          const pageProps = data?.props?.pageProps

          if (pageProps) {
            const products =
              pageProps.products ||
              pageProps.launches ||
              pageProps.items ||
              []

            if (Array.isArray(products)) {
              for (const product of products) {
                const release = this.normalizeProduct(product)
                if (release) {
                  releases.push(release)
                }
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (debug) {
        console.error(`[Footpatrol Adapter] Shopify data parse error: ${error.message}`)
      }
    }

    return { releases }
  }

  /**
   * Normalize Footpatrol product data to our schema
   */
  private normalizeProduct(product: any): NormalizedRelease | null {
    try {
      const title =
        product.title ||
        product.name ||
        product.productName ||
        product.displayName

      if (!title) return null

      const { brand, model, colorway } = parseTitleParts(title, 'Nike')

      const releaseDate =
        product.releaseDate ||
        product.launchDate ||
        product.date ||
        product.publishedDate ||
        product.availableDate

      if (!releaseDate) return null

      const parsedDate = parseUkDate(releaseDate)
      if (!parsedDate) return null

      const imageUrl =
        product.imageUrl ||
        product.image ||
        product.images?.[0] ||
        product.media?.imageUrl ||
        product.thumbnail ||
        product.featured_image

      const url =
        product.url ||
        product.productUrl ||
        product.link ||
        product.handle ||
        product.slug

      const skus = extractSkusFromText(
        `${title} ${product.sku || product.styleCode || product.variant_sku || ''}`,
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
        source_url: url ? (url.startsWith('http') ? url : `https://www.footpatrol.com${url}`) : undefined,
        slug,
        skus,
        raw_title: title,
      }
    } catch (error) {
      return null
    }
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
              const release = this.normalizeProduct(item)
              if (release) {
                releases.push(release)
              }
            }
          }
        } catch (error: any) {
          if (debug) {
            console.warn(`[Footpatrol Adapter] JSON-LD parse error: ${error.message}`)
          }
        }
      })
    } catch (error: any) {
      if (debug) {
        console.error(`[Footpatrol Adapter] JSON-LD extraction failed: ${error.message}`)
      }
    }

    return { releases }
  }
}
