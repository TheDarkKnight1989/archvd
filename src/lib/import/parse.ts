// CSV/XLSX parsing helpers

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { RawRow } from './types'

export type ParseResult = {
  success: boolean
  data: RawRow[]
  headers: string[]
  error?: string
}

/**
 * Parse CSV file
 */
export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          resolve({
            success: false,
            data: [],
            headers: [],
            error: results.errors[0].message,
          })
          return
        }

        const data = results.data as RawRow[]
        const headers = results.meta.fields || []

        resolve({
          success: true,
          data,
          headers,
        })
      },
      error: (error) => {
        resolve({
          success: false,
          data: [],
          headers: [],
          error: error.message,
        })
      },
    })
  })
}

/**
 * Parse XLSX file
 */
export function parseXLSX(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const buffer = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(buffer, { type: 'array' })

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        }) as string[][]

        if (jsonData.length === 0) {
          resolve({
            success: false,
            data: [],
            headers: [],
            error: 'Empty spreadsheet',
          })
          return
        }

        // First row is headers
        const headers = jsonData[0].map((h) => String(h).trim())
        const rows = jsonData.slice(1)

        // Convert to object format
        const data: RawRow[] = rows
          .filter((row) => row.some((cell) => cell)) // Skip empty rows
          .map((row) => {
            const obj: RawRow = {}
            headers.forEach((header, i) => {
              obj[header] = String(row[i] || '').trim()
            })
            return obj
          })

        resolve({
          success: true,
          data,
          headers,
        })
      } catch (error: any) {
        resolve({
          success: false,
          data: [],
          headers: [],
          error: error.message || 'Failed to parse XLSX',
        })
      }
    }

    reader.onerror = () => {
      resolve({
        success: false,
        data: [],
        headers: [],
        error: 'Failed to read file',
      })
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * Parse file based on extension
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'csv') {
    return parseCSV(file)
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseXLSX(file)
  } else {
    return {
      success: false,
      data: [],
      headers: [],
      error: 'Unsupported file format. Please use CSV or XLSX.',
    }
  }
}

/**
 * Generate template CSV
 */
export function generateTemplateCSV(): string {
  const headers = [
    'sku',
    'brand',
    'model',
    'size_uk',
    'purchase_price',
    'purchase_date',
    'condition',
    'status',
    'location',
  ]

  const exampleRows = [
    [
      'DD1391-100',
      'Nike',
      'Dunk Low Panda',
      '9',
      '120',
      '01/09/2025',
      'deadstock',
      'active',
      'Unit A',
    ],
    [
      'DZ5485-612',
      'Jordan',
      'AJ1 Low',
      '10.5',
      '130',
      '2025-09-10',
      'worn',
      'active',
      'Shelf 3',
    ],
    [
      'CT8527-016',
      'Jordan',
      'AJ4 Retro',
      '8.5',
      '250',
      '',
      'deadstock',
      'active',
      'Main',
    ],
  ]

  const csv = [headers, ...exampleRows].map((row) => row.join(',')).join('\n')

  return csv
}

/**
 * Download template CSV
 */
export function downloadTemplateCSV(): void {
  const csv = generateTemplateCSV()
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'archvd-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}
