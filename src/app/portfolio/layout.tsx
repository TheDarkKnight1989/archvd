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
          className="pl-0 md:pl-16 transition-[padding-left] duration-120 ease-terminal"
          id="main"
        >
          {/* App Top Bar - visible on all pages */}
          <AppTopBar onMenuClick={() => setDrawerOpen(true)} />

          <div className="pt-4 pb-4">
            {children}
          </div>
        </main>

        {/* Mobile Navigation */}
        <MobileDock drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />

        {/* CSS for sidebar states - shifts content when sidebar is expanded or pinned */}
        <style jsx global>{`
          /* When sidebar is expanded (hover) or pinned, shift content to make room */
          body[data-sidebar='expanded'] main,
          body[data-sidebar='pinned'] main {
            padding-left: 272px; /* 256px sidebar + 16px gutter */
          }

          /* Mobile: no sidebar padding */
          @media (max-width: 768px) {
            body[data-sidebar='expanded'] main,
            body[data-sidebar='pinned'] main {
              padding-left: 0;
            }
          }
        `}</style>
      </div>
    </SidebarStateProvider>
  )
}
