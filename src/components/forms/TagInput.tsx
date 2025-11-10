'use client'

import { useState, KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
}

export function TagInput({ value = [], onChange, placeholder = "Type and press Enter", maxTags }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      const newTag = inputValue.trim()
      if (!value.includes(newTag) && (!maxTags || value.length < maxTags)) {
        onChange([...value, newTag])
        setInputValue('')
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-[#B7D0C2] mb-3">
        Tags {maxTags && <span className="text-[#7FA08F]">({value.length}/{maxTags})</span>}
      </label>
      <div className={cn(
        "min-h-[48px] p-3 rounded-lg border bg-[#08100C] border-[#15251B]",
        "focus-within:border-[#0F8D65]/50 focus-within:shadow-soft",
        "transition-boutique"
      )}>
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B1510] border border-[#15251B] rounded-md text-sm text-[#E8F6EE]"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-[#7FA08F] hover:text-[#E8F6EE] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={maxTags ? value.length >= maxTags : false}
            className={cn(
              "flex-1 min-w-[140px] bg-transparent outline-none text-base text-[#E8F6EE]",
              "placeholder:text-[#7FA08F]"
            )}
          />
        </div>
      </div>
      <p className="text-xs text-[#7FA08F] mt-1.5">Press Enter to add a tag</p>
    </div>
  )
}
