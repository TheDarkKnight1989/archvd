/**
 * ProductLineItem Component Tests
 * Tests for the unified product display component
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductLineItem } from '@/components/product/ProductLineItem'

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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

describe('ProductLineItem', () => {
  const defaultProps = {
    imageUrl: 'https://example.com/image.jpg',
    imageAlt: 'Test Product',
    brand: 'Nike',
    model: 'Air Jordan 1',
    variant: 'Chicago',
    sku: 'AJ1-CHI-001',
    href: '/product/AJ1-CHI-001',
    sizeUk: '9',
    sizeSystem: 'UK' as const,
    category: 'sneakers' as const,
  }

  it('should render product image', () => {
    render(<ProductLineItem {...defaultProps} />)
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', defaultProps.imageUrl)
    expect(image).toHaveAttribute('alt', defaultProps.imageAlt)
  })

  it('should render fallback when no image provided', () => {
    render(<ProductLineItem {...defaultProps} imageUrl={null} />)
    const fallback = screen.getByText('NI') // First 2 letters of Nike
    expect(fallback).toBeInTheDocument()
  })

  it('should render brand and model', () => {
    render(<ProductLineItem {...defaultProps} />)
    expect(screen.getByText(/Nike Air Jordan 1/)).toBeInTheDocument()
  })

  it('should render variant/colorway', () => {
    render(<ProductLineItem {...defaultProps} />)
    expect(screen.getByText('Chicago')).toBeInTheDocument()
  })

  it('should render SKU chip', () => {
    render(<ProductLineItem {...defaultProps} />)
    expect(screen.getByText('AJ1-CHI-001')).toBeInTheDocument()
  })

  it('should render size chip for sneakers', () => {
    render(<ProductLineItem {...defaultProps} />)
    expect(screen.getByText(/Size:/)).toBeInTheDocument()
    expect(screen.getByText(/UK 9/)).toBeInTheDocument()
  })

  it('should not render size chip for Pokemon category', () => {
    render(<ProductLineItem {...defaultProps} category="pokemon" />)
    expect(screen.queryByText(/Size:/)).not.toBeInTheDocument()
  })

  it('should render language tag for Pokemon', () => {
    render(
      <ProductLineItem
        {...defaultProps}
        category="pokemon"
        languageTag="EN"
        sizeUk={null}
      />
    )
    expect(screen.getByText('EN')).toBeInTheDocument()
  })

  it('should convert US size to UK', () => {
    render(
      <ProductLineItem
        {...defaultProps}
        sizeUk="9"
        sizeSystem="US"
        sizeGender="M"
      />
    )
    // US Men's = UK + 1, so UK 9 = US 10
    expect(screen.getByText(/US 10/)).toBeInTheDocument()
  })

  it('should render external link icon', () => {
    render(<ProductLineItem {...defaultProps} />)
    const link = screen.getByLabelText(/View Nike Air Jordan 1 details/)
    expect(link).toHaveAttribute('href', '/product/AJ1-CHI-001')
  })

  it('should call onOpen when clicked', () => {
    const onOpen = vi.fn()
    render(<ProductLineItem {...defaultProps} onOpen={onOpen} />)

    const link = screen.getByLabelText(/View Nike Air Jordan 1 details/)
    link.click()

    expect(onOpen).toHaveBeenCalled()
  })

  it('should apply compact class when compact prop is true', () => {
    const { container } = render(<ProductLineItem {...defaultProps} compact />)
    const imageWrapper = container.querySelector('.h-10.w-10')
    expect(imageWrapper).toBeInTheDocument()
  })

  it('should handle missing variant gracefully', () => {
    render(<ProductLineItem {...defaultProps} variant={undefined} />)
    expect(screen.queryByText('Chicago')).not.toBeInTheDocument()
    expect(screen.getByText(/Nike Air Jordan 1/)).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <ProductLineItem {...defaultProps} className="custom-class" />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('custom-class')
  })
})

describe('ProductLineItem.Skeleton', () => {
  it('should render loading skeleton', () => {
    const { container } = render(<ProductLineItem.Skeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should render compact skeleton', () => {
    const { container } = render(<ProductLineItem.Skeleton compact />)
    const imageWrapper = container.querySelector('.h-10.w-10')
    expect(imageWrapper).toBeInTheDocument()
  })
})

describe('ProductLineItem.Compact', () => {
  it('should render compact variant', () => {
    const { container } = render(<ProductLineItem.Compact {...defaultProps} />)
    const imageWrapper = container.querySelector('.h-10.w-10')
    expect(imageWrapper).toBeInTheDocument()
  })
})
