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
      <label className="block text-sm font-medium text-[#B7D0C2] mb-3">
        Size {category === 'shoes' && '(UK)'}
      </label>
      <div className={cn(
        "grid gap-3",
        category === 'shoes' ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10" : "grid-cols-3 sm:grid-cols-5 md:grid-cols-7"
      )}>
        {sizes.map((size) => {
          const isSelected = value === size
          return (
            <button
              key={size}
              type="button"
              onClick={() => onChange(size)}
              className={cn(
                "h-12 rounded-lg border text-base font-medium transition-all duration-[120ms]",
                "hover:border-[#0F8D65]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F8D65]/25",
                isSelected
                  ? "bg-[#00FF94] text-[#000000] border-[#00FF94] glow-accent-hover shadow-sm"
                  : "bg-[#08100C] text-[#B7D0C2] border-[#15251B] hover:bg-[#0B1510] hover:text-[#E8F6EE]"
              )}
            >
              {size}
            </button>
          )
        })}
      </div>
    </div>
  )
}
