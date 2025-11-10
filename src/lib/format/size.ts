/**
 * Format size for display
 * Handles cases where size might already include region prefix (UK, US, EU)
 */
export function formatSize(size: string | null | undefined, region: 'UK' | 'US' | 'EU' = 'UK'): string {
  if (!size) return '—'

  const sizeStr = size.toString().trim()

  // Check if size already has a region prefix
  if (sizeStr.match(/^(UK|US|EU)\s/i)) {
    return sizeStr
  }

  // Add region prefix
  return `${region} ${sizeStr}`
}
