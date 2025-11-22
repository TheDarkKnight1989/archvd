// @ts-nocheck
/**
 * ProvenanceBadge Component Tests
 * Tests for market price attribution component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProvenanceBadge } from '@/components/product/ProvenanceBadge'

// Mock the provenance utility functions
vi.mock('@/lib/utils/provenance', () => ({
  getProviderDisplayName: (provider: string) => {
    const names: Record<string, string> = {
      stockx: 'StockX',
      alias: 'Alias',
      ebay: 'eBay',
      seed: 'Seeded',
    }
    return names[provider] || provider
  },
  formatRelativeTime: (timestamp: string) => {
    // Mock relative time formatting
    const now = new Date('2025-01-10T14:00:00Z').getTime()
    const then = new Date(timestamp).getTime()
    const diffHours = Math.floor((now - then) / (1000 * 60 * 60))

    if (diffHours < 1) return 'just now'
    if (diffHours === 1) return '1h ago'
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  },
  formatExactTime: (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  },
}))

// Mock Radix UI Tooltip
vi.mock('@radix-ui/react-tooltip', () => ({
  Provider: ({ children }: any) => children,
  Root: ({ children }: any) => children,
  Trigger: ({ children, asChild }: any) => children,
  Portal: ({ children }: any) => children,
  Content: ({ children }: any) => <div role="tooltip">{children}</div>,
  Arrow: () => null,
}))

// Mock the current time for consistent testing
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-01-10T14:00:00Z'))
})

describe('ProvenanceBadge', () => {
  it('should render StockX badge', () => {
    render(
      <ProvenanceBadge
        provider="stockx"
        timestamp="2025-01-10T12:00:00Z"
      />
    )

    expect(screen.getByText('Sx')).toBeInTheDocument()
    expect(screen.getByText(/stockx/i)).toBeInTheDocument()
  })

  it('should render Alias badge', () => {
    render(
      <ProvenanceBadge
        provider="alias"
        timestamp="2025-01-10T12:00:00Z"
      />
    )

    expect(screen.getByText(/alias/i)).toBeInTheDocument()
  })

  it('should render eBay badge', () => {
    render(
      <ProvenanceBadge
        provider="ebay"
        timestamp="2025-01-10T12:00:00Z"
      />
    )

    expect(screen.getByText(/ebay/i)).toBeInTheDocument()
  })

  it('should render seed badge', () => {
    render(
      <ProvenanceBadge
        provider="seed"
        timestamp="2025-01-10T12:00:00Z"
      />
    )

    expect(screen.getByText(/seeded/i)).toBeInTheDocument()
  })

  it('should display relative time', () => {
    render(
      <ProvenanceBadge
        provider="stockx"
        timestamp="2025-01-10T12:00:00Z"
      />
    )

    expect(screen.getByText('2h ago')).toBeInTheDocument()
  })

  it('should display exact time in tooltip', () => {
    render(
      <ProvenanceBadge
        provider="stockx"
        timestamp="2025-01-10T12:00:00Z"
      />
    )

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
  })
})

describe('ProvenanceBadge compact variant', () => {
  it('should render compact StockX badge', () => {
    render(
      <ProvenanceBadge
        provider="stockx"
        timestamp="2025-01-10T12:00:00Z"
        variant="compact"
      />
    )

    expect(screen.getByText('Sx')).toBeInTheDocument()
    expect(screen.getByText('2h ago')).toBeInTheDocument()
  })

  it('should not show StockX icon for other providers in compact mode', () => {
    render(
      <ProvenanceBadge
        provider="alias"
        timestamp="2025-01-10T12:00:00Z"
        variant="compact"
      />
    )

    expect(screen.queryByText('Sx')).not.toBeInTheDocument()
    expect(screen.getByText('2h ago')).toBeInTheDocument()
  })

  it('should apply different styles based on provider', () => {
    const { rerender, container } = render(
      <ProvenanceBadge
        provider="stockx"
        timestamp="2025-01-10T12:00:00Z"
        variant="compact"
      />
    )

    const stockxBadge = container.firstChild as HTMLElement
    expect(stockxBadge.className).toContain('text-profit')

    rerender(
      <ProvenanceBadge
        provider="alias"
        timestamp="2025-01-10T12:00:00Z"
        variant="compact"
      />
    )

    const aliasBadge = container.firstChild as HTMLElement
    expect(aliasBadge.className).toContain('text-accent')
  })
})

describe('ProvenanceBadge.Skeleton', () => {
  it('should render loading skeleton', () => {
    const { container } = render(<ProvenanceBadge.Skeleton />)
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
  })
})

describe('ProvenanceBadge time formatting', () => {
  it('should format "just now" correctly', () => {
    render(
      <ProvenanceBadge
        provider="stockx"
        timestamp="2025-01-10T13:45:00Z"
      />
    )

    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  it('should format hours correctly', () => {
    render(
      <ProvenanceBadge
        provider="stockx"
        timestamp="2025-01-10T11:00:00Z"
      />
    )

    expect(screen.getByText('3h ago')).toBeInTheDocument()
  })

  it('should format days correctly', () => {
    render(
      <ProvenanceBadge
        provider="stockx"
        timestamp="2025-01-08T14:00:00Z"
      />
    )

    expect(screen.getByText('2d ago')).toBeInTheDocument()
  })
})

describe('ProvenanceBadge accessibility', () => {
  it('should have proper tooltip role', () => {
    render(
      <ProvenanceBadge
        provider="stockx"
        timestamp="2025-01-10T12:00:00Z"
      />
    )

    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })
})
