'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Boxes, TrendingUp, Settings, User, FileText, LineChart, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const navItems = [
  { icon: LayoutDashboard, href: '/dashboard', label: 'Dashboard' },
  { icon: Boxes, href: '/dashboard/inventory', label: 'Inventory' },
  { icon: LineChart, href: '/dashboard/market', label: 'Market' },
  { icon: Calendar, href: '/dashboard/releases', label: 'Releases' },
  { icon: FileText, href: '/dashboard/pnl', label: 'P&L' },
  { icon: TrendingUp, href: '/dashboard/expenses', label: 'Expenses' },
]

const bottomItems = [
  { icon: Settings, href: '/settings', label: 'Settings' },
  { icon: User, href: '/profile', label: 'Profile' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-y-0 left-0 w-16 border-r border-border bg-bg flex-col justify-between max-md:hidden flex">
      <ul className="pt-4 grid gap-1">
        {navItems.map(({ icon: Icon, href, label }) => {
          const isActive = pathname?.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "mx-2 h-10 w-10 grid place-items-center rounded-xl hover:text-fg hover:bg-surface transition-[color,background-color] duration-fast ease-terminal relative",
                  isActive ? "text-accent bg-surface2 shadow-glow" : "text-muted"
                )}
                title={label}
              >
                {isActive && (
                  <span className="absolute left-0 w-0.5 h-6 bg-accent rounded-r" />
                )}
                <Icon className="h-5 w-5" />
                <span className="sr-only">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <ul className="pb-4 grid gap-1">
        {bottomItems.map(({ icon: Icon, href, label }) => {
          const isActive = pathname?.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "mx-2 h-10 w-10 grid place-items-center rounded-xl hover:text-fg hover:bg-surface transition-[color,background-color] duration-fast ease-terminal relative",
                  isActive ? "text-accent bg-surface2" : "text-muted"
                )}
                title={label}
              >
                {isActive && (
                  <span className="absolute left-0 w-0.5 h-6 bg-accent rounded-r" />
                )}
                <Icon className="h-5 w-5" />
                <span className="sr-only">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
