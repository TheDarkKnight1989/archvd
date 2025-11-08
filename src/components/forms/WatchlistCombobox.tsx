'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

interface WatchlistOption {
  value: string
  label: string
}

interface WatchlistComboboxProps {
  value?: string
  onChange: (value: string) => void
  options: WatchlistOption[]
  onCreateNew?: (name: string) => void
  placeholder?: string
}

export function WatchlistCombobox({
  value,
  onChange,
  options,
  onCreateNew,
  placeholder = "Select watchlist..."
}: WatchlistComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const selectedOption = options.find((option) => option.value === value)

  const filteredOptions = useMemo(() => {
    if (!searchValue) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  const showCreateNew = searchValue && !filteredOptions.length && onCreateNew

  const handleCreateNew = () => {
    if (onCreateNew && searchValue) {
      onCreateNew(searchValue)
      setSearchValue('')
      setOpen(false)
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-[#B7D0C2] mb-3">
        Watchlist <span className="text-[#7FA08F]">(optional)</span>
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full h-12 justify-between bg-[#08100C] border-[#15251B] text-[#E8F6EE] hover:bg-[#0B1510] hover:border-[#0F8D65]/50",
              "transition-all duration-[120ms] text-base",
              open && "border-[#0F8D65]/50 glow-accent-hover"
            )}
          >
            <span className={cn(!selectedOption && "text-[#7FA08F]")}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-[#7FA08F]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-[#0E1A15] border-[#15251B]" align="start">
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Search watchlists..."
              value={searchValue}
              onValueChange={setSearchValue}
              className="border-none focus:ring-0 bg-transparent text-[#E8F6EE] placeholder:text-[#7FA08F]"
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-6 text-center text-sm text-[#7FA08F]">
                  No watchlist found
                </div>
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      const val = typeof currentValue === 'string' ? currentValue : option.value
                      onChange(val === value ? '' : val)
                      setOpen(false)
                      setSearchValue('')
                    }}
                    className={cn(
                      "cursor-pointer text-[#E8F6EE] hover:bg-[#08100C]",
                      value === option.value && "bg-[#08100C]"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 text-[#00FF94]",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              {showCreateNew && (
                <CommandGroup>
                  <CommandItem
                    onSelect={handleCreateNew}
                    className="cursor-pointer text-[#00FF94] hover:bg-[#08100C] border-t border-[#15251B]/40"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create &quot;{searchValue}&quot;
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
