// Bulk import type definitions

export type RawRow = Record<string, string>

export type NormalisedRow = {
  sku: string
  brand?: string
  model?: string
  size_uk?: number | null
  purchase_price: number
  purchase_date: string // ISO yyyy-mm-dd
  condition?: 'deadstock' | 'worn'
  status?: 'active' | 'listed' | 'worn' | 'sold'
  location?: string
}

export type RowValidation = {
  ok: boolean
  errors: string[] // per-cell messages
  value?: NormalisedRow
  rowIndex: number
}

export type HeaderMapping = Record<string, string | null> // detected header -> target field

export type ImportStep = 'upload' | 'map' | 'preview' | 'importing' | 'complete'

export type ImportResult = {
  inserted: number
  skipped: number
  importBatchId: string
}

export type FieldDefinition = {
  key: string
  label: string
  required: boolean
  aliases: string[]
}
