'use client'

import { ReactNode } from 'react'
import { Sidebar } from './components/Sidebar'
import { MobileDock } from './components/MobileDock'
import { SidebarStateProvider } from '@/contexts/SidebarContext'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarStateProvider>
      <div className="min-h-screen bg-bg" data-theme="matrix">
        <Sidebar />

        {/* Main content with dynamic padding based on sidebar state */}
        <main
          className="md:pl-16 pb-16 md:pb-0 transition-[padding-left] duration-120 ease-terminal"
          style={{
            paddingLeft: 'var(--sidebar-width, 4rem)', // 64px collapsed
          }}
          id="main"
        >
          {children}
        </main>

        {/* Mobile Navigation */}
        <MobileDock />

        {/* CSS variable update based on data-sidebar attribute */}
        <style jsx global>{`
          body[data-sidebar='pinned'] {
            --sidebar-width: 21.5rem; /* 344px (64 + 280) */
          }
          @media (max-width: 768px) {
            body {
              --sidebar-width: 0;
            }
          }
        `}</style>
      </div>
    </SidebarStateProvider>
  )
}
