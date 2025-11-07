'use client'

import { ReactNode } from 'react'
import { Sidebar } from './components/Sidebar'
import { MobileDock } from './components/MobileDock'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-bg" data-theme="matrix">
      <Sidebar />

      <main className="md:pl-16 pb-16 md:pb-0" id="main">
        {children}
      </main>

      {/* Mobile Navigation - no onQuickAdd since that's specific to dashboard page */}
      <MobileDock />
    </div>
  )
}
