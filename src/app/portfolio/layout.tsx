'use client'

import { ReactNode, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { MobileDock } from './components/MobileDock'
import { SidebarStateProvider } from '@/contexts/SidebarContext'
import { AppTopBar } from '@/components/AppTopBar'

interface PortfolioLayoutProps {
  children: ReactNode
}

export default function PortfolioLayout({ children }: PortfolioLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <SidebarStateProvider>
      <div className="min-h-screen bg-bg" data-theme="matrix">
        <Sidebar />

        {/* Main content with dynamic padding based on sidebar pinned state */}
        <main
          className="pl-16 md:pl-16 transition-[padding-left] duration-120 ease-terminal"
          id="main"
        >
          {/* App Top Bar - visible on all pages */}
          <AppTopBar onMenuClick={() => setDrawerOpen(true)} />

          <div className="pt-6 pb-20 sm:pb-0">
            {children}
          </div>
        </main>

        {/* Mobile Navigation */}
        <MobileDock drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />

        {/* CSS for pinned state - shifts content when sidebar is pinned */}
        <style jsx global>{`
          /* When sidebar is pinned, shift content to make room */
          body[data-sidebar='pinned'] main {
            padding-left: 336px; /* 320px sidebar + 16px gutter */
          }

          /* Mobile: no sidebar padding */
          @media (max-width: 768px) {
            body[data-sidebar='pinned'] main {
              padding-left: 0;
            }
          }
        `}</style>
      </div>
    </SidebarStateProvider>
  )
}
