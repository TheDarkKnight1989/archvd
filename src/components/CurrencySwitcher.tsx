'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'

export type Currency = 'GBP' | 'EUR' | 'USD'

export interface CurrencySwitcherProps {
  value: Currency
  onChange: (currency: Currency) => void
  className?: string
}

const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'GBP', label: 'GBP', symbol: '£' },
  { value: 'EUR', label: 'EUR', symbol: '€' },
  { value: 'USD', label: 'USD', symbol: '$' },
]

export function CurrencySwitcher({
  value,
  onChange,
  className,
}: CurrencySwitcherProps) {
  const currentCurrency = CURRENCIES.find((c) => c.value === value)

  return (
    <Select value={value} onValueChange={(v) => onChange(v as Currency)}>
      <SelectTrigger
        className={cn(
          'w-[100px] bg-elev-1 border-border hover:border-accent/60 transition-all duration-120 glow-accent-hover focus:ring-accent/40',
          className
        )}
        aria-label="Select currency"
      >
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-sm">{currentCurrency?.symbol}</span>
            <span className="text-sm">{currentCurrency?.label}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-elev-2 border-border">
        {CURRENCIES.map((currency) => (
          <SelectItem
            key={currency.value}
            value={currency.value}
            className="cursor-pointer hover:bg-elev-3 focus:bg-elev-3 transition-colors duration-120"
          >
            <span className="flex items-center gap-2">
              <span className="font-mono w-5">{currency.symbol}</span>
              <span>{currency.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
