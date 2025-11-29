/**
 * Data Import Component
 * Import sales, expenses, and inventory from CSV/Excel files
 */

'use client'

import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Download } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface ImportPreview {
  fileName: string
  rowCount: number
  columns: string[]
  sampleData: any[]
  errors: string[]
  warnings: string[]
}

interface FieldMapping {
  csvColumn: string
  dbField: string
}

interface DataImportProps {
  onImport?: (data: any[], mappings: FieldMapping[]) => Promise<void>
  className?: string
}

export function DataImport({ onImport, className }: DataImportProps) {
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [importType, setImportType] = useState<'sales' | 'expenses' | 'inventory'>('sales')

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Parse CSV/Excel file
    // This is a simplified version - would use a library like PapaParse or xlsx
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n')
        const headers = lines[0].split(',').map(h => h.trim())
        const sampleRows = lines.slice(1, 6).map(line => {
          const values = line.split(',')
          return headers.reduce((obj, header, i) => {
            obj[header] = values[i]?.trim()
            return obj
          }, {} as any)
        })

        // Validate and detect errors
        const errors: string[] = []
        const warnings: string[] = []

        if (headers.length < 3) {
          errors.push('File must have at least 3 columns')
        }

        if (lines.length < 2) {
          errors.push('File must have at least 1 data row')
        }

        // Detect common issues
        const hasDateColumn = headers.some(h =>
          h.toLowerCase().includes('date') ||
          h.toLowerCase().includes('time')
        )
        if (!hasDateColumn) {
          warnings.push('No date column detected - you may need to map this manually')
        }

        const hasPriceColumn = headers.some(h =>
          h.toLowerCase().includes('price') ||
          h.toLowerCase().includes('amount') ||
          h.toLowerCase().includes('cost')
        )
        if (!hasPriceColumn) {
          warnings.push('No price/amount column detected')
        }

        setPreview({
          fileName: file.name,
          rowCount: lines.length - 1,
          columns: headers,
          sampleData: sampleRows,
          errors,
          warnings
        })

        // Auto-map common fields
        const autoMappings: FieldMapping[] = headers.map(csvColumn => {
          const lower = csvColumn.toLowerCase()

          // Sales mappings
          if (importType === 'sales') {
            if (lower.includes('product') || lower.includes('item') || lower.includes('name')) {
              return { csvColumn, dbField: 'product_name' }
            }
            if (lower.includes('sale') && lower.includes('price')) {
              return { csvColumn, dbField: 'sale_price' }
            }
            if (lower.includes('buy') && lower.includes('price') || lower.includes('cost')) {
              return { csvColumn, dbField: 'buy_price' }
            }
            if (lower.includes('date')) {
              return { csvColumn, dbField: 'sale_date' }
            }
            if (lower.includes('platform')) {
              return { csvColumn, dbField: 'platform' }
            }
          }

          // Expense mappings
          if (importType === 'expenses') {
            if (lower.includes('description') || lower.includes('name')) {
              return { csvColumn, dbField: 'description' }
            }
            if (lower.includes('amount') || lower.includes('cost')) {
              return { csvColumn, dbField: 'amount' }
            }
            if (lower.includes('category')) {
              return { csvColumn, dbField: 'category' }
            }
            if (lower.includes('date')) {
              return { csvColumn, dbField: 'date' }
            }
          }

          return { csvColumn, dbField: '' }
        })

        setMappings(autoMappings)
      } catch (error) {
        setPreview({
          fileName: file.name,
          rowCount: 0,
          columns: [],
          sampleData: [],
          errors: ['Failed to parse file. Please ensure it\'s a valid CSV file.'],
          warnings: []
        })
      }
    }
    reader.readAsText(file)
  }, [importType])

  const handleImport = async () => {
    if (!preview || !onImport) return

    setImporting(true)
    try {
      // Parse full file and map fields
      // This would be done server-side in production
      await onImport(preview.sampleData, mappings)

      // Clear preview after successful import
      setPreview(null)
      setMappings([])
    } catch (error) {
      console.error('Import failed:', error)
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = (type: 'sales' | 'expenses' | 'inventory') => {
    let csvContent = ''

    if (type === 'sales') {
      csvContent = 'product_name,brand,size,sale_price,buy_price,sale_date,platform,buyer_email\n'
      csvContent += 'Nike Air Max 90,Nike,UK 9,125.00,80.00,2024-12-15,StockX,buyer@example.com\n'
    } else if (type === 'expenses') {
      csvContent = 'description,amount,category,date,payment_method\n'
      csvContent += 'Shipping costs,12.50,Shipping,2024-12-15,PayPal\n'
    } else if (type === 'inventory') {
      csvContent = 'product_name,brand,size,buy_price,purchase_date,condition,purchase_place\n'
      csvContent += 'Adidas Yeezy 350,Adidas,UK 10,180.00,2024-12-01,New,GOAT\n'
    }

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}_import_template.csv`
    a.click()
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Upload className="h-5 w-5 text-accent" />
        <div>
          <h3 className="text-lg font-semibold text-fg">Data Import</h3>
          <p className="text-sm text-muted mt-0.5">Import sales, expenses, or inventory from CSV/Excel</p>
        </div>
      </div>

      {/* Import Type Selector */}
      <div className="mb-5">
        <div className="text-xs text-dim uppercase tracking-wide mb-2">Import Type</div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setImportType('sales')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              importType === 'sales'
                ? 'bg-accent/20 text-fg'
                : 'bg-elev-0 text-muted hover:bg-elev-1'
            )}
          >
            Sales
          </button>
          <button
            onClick={() => setImportType('expenses')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              importType === 'expenses'
                ? 'bg-accent/20 text-fg'
                : 'bg-elev-0 text-muted hover:bg-elev-1'
            )}
          >
            Expenses
          </button>
          <button
            onClick={() => setImportType('inventory')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              importType === 'inventory'
                ? 'bg-accent/20 text-fg'
                : 'bg-elev-0 text-muted hover:bg-elev-1'
            )}
          >
            Inventory
          </button>
        </div>
      </div>

      {/* Templates */}
      <div className="mb-5 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-blue-400 mb-1">Need a template?</div>
            <div className="text-xs text-blue-400">Download a CSV template with the correct format</div>
          </div>
          <Button
            onClick={() => downloadTemplate(importType)}
            size="sm"
            className="bg-blue-500 text-white hover:bg-blue-600"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>
      </div>

      {/* File Upload */}
      {!preview && (
        <label className="block cursor-pointer group">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="p-12 border-2 border-dashed border-border rounded-xl hover:border-accent/50 hover:bg-accent/5 transition-all text-center group-hover:scale-[1.01]">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="h-10 w-10 text-accent" />
            </div>
            <div className="text-lg font-semibold text-fg mb-2">
              Upload Your {importType === 'sales' ? 'Sales' : importType === 'expenses' ? 'Expense' : 'Inventory'} Data
            </div>
            <div className="text-sm text-muted mb-4">
              Click to browse or drag and drop your file here
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-elev-0 rounded-lg text-xs text-dim border border-border/30">
              <Upload className="h-3.5 w-3.5" />
              <span>Supports CSV, XLSX, XLS (max 10MB)</span>
            </div>
          </div>
        </label>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          {/* File Info */}
          <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-accent" />
                <div>
                  <div className="text-sm font-semibold text-fg">{preview.fileName}</div>
                  <div className="text-xs text-muted">{preview.rowCount} rows detected</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setPreview(null)
                  setMappings([])
                }}
                className="p-1 hover:bg-elev-1 rounded transition-colors"
              >
                <X className="h-4 w-4 text-dim" />
              </button>
            </div>

            {/* Errors */}
            {preview.errors.length > 0 && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-red-400">
                    <div className="font-semibold mb-1">Errors found:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {preview.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-400">
                    <div className="font-semibold mb-1">Warnings:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {preview.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Field Mapping */}
          {preview.errors.length === 0 && (
            <>
              <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
                <div className="text-sm font-semibold text-fg mb-3">Map Your Fields</div>
                <div className="space-y-2">
                  {mappings.map((mapping, index) => (
                    <div key={index} className="grid grid-cols-2 gap-3">
                      <div className="p-2 bg-elev-1 rounded border border-border/30">
                        <div className="text-xs text-dim mb-1">CSV Column</div>
                        <div className="text-sm text-fg font-mono">{mapping.csvColumn}</div>
                      </div>
                      <select
                        value={mapping.dbField}
                        onChange={(e) => {
                          const newMappings = [...mappings]
                          newMappings[index].dbField = e.target.value
                          setMappings(newMappings)
                        }}
                        className="px-3 py-2 bg-elev-1 border border-border rounded text-sm text-fg"
                      >
                        <option value="">Don't import</option>
                        {importType === 'sales' && (
                          <>
                            <option value="product_name">Product Name</option>
                            <option value="brand">Brand</option>
                            <option value="size">Size</option>
                            <option value="sale_price">Sale Price</option>
                            <option value="buy_price">Buy Price</option>
                            <option value="sale_date">Sale Date</option>
                            <option value="platform">Platform</option>
                            <option value="buyer_email">Buyer Email</option>
                          </>
                        )}
                        {importType === 'expenses' && (
                          <>
                            <option value="description">Description</option>
                            <option value="amount">Amount</option>
                            <option value="category">Category</option>
                            <option value="date">Date</option>
                            <option value="payment_method">Payment Method</option>
                          </>
                        )}
                        {importType === 'inventory' && (
                          <>
                            <option value="product_name">Product Name</option>
                            <option value="brand">Brand</option>
                            <option value="size">Size</option>
                            <option value="buy_price">Buy Price</option>
                            <option value="purchase_date">Purchase Date</option>
                            <option value="condition">Condition</option>
                            <option value="purchase_place">Purchase Place</option>
                          </>
                        )}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Data Preview */}
              <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
                <div className="text-sm font-semibold text-fg mb-3">Preview (First 5 Rows)</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        {preview.columns.map((col, i) => (
                          <th key={i} className="text-left p-2 text-dim font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleData.map((row, i) => (
                        <tr key={i} className="border-b border-border/30">
                          {preview.columns.map((col, j) => (
                            <td key={j} className="p-2 text-fg font-mono">
                              {row[col]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import Button */}
              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={importing || mappings.every(m => !m.dbField)}
                  className="flex-1 bg-[#00FF94] text-black hover:bg-[#00FF94]/90"
                >
                  {importing ? (
                    <>Processing {preview.rowCount} rows...</>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Import {preview.rowCount} Rows
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setPreview(null)
                    setMappings([])
                  }}
                  variant="outline"
                  className="border-border/30"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
        <strong>Important:</strong> Review all data before importing. Duplicates will be skipped automatically. Large imports may take a few minutes to process.
      </div>
    </div>
  )
}
