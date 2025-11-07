import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { X } from 'lucide-react'

export type ToastVariant = 'default' | 'success' | 'error' | 'warning'

interface ToastProps {
  message: string
  variant?: ToastVariant
  duration?: number
  onClose: () => void
}

const variantStyles: Record<ToastVariant, string> = {
  default: 'bg-surface border-border text-fg',
  success: 'bg-success/10 border-success/30 text-success',
  error: 'bg-danger/10 border-danger/30 text-danger',
  warning: 'bg-warning/10 border-warning/30 text-warning',
}

export function Toast({ message, variant = 'default', duration = 5000, onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-glow max-w-md',
        'animate-in slide-in-from-bottom-2 fade-in',
        variantStyles[variant]
      )}
    >
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        className="text-muted hover:text-fg transition-colors"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// Toast Container for managing multiple toasts
export function ToastContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 right-0 p-4 z-50 flex flex-col gap-2 pointer-events-none">
      {children}
    </div>
  )
}
