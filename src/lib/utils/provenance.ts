/**
 * Provenance Utilities
 *
 * Display provider attribution for market prices
 */

import type { Provider, ProvenanceInfo } from '@/types/product'

/**
 * Get display name for provider
 */
export function getProviderDisplayName(provider: Provider | null | undefined): string {
  if (!provider) return 'Unknown'

  const names: Record<Provider, string> = {
    stockx: 'StockX',
    alias: 'Alias',
    ebay: 'eBay',
    seed: 'Demo',
  }

  return names[provider] || provider
}

/**
 * Get provider icon/badge identifier
 */
export function getProviderIcon(provider: Provider | null | undefined): string | null {
  if (!provider) return null

  const icons: Record<Provider, string> = {
    stockx: 'Sx',
    alias: 'Al',
    ebay: 'Eb',
    seed: 'Sd',
  }

  return icons[provider] || null
}

/**
 * Format relative time from ISO timestamp
 * Examples: "2 hours ago", "3 days ago", "just now"
 */
export function formatRelativeTime(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return 'unknown'

  try {
    const date = new Date(isoTimestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffSec < 60) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay < 7) return `${diffDay}d ago`
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`
    if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`

    return `${Math.floor(diffDay / 365)}y ago`
  } catch {
    return 'unknown'
  }
}

/**
 * Format exact timestamp for tooltip
 * Example: "14 Jan 2025, 14:32"
 */
export function formatExactTime(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return 'Unknown'

  try {
    const date = new Date(isoTimestamp)
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Unknown'
  }
}

/**
 * Build provenance info object
 */
export function buildProvenanceInfo(
  provider: Provider | null | undefined,
  timestamp: string | null | undefined
): ProvenanceInfo | null {
  if (!provider) return null

  return {
    provider,
    displayName: getProviderDisplayName(provider),
    timestamp: timestamp || new Date().toISOString(),
    relativeTime: formatRelativeTime(timestamp),
    icon: getProviderIcon(provider) || undefined,
  }
}

/**
 * Get provider product page URL
 * Returns null if provider doesn't support direct product links or SKU format is unknown
 */
export function getProviderProductUrl(
  provider: Provider | null | undefined,
  sku: string,
  productId?: string | null
): string | null {
  if (!provider || !sku) return null

  switch (provider) {
    case 'stockx':
      // StockX uses URL slugs, not raw SKUs
      // For now, return null - we'd need to store the slug or product ID
      return productId ? `https://stockx.com/${productId}` : null

    case 'alias':
      // Alias uses product IDs in their URLs
      return productId ? `https://alias.co/products/${productId}` : null

    case 'ebay':
      // eBay uses item IDs
      return productId ? `https://www.ebay.com/itm/${productId}` : null

    case 'seed':
      // Demo data - no external link
      return null

    default:
      return null
  }
}
