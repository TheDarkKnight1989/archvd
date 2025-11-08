/**
 * Nike SNKRS adapter
 *
 * Strategy:
 * 1. Parse JSON-LD structured data (<script type="application/ld+json">)
 * 2. Parse __NEXT_DATA__ if available
 * 3. Check for embedded feed JSON
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

export class NikeAdapter implements ReleaseAdapter {
  readonly name = 'nike'
  readonly url = 'https://www.nike.com/gb/launch'

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
        console.log(`[Nike Adapter] Fetched ${html.length} bytes`)
      }

      // Check if likely dynamic
      if (isLikelyDynamic(html)) {
        warnings.push('Page appears to be JS-rendered (client-side only)')
        if (debug) {
          console.warn('[Nike Adapter] Page is likely dynamically rendered')
        }
      }

      // Try strategies in order
      let releases: NormalizedRelease[] = []
      let strategy: ExtractionStrategy = 'html-fallback'

      // Strategy 1: JSON-LD
      const jsonLdResult = this.parseJsonLd(html, debug)
      if (jsonLdResult.releases.length > 0) {
        releases = jsonLdResult.releases
        strategy = 'jsonld'
        if (debug) {
          console.log(`[Nike Adapter] JSON-LD extracted ${releases.length} releases`)
        }
      }

      // Strategy 2: __NEXT_DATA__ (if JSON-LD failed)
      if (releases.length === 0) {
        const nextDataResult = this.parseNextData(html, debug)
        if (nextDataResult.releases.length > 0) {
          releases = nextDataResult.releases
          strategy = 'nextdata'
          if (debug) {
            console.log(`[Nike Adapter] __NEXT_DATA__ extracted ${releases.length} releases`)
          }
        }
      }

      // Strategy 3: Embedded JSON in script tags
      if (releases.length === 0) {
        const scriptJsonResult = this.parseScriptJson(html, debug)
        if (scriptJsonResult.releases.length > 0) {
          releases = scriptJsonResult.releases
          strategy = 'script-json'
          if (debug) {
            console.log(`[Nike Adapter] Script JSON extracted ${releases.length} releases`)
          }
        }
      }

      // No data found
      if (releases.length === 0) {
        warnings.push('No structured data found in page')
        warnings.push('Consider using API endpoint or headless browser')
        if (debug) {
          console.warn('[Nike Adapter] No releases found with any strategy')
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
      errors.push(`Nike fetch failed: ${error.message}`)

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
   * Parse JSON-LD structured data
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

          // Handle different JSON-LD structures
          if (data['@type'] === 'Product' || data['@type'] === 'ItemList') {
            const items = Array.isArray(data.itemListElement)
              ? data.itemListElement
              : [data]

            for (const item of items) {
              const release = this.normalizeJsonLdItem(item)
              if (release) {
                releases.push(release)
              }
            }
          } else if (Array.isArray(data)) {
            // Sometimes it's an array of products
            for (const item of data) {
              const release = this.normalizeJsonLdItem(item)
              if (release) {
                releases.push(release)
              }
            }
          }
        } catch (error: any) {
          if (debug) {
            console.warn(`[Nike Adapter] JSON-LD parse error: ${error.message}`)
          }
        }
      })
    } catch (error: any) {
      if (debug) {
        console.error(`[Nike Adapter] JSON-LD extraction failed: ${error.message}`)
      }
    }

    return { releases }
  }

  /**
   * Normalize JSON-LD item to our schema
   */
  private normalizeJsonLdItem(item: any): NormalizedRelease | null {
    try {
      const name = item.name || item.item?.name
      if (!name) return null

      const { brand, model, colorway } = parseTitleParts(name, 'Nike')

      const releaseDate =
        item.releaseDate ||
        item.item?.releaseDate ||
        item.offers?.availabilityStarts

      if (!releaseDate) return null

      const parsedDate = parseUkDate(releaseDate)
      if (!parsedDate) return null

      const imageUrl = item.image || item.item?.image || item.image?.[0]
      const url = item.url || item.item?.url || ''

      const skus = extractSkusFromText(`${name} ${item.sku || ''}`, 'nike')

      const slug = createSlug(brand, model, colorway)

      return {
        title: name,
        brand,
        model,
        colorway: colorway || undefined,
        release_date: parsedDate,
        image_url: typeof imageUrl === 'string' ? imageUrl : undefined,
        source_url: url || undefined,
        slug,
        skus,
        raw_title: name,
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Parse Next.js __NEXT_DATA__
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

      // Navigate the Next.js data structure
      // Structure varies - common paths:
      // - data.props.pageProps.products
      // - data.props.pageProps.initialState.products
      const pageProps = data?.props?.pageProps

      if (!pageProps) return { releases }

      // Try different common paths
      const products =
        pageProps.products ||
        pageProps.initialState?.products ||
        pageProps.data?.products ||
        []

      if (!Array.isArray(products)) {
        if (debug) {
          console.warn('[Nike Adapter] __NEXT_DATA__ found but no products array')
        }
        return { releases }
      }

      for (const product of products) {
        const release = this.normalizeNextDataProduct(product)
        if (release) {
          releases.push(release)
        }
      }
    } catch (error: any) {
      if (debug) {
        console.error(`[Nike Adapter] __NEXT_DATA__ parse error: ${error.message}`)
      }
    }

    return { releases }
  }

  /**
   * Normalize Next.js product data to our schema
   */
  private normalizeNextDataProduct(product: any): NormalizedRelease | null {
    try {
      const title = product.title || product.name || product.displayName
      if (!title) return null

      const { brand, model, colorway } = parseTitleParts(title, 'Nike')

      const releaseDate =
        product.releaseDate ||
        product.launchDate ||
        product.publishedDate

      if (!releaseDate) return null

      const parsedDate = parseUkDate(releaseDate)
      if (!parsedDate) return null

      const imageUrl =
        product.imageUrl ||
        product.image ||
        product.media?.imageUrl ||
        product.media?.portraitURL

      const url = product.url || product.pdpUrl || product.slug

      const skus = extractSkusFromText(
        `${title} ${product.styleCode || product.sku || ''}`,
        'nike'
      )

      const slug = createSlug(brand, model, colorway)

      return {
        title,
        brand,
        model,
        colorway: colorway || undefined,
        release_date: parsedDate,
        image_url: imageUrl || undefined,
        source_url: url ? `https://www.nike.com${url}` : undefined,
        slug,
        skus,
        raw_title: title,
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Parse embedded JSON in script tags (window.__STATE__, etc.)
   */
  private parseScriptJson(html: string, debug = false): { releases: NormalizedRelease[] } {
    const releases: NormalizedRelease[] = []

    try {
      const $ = cheerio.load(html)

      // Look for common patterns like window.__STATE__ = {...}
      const scripts = $('script:not([src])')

      scripts.each((_, script) => {
        try {
          const content = $(script).html() || ''

          // Try to find JSON assignments
          const patterns = [
            /window\.__STATE__\s*=\s*({.+?});/s,
            /window\.__INITIAL_STATE__\s*=\s*({.+?});/s,
            /var\s+\w+\s*=\s*({.+?});/s,
          ]

          for (const pattern of patterns) {
            const match = content.match(pattern)
            if (match && match[1]) {
              try {
                const data = JSON.parse(match[1])
                // Try to find products in the data
                const products = this.findProductsInObject(data)
                for (const product of products) {
                  const release = this.normalizeNextDataProduct(product)
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
        console.error(`[Nike Adapter] Script JSON parse error: ${error.message}`)
      }
    }

    return { releases }
  }

  /**
   * Recursively search object for product arrays
   */
  private findProductsInObject(obj: any, depth = 0): any[] {
    if (depth > 5) return [] // Prevent infinite recursion

    const products: any[] = []

    if (Array.isArray(obj)) {
      // Check if this looks like a products array
      if (obj.length > 0 && obj[0].title && obj[0].releaseDate) {
        return obj
      }
      // Recurse into array
      for (const item of obj) {
        products.push(...this.findProductsInObject(item, depth + 1))
      }
    } else if (typeof obj === 'object' && obj !== null) {
      // Check common keys
      if (obj.products && Array.isArray(obj.products)) {
        return obj.products
      }
      if (obj.items && Array.isArray(obj.items)) {
        return obj.items
      }
      // Recurse into object values
      for (const value of Object.values(obj)) {
        products.push(...this.findProductsInObject(value, depth + 1))
      }
    }

    return products
  }
}
