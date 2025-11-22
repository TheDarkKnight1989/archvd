'use client'

/**
 * ConditionNotesPanel - Edit condition and notes
 *
 * IMPORTANT: DO NOT MODIFY CONDITION LOGIC
 * - Condition is already implemented end-to-end
 * - Uses existing enums: 'new' | 'used' | 'worn' | 'defect' (form)
 * - DB stores: 'New' | 'Used' | 'Worn' | 'Defect'
 * - This panel provides a read-only view (edit functionality can be added later)
 */

import { useState } from 'react'
import { FileText, Edit2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils/cn'

interface ConditionNotesPanelProps {
  item: any
}

export function ConditionNotesPanel({ item }: ConditionNotesPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState(item.notes || '')

  const condition = item.condition || 'New'
  const conditionColors = {
    New: 'bg-green-500/10 text-green-500 border-green-500/30',
    Used: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    Worn: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    Defect: 'bg-red-500/10 text-red-500 border-red-500/30',
  }

  const handleSave = async () => {
    // TODO: Implement API call to update notes
    console.log('Saving notes:', notes)
    setIsEditing(false)
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold mb-4">Condition & Notes</h3>

      <div className="space-y-4">
        {/* Condition (Read-Only) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">Condition</span>
            <Badge
              variant="outline"
              className={cn('text-sm', conditionColors[condition as keyof typeof conditionColors] || '')}
            >
              {condition}
            </Badge>
          </div>
          <p className="text-xs text-muted">
            Condition is set during item creation and can be updated via Edit Details
          </p>
        </div>

        {/* Notes */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-muted flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </label>
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-2"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this item..."
                className="min-h-[100px] resize-none"
                maxLength={250}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  {notes.length}/250 characters
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNotes(item.notes || '')
                      setIsEditing(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSave}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-soft/50 rounded text-sm text-fg min-h-[60px]">
              {notes || <span className="text-muted italic">No notes added</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
