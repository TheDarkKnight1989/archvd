// Row validation and normalisation for bulk import

import type { RawRow, NormalisedRow, RowValidation, HeaderMapping } from './types'

/**
 * Parse price from various formats
 * Accepts: 120, 120.00, £120, 120,00
 */
function parsePrice(value: string): number | null {
  if (!value) return null

  // Remove currency symbols and whitespace
  const cleaned = value
    .replace(/£/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.') // Convert comma decimal to dot
    .trim()

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}

/**
 * Parse date from DD/MM/YYYY or ISO format
 */
function parseDate(value: string): string | null {
  if (!value) return null

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : value.split('T')[0]
  }

  // Try DD/MM/YYYY
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0]
  }

  return null
}

/**
 * Normalise condition from aliases
 */
function normaliseCondition(value: string): 'deadstock' | 'worn' | null {
  if (!value) return null

  const normalized = value.toLowerCase().trim()

  const deadstockAliases = ['deadstock', 'ds', 'new', 'nwob', 'nib', 'bnib']
  const wornAliases = ['worn', 'used', 'vnds', 'pre-owned']

  if (deadstockAliases.includes(normalized)) return 'deadstock'
  if (wornAliases.includes(normalized)) return 'worn'

  return null
}

/**
 * Normalise status from aliases
 */
function normaliseStatus(value: string): 'active' | 'listed' | 'worn' | 'sold' | null {
  if (!value) return null

  const normalized = value.toLowerCase().trim()

  if (normalized === 'in_stock' || normalized === 'active' || normalized === 'available')
    return 'active'
  if (normalized === 'listed' || normalized === 'for_sale' || normalized === 'selling')
    return 'listed'
  if (normalized === 'sold') return 'sold'
  if (normalized === 'worn') return 'worn'

  return null
}

/**
 * Parse size to number
 */
function parseSize(value: string): number | null {
  if (!value) return null

  const cleaned = value.replace(/[^0-9.]/g, '').trim()
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}

/**
 * Apply header mapping to raw row
 */
function applyMapping(rawRow: RawRow, mapping: HeaderMapping): Partial<NormalisedRow> {
  const mapped: Partial<NormalisedRow> = {}

  Object.entries(mapping).forEach(([detectedHeader, targetField]) => {
    if (!targetField || !rawRow[detectedHeader]) return

    const value = rawRow[detectedHeader].trim()
    if (!value) return

    switch (targetField) {
      case 'sku':
      case 'brand':
      case 'model':
      case 'location':
        mapped[targetField] = value
        break
      case 'size_uk':
        mapped.size_uk = parseSize(value)
        break
      case 'purchase_price':
        const price = parsePrice(value)
        if (price !== null) mapped.purchase_price = price
        break
      case 'purchase_date':
        const date = parseDate(value)
        if (date) mapped.purchase_date = date
        break
      case 'condition':
        const condition = normaliseCondition(value)
        if (condition) mapped.condition = condition
        break
      case 'status':
        const status = normaliseStatus(value)
        if (status) mapped.status = status
        break
    }
  })

  return mapped
}

/**
 * Validate and normalise a single row
 */
export function validateRow(
  rawRow: RawRow,
  mapping: HeaderMapping,
  rowIndex: number
): RowValidation {
  const errors: string[] = []
  const mapped = applyMapping(rawRow, mapping)

  // Check required fields
  if (!mapped.sku) {
    errors.push('SKU is required')
  }

  if (mapped.purchase_price === undefined) {
    errors.push('Purchase price is required')
  } else if (mapped.purchase_price < 0) {
    errors.push('Purchase price must be ≥ 0')
  }

  // Set defaults for missing optional fields
  const normalised: NormalisedRow = {
    sku: mapped.sku || '',
    brand: mapped.brand,
    model: mapped.model,
    size_uk: mapped.size_uk,
    purchase_price: mapped.purchase_price || 0,
    purchase_date: mapped.purchase_date || new Date().toISOString().split('T')[0],
    condition: mapped.condition || 'deadstock',
    status: mapped.status || 'active',
    location: mapped.location,
  }

  return {
    ok: errors.length === 0,
    errors,
    value: errors.length === 0 ? normalised : undefined,
    rowIndex,
  }
}

/**
 * Validate all rows
 */
export function validateRows(
  rawRows: RawRow[],
  mapping: HeaderMapping
): RowValidation[] {
  return rawRows.map((row, index) => validateRow(row, mapping, index))
}

/**
 * Get validation summary
 */
export function getValidationSummary(validations: RowValidation[]): {
  valid: number
  withErrors: number
  total: number
} {
  const valid = validations.filter((v) => v.ok).length
  return {
    valid,
    withErrors: validations.length - valid,
    total: validations.length,
  }
}
