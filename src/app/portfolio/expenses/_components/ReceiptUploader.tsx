/**
 * Receipt Uploader Component
 * Upload and manage receipt files for expenses
 */

'use client'

import { useState, useRef } from 'react'
import { Upload, File, X, Eye, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface Receipt {
  id: string
  fileName: string
  fileUrl: string
  uploadedAt: string
  size: number
}

interface ReceiptUploaderProps {
  expenseId: string
  receipts: Receipt[]
  onUpload: (file: File) => Promise<void>
  onDelete: (receiptId: string) => Promise<void>
  className?: string
}

export function ReceiptUploader({ expenseId, receipts, onUpload, onDelete, className }: ReceiptUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      alert('Please upload JPG, PNG, or PDF files only')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    setUploading(true)
    try {
      await onUpload(file)
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload receipt')
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
          dragActive
            ? 'border-accent bg-accent/10'
            : 'border-border hover:border-accent/50 hover:bg-accent/5'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg,application/pdf"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />
        <Upload className="h-8 w-8 text-accent mx-auto mb-2" />
        <p className="text-sm font-medium text-fg mb-1">
          {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
        </p>
        <p className="text-xs text-muted">JPG, PNG, or PDF (max 5MB)</p>
      </div>

      {/* Receipt List */}
      {receipts.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-dim uppercase tracking-wide">
            Receipts ({receipts.length})
          </div>
          {receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="flex items-center justify-between p-3 bg-elev-0 rounded-lg border border-border/30"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 p-2 bg-elev-1 rounded">
                  <File className="h-4 w-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-fg truncate">{receipt.fileName}</div>
                  <div className="text-xs text-dim">
                    {formatFileSize(receipt.size)} •{' '}
                    {new Date(receipt.uploadedAt).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={receipt.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-elev-1 rounded transition-colors"
                  title="View receipt"
                >
                  <Eye className="h-4 w-4 text-dim" />
                </a>
                <a
                  href={receipt.fileUrl}
                  download={receipt.fileName}
                  className="p-1.5 hover:bg-elev-1 rounded transition-colors"
                  title="Download receipt"
                >
                  <Download className="h-4 w-4 text-dim" />
                </a>
                <button
                  onClick={() => onDelete(receipt.id)}
                  className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete receipt"
                >
                  <X className="h-4 w-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <strong>Note:</strong> Receipts are stored locally in this demo. In production, they would be uploaded to cloud storage.
      </div>
    </div>
  )
}
