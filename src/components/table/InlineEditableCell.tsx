/**
 * Inline Editable Cell Component
 * Allows editing values directly in table cells
 */

'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Check, X, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface InlineEditableCellProps {
  value: string | number | null
  onSave: (value: string) => Promise<void> | void
  type?: 'text' | 'number' | 'textarea'
  format?: (value: string | number | null) => string
  placeholder?: string
  className?: string
  editClassName?: string
  align?: 'left' | 'right' | 'center'
}

export function InlineEditableCell({
  value,
  onSave,
  type = 'text',
  format,
  placeholder = 'Click to edit',
  className,
  editClassName,
  align = 'left',
}: InlineEditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(value ?? ''))
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const displayValue = format ? format(value) : value

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    setEditValue(String(value ?? ''))
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(String(value ?? ''))
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (editValue === String(value ?? '')) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(editValue)
      setIsEditing(false)
    } catch (error) {
      console.error('[Inline Edit] Save failed:', error)
      // Keep editing mode open on error
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const alignClass = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
  }[align]

  if (isEditing) {
    const InputComponent = type === 'textarea' ? 'textarea' : 'input'

    return (
      <div className="flex items-center gap-1.5">
        <InputComponent
          ref={inputRef as any}
          type={type === 'number' ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleCancel}
          disabled={isSaving}
          placeholder={placeholder}
          className={cn(
            'flex-1 px-2 py-1 text-sm bg-elev-2 border border-[#00FF94]/50 rounded',
            'focus:outline-none focus:ring-2 focus:ring-[#00FF94]/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            type === 'textarea' && 'min-h-[60px] resize-y',
            alignClass,
            editClassName
          )}
          rows={type === 'textarea' ? 3 : undefined}
        />
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleSave()
          }}
          disabled={isSaving}
          className="p-1 hover:bg-elev-2 rounded text-[#00FF94] disabled:opacity-50"
          title="Save (Enter)"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleCancel()
          }}
          disabled={isSaving}
          className="p-1 hover:bg-elev-2 rounded text-red-400 disabled:opacity-50"
          title="Cancel (Esc)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleStartEdit}
      className={cn(
        'group flex items-center gap-1.5 w-full transition-all hover:bg-elev-1 rounded px-1 py-0.5',
        alignClass,
        className
      )}
      title="Click to edit"
    >
      <span className="flex-1">
        {displayValue || <span className="text-dim italic">{placeholder}</span>}
      </span>
      <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
  )
}
