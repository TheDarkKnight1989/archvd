/**
 * Adapter types for release sources
 *
 * Each adapter implements structured data extraction for a specific retailer.
 * NO HTML scraping with CSS selectors - only JSON-LD, script tags, or API feeds.
 */

/**
 * Strategy used to extract data
 */
export type ExtractionStrategy =
  | 'jsonld'           // JSON-LD structured data
  | 'nextdata'         // Next.js __NEXT_DATA__ script tag
  | 'feed'             // JSON API feed/endpoint
  | 'script-json'      // JSON embedded in script tags
  | 'html-fallback'    // Last resort HTML parsing (avoid)

/**
 * Normalized release data returned by adapters
 */
export interface NormalizedRelease {
  title: string
  brand: string
  model: string
  colorway?: string
  release_date: string  // YYYY-MM-DD
  image_url?: string
  source_url?: string
  slug: string
  skus: string[]
  raw_title?: string    // Original title for debugging
}

/**
 * Result from adapter fetch
 */
export interface AdapterResult {
  releases: NormalizedRelease[]
  strategy: ExtractionStrategy
  metadata?: {
    htmlLength?: number
    itemsFound?: number
    warnings?: string[]
    errors?: string[]
  }
}

/**
 * Adapter fetch options
 */
export interface FetchOptions {
  debug?: boolean
  timeout?: number
  retries?: number
}

/**
 * Release source adapter interface
 *
 * Each retailer implements this interface to provide structured data extraction.
 */
export interface ReleaseAdapter {
  /**
   * Source name (e.g., 'nike', 'size', 'footpatrol')
   */
  readonly name: string

  /**
   * Source URL to fetch
   */
  readonly url: string

  /**
   * Fetch and parse releases from the source
   *
   * @param options - Fetch options
   * @returns Adapter result with releases and metadata
   */
  fetchIndex(options?: FetchOptions): Promise<AdapterResult>
}
