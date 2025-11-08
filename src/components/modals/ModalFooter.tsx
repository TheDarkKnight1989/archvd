'use client'

import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface ModalFooterProps {
  onCancel: () => void
  onSave: () => void
  onSaveAndAddAnother?: () => void
  isSubmitting?: boolean
  saveLabel?: string
  cancelLabel?: string
  saveAndAddAnotherLabel?: string
}

export function ModalFooter({
  onCancel,
  onSave,
  onSaveAndAddAnother,
  isSubmitting = false,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  saveAndAddAnotherLabel = "Save & Add Another"
}: ModalFooterProps) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-6 border-t border-[#15251B]/40">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
        className="border-[#15251B] text-[#E8F6EE] hover:bg-[#08100C]"
      >
        {cancelLabel}
      </Button>

      <div className="flex flex-col-reverse sm:flex-row gap-2">
        {onSaveAndAddAnother && (
          <Button
            type="button"
            variant="outline"
            onClick={onSaveAndAddAnother}
            disabled={isSubmitting}
            className="border-[#0F8D65]/50 text-[#00FF94] hover:bg-[#00FF94]/10 hover:border-[#0F8D65]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              saveAndAddAnotherLabel
            )}
          </Button>
        )}

        <Button
          type="button"
          onClick={onSave}
          disabled={isSubmitting}
          className="bg-[#00FF94] text-[#000000] hover:bg-[#18D38B] glow-accent-hover"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            saveLabel
          )}
        </Button>
      </div>
    </div>
  )
}
