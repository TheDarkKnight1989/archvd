// Header mapping and aliasing for bulk import

import type { FieldDefinition, HeaderMapping } from './types'

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'sku',
    label: 'SKU',
    required: true,
    aliases: ['sku', 'style_code', 'product_code', 'item_code'],
  },
  {
    key: 'brand',
    label: 'Brand',
    required: false,
    aliases: ['brand', 'manufacturer', 'make'],
  },
  {
    key: 'model',
    label: 'Model',
    required: false,
    aliases: ['model', 'name', 'product_name', 'title'],
  },
  {
    key: 'size_uk',
    label: 'Size (UK)',
    required: false,
    aliases: ['size_uk', 'size', 'uk_size', 'uk'],
  },
  {
    key: 'purchase_price',
    label: 'Purchase Price',
    required: true,
    aliases: ['purchase_price', 'price', 'cost', 'buy_price', 'paid'],
  },
  {
    key: 'purchase_date',
    label: 'Purchase Date',
    required: false,
    aliases: ['purchase_date', 'date', 'bought_date', 'acquired_date'],
  },
  {
    key: 'condition',
    label: 'Condition',
    required: false,
    aliases: ['condition', 'state', 'quality'],
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    aliases: ['status', 'availability', 'stock_status'],
  },
  {
    key: 'location',
    label: 'Location',
    required: false,
    aliases: ['location', 'storage', 'warehouse', 'shelf'],
  },
]

/**
 * Auto-detect header mapping based on aliases
 */
export function autoMapHeaders(detectedHeaders: string[]): HeaderMapping {
  const mapping: HeaderMapping = {}

  detectedHeaders.forEach((header) => {
    const normalized = header.toLowerCase().trim().replace(/\s+/g, '_')

    // Try to find matching field
    const matchedField = FIELD_DEFINITIONS.find((field) =>
      field.aliases.some((alias) => alias === normalized)
    )

    mapping[header] = matchedField?.key || null
  })

  return mapping
}

/**
 * Get saved mapping from localStorage
 */
export function getSavedMapping(): HeaderMapping | null {
  if (typeof window === 'undefined') return null

  try {
    const saved = localStorage.getItem('archvd_import_mapping')
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

/**
 * Save mapping to localStorage
 */
export function saveMapping(mapping: HeaderMapping): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem('archvd_import_mapping', JSON.stringify(mapping))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Validate that all required fields are mapped
 */
export function validateMapping(mapping: HeaderMapping): {
  valid: boolean
  missingFields: string[]
} {
  const requiredFields = FIELD_DEFINITIONS.filter((f) => f.required).map((f) => f.key)

  const mappedFields = Object.values(mapping).filter((v) => v !== null) as string[]

  const missingFields = requiredFields.filter((field) => !mappedFields.includes(field))

  return {
    valid: missingFields.length === 0,
    missingFields,
  }
}
