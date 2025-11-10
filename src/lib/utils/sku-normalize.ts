/**
 * SKU Normalization Utilities
 * Shared between StockX, Alias, and other providers
 */

// ============================================================================
// SKU Normalization
// ============================================================================

/**
 * Normalize SKU to standard format
 * - Remove dashes and spaces
 * - Convert to uppercase
 * - Handle alternative codes
 */
export function normalizeSku(sku: string): string {
  if (!sku) return ''

  return sku
    .trim()
    .replace(/[\s-]/g, '') // Remove spaces and dashes
    .toUpperCase()
}

/**
 * Generate SKU variations for fuzzy matching
 * Example: "DD1391-100" → ["DD1391100", "DD1391-100", "dd1391100"]
 */
export function generateSkuVariations(sku: string): string[] {
  if (!sku) return []

  const normalized = normalizeSku(sku)
  const original = sku.trim()

  const variations = new Set<string>([
    normalized,
    normalized.toLowerCase(),
    original,
    original.toLowerCase(),
  ])

  // Add dash variations
  if (original.includes('-')) {
    variations.add(original.replace(/-/g, ''))
  } else if (normalized.length > 6) {
    // Try adding dash at common positions
    const withDash = `${normalized.slice(0, -3)}-${normalized.slice(-3)}`
    variations.add(withDash)
    variations.add(withDash.toLowerCase())
  }

  return Array.from(variations)
}

/**
 * Check if two SKUs match (fuzzy comparison)
 */
export function skusMatch(sku1: string, sku2: string): boolean {
  if (!sku1 || !sku2) return false

  const normalized1 = normalizeSku(sku1)
  const normalized2 = normalizeSku(sku2)

  return normalized1 === normalized2
}

/**
 * Calculate SKU similarity score (0-1)
 * Uses Levenshtein distance for fuzzy matching
 */
export function skuSimilarity(sku1: string, sku2: string): number {
  if (!sku1 || !sku2) return 0

  const s1 = normalizeSku(sku1)
  const s2 = normalizeSku(sku2)

  if (s1 === s2) return 1

  const distance = levenshteinDistance(s1, s2)
  const maxLength = Math.max(s1.length, s2.length)

  return 1 - distance / maxLength
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}
