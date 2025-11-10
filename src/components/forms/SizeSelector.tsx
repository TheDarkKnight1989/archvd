'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface SizeSelectorProps {
  value?: string
  onChange: (size: string) => void
  category?: 'shoes' | 'clothes' | 'other'
}

const SHOE_SIZES = [
  '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5',
  '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5',
  '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5',
  '15', '15.5', '16'
]

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

export function SizeSelector({ value, onChange, category = 'shoes' }: SizeSelectorProps) {
  const sizes = category === 'shoes' ? SHOE_SIZES : CLOTHING_SIZES

  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
        Size {category === 'shoes' && '(UK)'}
      </label>
      {/* Scrollable panel with Matrix V2 styling */}
      <div className="max-h-[144px] overflow-y-auto bg-elev-1 border border-border/40 rounded-lg p-2">
        <div className="grid grid-cols-7 gap-1.5">
          {sizes.map((size) => {
            const isSelected = value === size
            return (
              <button
                key={size}
                type="button"
                onClick={() => onChange(size)}
                className={cn(
                  "h-8 min-w-[42px] rounded-md border text-sm font-medium transition-boutique",
                  "flex items-center justify-center",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
                  isSelected
                    ? "bg-elev-2 border-accent ring-1 ring-accent/40 text-fg"
                    : "border-border/40 text-muted hover:bg-elev-2 hover:text-fg shadow-soft"
                )}
              >
                {size}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
