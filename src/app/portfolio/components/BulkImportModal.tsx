'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { parseFile, downloadTemplateCSV } from '@/lib/import/parse'
import { autoMapHeaders, saveMapping, validateMapping, FIELD_DEFINITIONS } from '@/lib/import/headerMap'
import { validateRows, getValidationSummary } from '@/lib/import/validate'
import { insertBatch } from '@/lib/supabase/items'
import { Badge } from '@/components/ui/badge'
import type { RawRow, HeaderMapping, RowValidation, ImportStep } from '@/lib/import/types'
import { v4 as uuidv4 } from 'uuid'

interface BulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (imported: number, skipped: number, batchId: string) => void
  userId?: string
}

export function BulkImportModal({ open, onOpenChange, onSuccess, userId }: BulkImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rawData, setRawData] = useState<RawRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<HeaderMapping>({})
  const [validations, setValidations] = useState<RowValidation[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (selectedFile: File) => {
    setError('')
    setFile(selectedFile)

    const result = await parseFile(selectedFile)

    if (!result.success) {
      setError(result.error || 'Failed to parse file')
      return
    }

    setRawData(result.data)
    setHeaders(result.headers)

    // Auto-map headers
    const autoMapping = autoMapHeaders(result.headers)
    setMapping(autoMapping)

    setStep('map')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleMapSubmit = () => {
    const validation = validateMapping(mapping)

    if (!validation.valid) {
      setError(`Missing required fields: ${validation.missingFields.join(', ')}`)
      return
    }

    // Save mapping for next time
    saveMapping(mapping)

    // Validate all rows
    const rowValidations = validateRows(rawData, mapping)
    setValidations(rowValidations)

    setStep('preview')
  }

  const handleImport = async () => {
    if (!userId) {
      setError('User not authenticated')
      return
    }

    setStep('importing')
    setProgress(0)

    const validRows = validations.filter((v) => v.ok && v.value).map((v) => v.value!)
    const importBatchId = uuidv4()

    try {
      const result = await insertBatch(validRows, importBatchId, userId)
      setProgress(100)

      setStep('complete')
      onSuccess(result.inserted, result.skipped, importBatchId)

      // Reset after short delay
      setTimeout(() => {
        resetModal()
        onOpenChange(false)
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Import failed')
      setStep('preview')
    }
  }

  const resetModal = () => {
    setStep('upload')
    setFile(null)
    setRawData([])
    setHeaders([])
    setMapping({})
    setValidations([])
    setError('')
    setProgress(0)
  }

  const summary = getValidationSummary(validations)
  const canImport = summary.valid > 0

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetModal(); onOpenChange(open) }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import</DialogTitle>
          <p className="text-sm text-muted">
            {step === 'upload' && 'Upload a CSV or XLSX file'}
            {step === 'map' && 'Map your columns to fields'}
            {step === 'preview' && 'Review and import'}
            {step === 'importing' && 'Importing your items...'}
            {step === 'complete' && 'Import complete!'}
          </p>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg">
          <Step active={step === 'upload'} completed={['map', 'preview', 'importing', 'complete'].includes(step)} number={1} label="Upload" />
          <div className="flex-1 h-px bg-border" />
          <Step active={step === 'map'} completed={['preview', 'importing', 'complete'].includes(step)} number={2} label="Map" />
          <div className="flex-1 h-px bg-border" />
          <Step active={step === 'preview' || step === 'importing'} completed={step === 'complete'} number={3} label="Import" />
        </div>

        {/* Error display */}
        {error && (
          <div className="px-4 py-3 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-1">
          {step === 'upload' && (
            <UploadStep
              onFileSelect={handleFileSelect}
              onDownloadTemplate={downloadTemplateCSV}
              fileInputRef={fileInputRef}
              onDrop={handleDrop}
            />
          )}

          {step === 'map' && (
            <MapStep
              headers={headers}
              mapping={mapping}
              onMappingChange={setMapping}
            />
          )}

          {step === 'preview' && (
            <PreviewStep
              validations={validations}
              summary={summary}
            />
          )}

          {step === 'importing' && (
            <ImportingStep progress={progress} />
          )}

          {step === 'complete' && (
            <CompleteStep inserted={summary.valid} skipped={summary.withErrors} />
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleMapSubmit}>
                Continue to Preview
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={!canImport}>
                Import {summary.valid} row{summary.valid !== 1 ? 's' : ''}
              </Button>
            </>
          )}

          {(step === 'importing' || step === 'complete') && null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Step components
function Step({ active, completed, number, label }: { active: boolean; completed: boolean; number: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${
          completed ? 'bg-success text-black' : active ? 'bg-accent text-black' : 'bg-border text-dim'
        }`}
      >
        {completed ? '✓' : number}
      </div>
      <span className={`text-xs font-medium ${active ? 'text-fg' : 'text-muted'}`}>{label}</span>
    </div>
  )
}

function UploadStep({
  onFileSelect,
  onDownloadTemplate,
  fileInputRef,
  onDrop,
}: {
  onFileSelect: (file: File) => void
  onDownloadTemplate: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onDrop: (e: React.DragEvent) => void
}) {
  return (
    <div className="space-y-4 p-4">
      <div
        className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-accent transition-colors cursor-pointer"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted" />
        <p className="text-sm text-fg font-medium mb-2">Drop your file here or click to browse</p>
        <p className="text-xs text-muted">Supports CSV and XLSX files</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFileSelect(file)
          }}
          className="hidden"
        />
      </div>

      <div className="flex items-center justify-center">
        <Button variant="outline" size="sm" onClick={onDownloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download Template CSV
        </Button>
      </div>
    </div>
  )
}

function MapStep({
  headers,
  mapping,
  onMappingChange,
}: {
  headers: string[]
  mapping: HeaderMapping
  onMappingChange: (mapping: HeaderMapping) => void
}) {
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted">Map your file columns to database fields</p>

      {headers.map((header) => (
        <div key={header} className="grid grid-cols-2 gap-4 items-center">
          <div className="text-sm font-medium text-fg">{header}</div>
          <select
            value={mapping[header] || ''}
            onChange={(e) => onMappingChange({ ...mapping, [header]: e.target.value || null })}
            className="flex h-10 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <option value="">-- Skip --</option>
            {FIELD_DEFINITIONS.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label} {field.required && '*'}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div className="pt-4 text-xs text-muted">
        <p>* Required fields: SKU, Purchase Price</p>
      </div>
    </div>
  )
}

function PreviewStep({ validations, summary }: { validations: RowValidation[]; summary: { valid: number; withErrors: number; total: number } }) {
  const previewRows = validations.slice(0, 50)

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4">
        <Badge variant="default" className="bg-success/10 text-success border-success/30">
          Valid: {summary.valid}
        </Badge>
        <Badge variant="default" className="bg-danger/10 text-danger border-danger/30">
          Errors: {summary.withErrors}
        </Badge>
        <span className="text-sm text-muted">Total: {summary.total}</span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-panel border-b border-keyline z-10 shadow-sm">
              <tr>
                <th className="px-3 py-2 text-left label-up">#</th>
                <th className="px-3 py-2 text-left label-up">SKU</th>
                <th className="px-3 py-2 text-left label-up">Brand</th>
                <th className="px-3 py-2 text-left label-up">Price</th>
                <th className="px-3 py-2 text-left label-up">Status</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((validation, index) => (
                <tr
                  key={validation.rowIndex}
                  className={cn(
                    "min-h-12 hover:bg-table-hover transition-boutique",
                    validation.ok ? (index % 2 === 0 ? 'bg-table-zebra' : 'bg-panel') : 'bg-danger/5'
                  )}
                >
                  <td className="px-3 py-2 text-dim">
                    {validation.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-danger" />
                    )}
                  </td>
                  <td className="px-3 py-2">{validation.value?.sku || '—'}</td>
                  <td className="px-3 py-2">{validation.value?.brand || '—'}</td>
                  <td className="px-3 py-2 num">£{validation.value?.purchase_price.toFixed(2) || '—'}</td>
                  <td className="px-3 py-2">
                    {validation.ok ? (
                      <Badge variant="default" className="text-xs">
                        {validation.value?.status}
                      </Badge>
                    ) : (
                      <span className="text-xs text-danger">{validation.errors.join(', ')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {validations.length > 50 && (
        <p className="text-xs text-muted text-center">Showing first 50 of {validations.length} rows</p>
      )}
    </div>
  )
}

function ImportingStep({ progress }: { progress: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-accent" />
      <p className="text-sm text-muted">Importing your items...</p>
      <div className="w-64 h-2 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function CompleteStep({ inserted, skipped }: { inserted: number; skipped: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <CheckCircle2 className="h-16 w-16 text-success" />
      <div className="text-center">
        <p className="text-lg font-medium text-fg mb-2">Import Complete!</p>
        <p className="text-sm text-muted">
          Imported {inserted} row{inserted !== 1 ? 's' : ''}
          {skipped > 0 && ` • ${skipped} error${skipped !== 1 ? 's' : ''} skipped`}
        </p>
      </div>
    </div>
  )
}
