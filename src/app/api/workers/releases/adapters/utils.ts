/**
 * Shared utilities for release adapters
 */

import { extractSkus } from '@/lib/sku'

/**
 * Fetch with retry, rate limiting, and realistic headers
 */
export async function fetchWithRetry(
  url: string,
  options?: {
    retries?: number
    timeout?: number
    delay?: number
  }
): Promise<Response> {
  const { retries = 3, timeout = 30000, delay = 1000 } = options || {}

  const urlObj = new URL(url)
  const origin = urlObj.origin

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ArchvdBot/1.0 (+https://archvd.io/dev; archvd.io/dev)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': origin,
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      })

      clearTimeout(timeoutId)

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i) * delay
        console.warn(`[Fetch] Rate limited, waiting ${waitTime}ms...`)
        await new Promise(r => setTimeout(r, waitTime))
        continue
      }

      // Add delay between requests to be respectful
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delay))
      }

      return response
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`)
      }

      // Exponential backoff for network errors
      if (i < retries - 1) {
        const waitTime = Math.pow(2, i) * delay
        console.warn(`[Fetch] Error (${error.message}), retrying in ${waitTime}ms...`)
        await new Promise(r => setTimeout(r, waitTime))
        continue
      }

      throw error
    }
  }

  throw new Error('Max retries exceeded')
}

/**
 * Parse UK date formats to YYYY-MM-DD
 *
 * Handles:
 * - ISO: 2025-12-25
 * - UK: 25/12/2025, 25-12-2025
 * - Text: 25 December 2025, Dec 25 2025
 */
export function parseUkDate(dateStr: string): string | null {
  if (!dateStr) return null

  const cleaned = dateStr.trim()

  // ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned
  }

  // Try parsing with Date
  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // UK format (DD/MM/YYYY or DD-MM-YYYY)
  const ukMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (ukMatch) {
    const [, day, month, year] = ukMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return null
}

/**
 * Normalize title text
 */
export function normalizeTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .substring(0, 200)
}

/**
 * Parse title into brand, model, colorway
 */
export function parseTitleParts(title: string, defaultBrand: string = 'Nike'): {
  brand: string
  model: string
  colorway: string
} {
  const normalized = normalizeTitle(title)

  // Known brands
  const knownBrands = [
    'Nike',
    'Jordan',
    'Air Jordan',
    'adidas',
    'New Balance',
    'ASICS',
    'Puma',
    'Salomon',
    'Vans',
    'Converse',
    'Reebok',
    'On',
    'Hoka',
  ]

  // Try to extract brand from title (first word if it's a known brand)
  const firstWord = normalized.split(/\s+/)[0]
  let brand = defaultBrand
  let remainder = normalized

  for (const knownBrand of knownBrands) {
    if (normalized.toLowerCase().startsWith(knownBrand.toLowerCase())) {
      brand = knownBrand
      remainder = normalized.substring(knownBrand.length).trim()
      break
    }
  }

  // Try to find colorway in quotes or after final hyphen/dash
  let colorway = ''
  let model = remainder

  // Check for quoted colorway first (e.g., Nike Dunk Low "Panda")
  const quoteMatch = remainder.match(/[""']([^""']+)[""']/)
  if (quoteMatch) {
    colorway = quoteMatch[1].trim()
    model = remainder.replace(quoteMatch[0], '').trim()
  } else {
    // Check for hyphen/dash separated colorway (after last hyphen)
    const hyphenMatch = remainder.match(/^(.+?)[-–]\s*(.+)$/)
    if (hyphenMatch) {
      model = hyphenMatch[1].trim()
      colorway = hyphenMatch[2].trim()
    }
  }

  return {
    brand: brand.substring(0, 50),
    model: model.substring(0, 100),
    colorway: colorway.substring(0, 100),
  }
}

/**
 * Create URL-safe slug from brand, model, colorway
 */
export function createSlug(brand: string, model: string, colorway?: string): string {
  const parts = [brand, model, colorway].filter(Boolean)
  return parts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100)
}

/**
 * Extract SKUs from text sources using strict patterns
 */
export function extractSkusFromText(text: string, brand?: string): string[] {
  return extractSkus(text, brand)
}

/**
 * Check if HTML appears to be dynamically rendered (JS-only)
 */
export function isLikelyDynamic(html: string): boolean {
  // If HTML is very short, likely JS-rendered
  if (html.length < 5000) return true

  // Check for common SSR/static content indicators
  const hasContent =
    html.includes('<article') ||
    html.includes('<main') ||
    html.includes('class="product') ||
    html.includes('data-product')

  // Check for common React/Next.js hydration markers
  const hasReactMarkers =
    html.includes('__NEXT_DATA__') ||
    html.includes('react-root') ||
    html.includes('data-reactroot')

  // If it has React markers but no content, it's likely client-side only
  return hasReactMarkers && !hasContent
}
