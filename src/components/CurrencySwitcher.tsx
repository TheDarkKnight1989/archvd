'use client'

import { useState } from 'react'
import { useCurrency, type Currency } from '@/hooks/useCurrency'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'GBP', label: 'GBP', symbol: '£' },
  { value: 'EUR', label: 'EUR', symbol: '€' },
  { value: 'USD', label: 'USD', symbol: '$' },
]

export interface CurrencySwitcherProps {
  className?: string
}

/**
 * Currency Switcher Component
 *
 * Allows users to switch between GBP, EUR, and USD.
 * Persists preference to user profile and updates all prices across the app.
 */
export function CurrencySwitcher({ className }: CurrencySwitcherProps) {
  const { currency, setCurrency, loading } = useCurrency()
  const [updating, setUpdating] = useState(false)

  const handleCurrencyChange = async (newCurrency: string) => {
    if (newCurrency === currency) return

    setUpdating(true)
    try {
      await setCurrency(newCurrency as Currency)
      toast.success(`Currency changed to ${newCurrency}`)
      // Reload page to refresh all prices
      window.location.reload()
    } catch (error) {
      console.error('[CurrencySwitcher] Failed to update currency:', error)
      toast.error('Failed to update currency preference')
    } finally {
      setUpdating(false)
    }
  }

  const currentCurrency = CURRENCIES.find((c) => c.value === currency)

  return (
    <Select
      value={currency}
      onValueChange={handleCurrencyChange}
      disabled={loading || updating}
    >
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
      <SelectContent>
        {CURRENCIES.map((curr) => (
          <SelectItem
            key={curr.value}
            value={curr.value}
          >
            <span className="flex items-center gap-2">
              <span className="font-mono w-5">{curr.symbol}</span>
              <span>{curr.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
