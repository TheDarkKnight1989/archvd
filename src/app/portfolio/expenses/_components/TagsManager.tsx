/**
 * Tags Manager Component
 * Add and manage custom tags for expenses
 */

'use client'

import { useState, useEffect } from 'react'
import { Tag, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

interface TagsManagerProps {
  expenseId?: string
  selectedTags?: string[]
  onTagsChange: (tags: string[]) => void
  className?: string
}

const TAG_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#8B5CF6', // violet
]

export function TagsManager({ expenseId, selectedTags = [], onTagsChange, className }: TagsManagerProps) {
  // Load all tags from localStorage
  const [allTags, setAllTags] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('expense_tags')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return []
        }
      }
    }
    return ['urgent', 'recurring', 'tax-deductible', 'business', 'personal']
  })

  const [isCreating, setIsCreating] = useState(false)
  const [newTag, setNewTag] = useState('')

  // Save tags to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('expense_tags', JSON.stringify(allTags))
    }
  }, [allTags])

  const handleCreateTag = () => {
    const trimmed = newTag.trim().toLowerCase()
    if (!trimmed || allTags.includes(trimmed)) return

    setAllTags([...allTags, trimmed])
    setNewTag('')
    setIsCreating(false)
  }

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  const handleRemoveTag = (tag: string) => {
    if (!window.confirm(`Delete tag "${tag}"? This will remove it from all expenses.`)) return
    setAllTags(allTags.filter((t) => t !== tag))
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag))
    }
  }

  const getTagColor = (tag: string): string => {
    const index = allTags.indexOf(tag) % TAG_COLORS.length
    return TAG_COLORS[index]
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <div
              key={tag}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${getTagColor(tag)}20`,
                color: getTagColor(tag),
                border: `1px solid ${getTagColor(tag)}40`,
              }}
            >
              <Tag className="h-3 w-3" />
              {tag}
              <button
                onClick={() => handleToggleTag(tag)}
                className="ml-1 hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Available Tags */}
      <div>
        <div className="text-xs text-dim uppercase tracking-wide mb-2">Available Tags</div>
        <div className="flex flex-wrap gap-2">
          {allTags
            .filter((tag) => !selectedTags.includes(tag))
            .map((tag) => (
              <button
                key={tag}
                onClick={() => handleToggleTag(tag)}
                className="group relative flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: `${getTagColor(tag)}15`,
                  color: getTagColor(tag),
                  border: `1px solid ${getTagColor(tag)}30`,
                }}
              >
                <Tag className="h-3 w-3" />
                {tag}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveTag(tag)
                  }}
                  className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-400"
                  title="Delete tag"
                >
                  <X className="h-3 w-3" />
                </button>
              </button>
            ))}

          {/* Create New Tag Button */}
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-dashed border-border text-dim hover:border-accent hover:text-accent transition-colors"
            >
              <Plus className="h-3 w-3" />
              New Tag
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTag()
                  if (e.key === 'Escape') setIsCreating(false)
                }}
                placeholder="Tag name..."
                className="h-7 w-32 text-xs bg-elev-0 border-border"
                autoFocus
              />
              <Button
                onClick={handleCreateTag}
                size="sm"
                className="h-7 px-2 bg-accent/20 text-fg hover:bg-accent/30"
              >
                Add
              </Button>
              <button
                onClick={() => setIsCreating(false)}
                className="p-1 hover:bg-elev-2 rounded"
              >
                <X className="h-3.5 w-3.5 text-dim" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
