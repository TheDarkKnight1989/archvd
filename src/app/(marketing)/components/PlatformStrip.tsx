'use client'

import { Store, TrendingUp, Users } from 'lucide-react'

export function PlatformStrip() {
  return (
    <section className="border-b border-border/40 bg-elev-0/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Platforms */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted mb-3">Built For Sellers On</p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-fg/80">
            <span>eBay</span>
            <span className="text-border">•</span>
            <span>StockX</span>
            <span className="text-border">•</span>
            <span>Alias</span>
            <span className="text-border">•</span>
            <span>Shopify</span>
            <span className="text-border">•</span>
            <span>Other Platforms</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center justify-center gap-3 p-4 bg-elev-1/50 border border-border/30 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Store className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-fg">Track 1–10,000+ Items</div>
              <div className="text-xs text-muted">Scales With You</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 p-4 bg-elev-1/50 border border-border/30 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="text-sm font-semibold text-fg">Designed For UK & EU Tax Rules</div>
              <div className="text-xs text-muted">HMRC-Ready Reports</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 p-4 bg-elev-1/50 border border-border/30 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-fg">Hobby To Full-Time</div>
              <div className="text-xs text-muted">Free To Enterprise</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
