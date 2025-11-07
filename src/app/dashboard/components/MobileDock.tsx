'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Boxes, BarChart3, User, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const navItems = [
  { icon: LayoutDashboard, href: '/dashboard', label: 'Dashboard' },
  { icon: Boxes, href: '/dashboard/inventory', label: 'Inventory' },
  { icon: BarChart3, href: '/dashboard/expenses', label: 'Analytics' },
  { icon: User, href: '/profile', label: 'Profile' },
]

interface MobileDockProps {
  onQuickAdd?: () => void
}

export function MobileDock({ onQuickAdd }: MobileDockProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-bg/90 backdrop-blur border-t border-border md:hidden" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="relative">
          <ul className="grid grid-cols-4 px-2">
            {navItems.map(({ icon: Icon, href, label }) => {
              const isActive = pathname === href
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex flex-col items-center justify-center h-14 text-muted hover:text-fg transition-colors duration-fast",
                      isActive && "text-fg"
                    )}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-medium">{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* Quick Add FAB */}
      <button
        onClick={onQuickAdd}
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-accent text-black shadow-glow flex items-center justify-center hover:bg-accent-600 transition-colors duration-fast md:hidden active:scale-95"
        style={{ bottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 5rem))' }}
        aria-label="Quick Add"
      >
        <Plus className="h-6 w-6" />
      </button>
    </>
  )
}
