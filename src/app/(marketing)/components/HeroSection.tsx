'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HeroSection() {
  const scrollToPreview = () => {
    document.getElementById('dashboard-preview')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative overflow-hidden border-b border-border/40">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="space-y-8">
            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-fg leading-tight">
                Track Your Collection.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-blue-400 to-purple-400">
                  Know Your Profit.
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted max-w-2xl">
                Archvd helps UK collectors and resellers understand true profit, track every sale and expense, and stay ready for HMRC – across eBay, StockX, Alias, Shopify and more.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/auth/sign-up">
                <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-base !bg-accent !text-white">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                onClick={scrollToPreview}
                className="w-full sm:w-auto px-8 py-6 text-base"
              >
                <BarChart3 className="mr-2 h-5 w-5" />
                View Live Dashboard
              </Button>
            </div>

            {/* Reassurance */}
            <div className="flex items-center gap-2 text-sm text-dim">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Free For Collectors
              </span>
              <span className="text-border">•</span>
              <span>No Card Required</span>
              <span className="text-border">•</span>
              <span>Built For UK/EU Tax Rules</span>
            </div>
          </div>

          {/* Right: Mock Dashboard Preview */}
          <div className="relative lg:block hidden">
            <div className="relative bg-gradient-to-br from-elev-1 to-elev-0 border border-border/50 rounded-2xl p-6 backdrop-blur-sm shadow-2xl shadow-accent/5">
              {/* Mock Chart */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">Total Profit</span>
                  <span className="text-2xl font-bold text-green-400 font-mono">+£12,450</span>
                </div>

                {/* Fake chart bars */}
                <div className="grid grid-cols-12 gap-1 h-32 items-end">
                  {[40, 65, 45, 80, 55, 70, 60, 85, 75, 90, 95, 100].map((height, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-t from-accent/80 to-accent/20 rounded-sm"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>

                {/* Mock stats row */}
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/30">
                  <div className="text-center">
                    <div className="text-xs text-muted">Sales</div>
                    <div className="text-sm font-semibold text-fg">£18.2k</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted">Expenses</div>
                    <div className="text-sm font-semibold text-fg">£4.1k</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted">Margin</div>
                    <div className="text-sm font-semibold text-green-400">68%</div>
                  </div>
                </div>
              </div>

              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 to-blue-500/20 rounded-2xl blur-xl -z-10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
