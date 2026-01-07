'use client'

import * as React from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * TableBase Component
 *
 * Unified table system matching P&L dark mode styling.
 *
 * Design Tokens:
 * - --table-bg: #0E0E0E
 * - --table-row-hover: #141414
 * - --table-border: #1E1E1E
 * - --table-text: #F5F5F5
 * - --table-muted: #A3A3A3
 *
 * Typography:
 * - Headers: .label-up (12px uppercase, tracking 0.05em, #A3A3A3)
 * - Rows: .row-text (14px, #F5F5F5)
 * - Currency: .mono (right-aligned)
 * - Min row height: h-12
 */

interface TableBaseProps {
  children: React.ReactNode
  className?: string
}

interface TableHeaderProps {
  children: React.ReactNode
  className?: string
}

interface TableBodyProps {
  children: React.ReactNode
  className?: string
}

interface TableRowProps {
  children: React.ReactNode
  index?: number
  className?: string
  onClick?: () => void
}

interface TableHeadProps {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
  colSpan?: number
  onClick?: () => void
  style?: React.CSSProperties
}

interface TableCellProps {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
  colSpan?: number
  mono?: boolean
  style?: React.CSSProperties
}

interface TableWrapperProps {
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
}

/**
 * TableWrapper - Container for the entire table with optional header
 */
export function TableWrapper({ children, className, title, description }: TableWrapperProps) {
  return (
    <div className={cn('rounded-2xl border border-border bg-elev-1 overflow-hidden shadow-soft', className)}>
      {(title || description) && (
        <div className="px-4 py-3 border-b border-border">
          {title && <h2 className="font-display text-lg font-semibold text-fg tracking-tight">{title}</h2>}
          {description && <p className="text-xs text-dim mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * TableBase - Main table element with scrollbar at top
 */
export function TableBase({ children, className }: TableBaseProps) {
  const topScrollRef = React.useRef<HTMLDivElement>(null)
  const bottomScrollRef = React.useRef<HTMLDivElement>(null)
  const tableRef = React.useRef<HTMLTableElement>(null)
  const [tableWidth, setTableWidth] = React.useState(0)

  // Measure table width and update top scrollbar
  React.useEffect(() => {
    const updateWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.scrollWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)

    // Also update on table content changes
    const observer = new MutationObserver(updateWidth)
    if (tableRef.current) {
      observer.observe(tableRef.current, {
        childList: true,
        subtree: true,
        attributes: true
      })
    }

    return () => {
      window.removeEventListener('resize', updateWidth)
      observer.disconnect()
    }
  }, [children])

  // Synchronize scroll positions
  React.useEffect(() => {
    const topScroll = topScrollRef.current
    const bottomScroll = bottomScrollRef.current

    if (!topScroll || !bottomScroll) return

    const handleTopScroll = () => {
      if (bottomScroll) {
        bottomScroll.scrollLeft = topScroll.scrollLeft
      }
    }

    const handleBottomScroll = () => {
      if (topScroll) {
        topScroll.scrollLeft = bottomScroll.scrollLeft
      }
    }

    topScroll.addEventListener('scroll', handleTopScroll)
    bottomScroll.addEventListener('scroll', handleBottomScroll)

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll)
      bottomScroll.removeEventListener('scroll', handleBottomScroll)
    }
  }, [])

  return (
    <div>
      {/* Top scrollbar */}
      <div
        ref={topScrollRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: '17px' }}
      >
        <div style={{ width: `${tableWidth}px`, height: '1px' }} />
      </div>

      {/* Actual table */}
      <div ref={bottomScrollRef} className="overflow-x-auto">
        <table ref={tableRef} className={cn('w-full', className)}>
          {children}
        </table>
      </div>
    </div>
  )
}

/**
 * TableHeader - Sticky header with consistent styling
 */
export function TableHeader({ children, className }: TableHeaderProps) {
  return (
    <thead className={cn('sticky top-0 bg-panel border-b border-keyline z-10 shadow-sm', className)}>
      {children}
    </thead>
  )
}

/**
 * TableBody - Body with divider between rows
 */
export function TableBody({ children, className }: TableBodyProps) {
  return (
    <tbody className={cn('divide-y divide-border/48', className)}>
      {children}
    </tbody>
  )
}

/**
 * TableRow - Row with zebra striping and hover effect
 */
export function TableRow({ children, index, className, onClick }: TableRowProps) {
  const zebraClass = typeof index === 'number'
    ? index % 2 === 0 ? 'bg-table-zebra' : 'bg-panel'
    : ''

  return (
    <tr
      className={cn(
        'min-h-12 hover:bg-table-hover transition-boutique',
        zebraClass,
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

/**
 * TableHead - Header cell with .label-up styling
 */
export function TableHead({ children, className, align = 'left', colSpan, onClick, style }: TableHeadProps) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <th
      className={cn('px-4 py-2.5 label-up', alignClass, className)}
      colSpan={colSpan}
      onClick={onClick}
      style={style}
    >
      {children}
    </th>
  )
}

/**
 * TableCell - Body cell with consistent padding and typography
 */
export function TableCell({ children, className, align = 'left', colSpan, mono = false, style }: TableCellProps) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''
  const monoClass = mono ? 'mono' : ''

  return (
    <td
      className={cn('px-4 py-3', alignClass, monoClass, className)}
      colSpan={colSpan}
      style={style}
    >
      {children}
    </td>
  )
}

// Export individual components
export {
  type TableBaseProps,
  type TableHeaderProps,
  type TableBodyProps,
  type TableRowProps,
  type TableHeadProps,
  type TableCellProps,
  type TableWrapperProps,
}
