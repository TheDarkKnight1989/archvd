/**
 * CSV Export Utilities
 * Client-side CSV generation and download helpers
 */

/**
 * Convert an array of objects to CSV string
 * @param rows - Array of data objects
 * @param headers - Array of header strings (keys to extract from rows)
 * @returns CSV string with headers and data rows
 */
export function toCsv(rows: any[], headers: string[]): string {
  // Create header row
  const headerRow = headers.join(',')

  // Create data rows
  const dataRows = rows.map(row => {
    return headers.map(header => {
      const value = row[header]

      // Handle null/undefined
      if (value === null || value === undefined) {
        return ''
      }

      // Convert to string
      const stringValue = String(value)

      // Escape values that contain commas, quotes, or newlines
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }

      return stringValue
    }).join(',')
  })

  // Combine header and data rows
  return [headerRow, ...dataRows].join('\n')
}

/**
 * Trigger browser download of CSV file
 * @param filename - Name of the file to download
 * @param csv - CSV content string
 */
export function downloadCsv(filename: string, csv: string): void {
  // Create blob with UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })

  // Create download link and trigger
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up URL
  URL.revokeObjectURL(url)
}

/**
 * Format a number as GBP for CSV (numeric value, no symbol)
 * @param value - Number to format
 * @returns Formatted string
 */
export function formatGbpForCsv(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value.toFixed(2)
}

/**
 * Format a date for CSV (YYYY-MM-DD format)
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export function formatDateForCsv(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}
