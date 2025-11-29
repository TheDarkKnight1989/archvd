'use client'

import Link from 'next/link'
import { Heart, TrendingUp, Eye, LineChart, Receipt, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AudienceCards() {
  return (
    <section className="py-20 border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4">
            Built For Collectors <span className="text-accent">&</span> Resellers
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Whether you're tracking your collection or running a business, Archvd scales with you.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Collectors Card */}
          <div className="group relative bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-2xl p-8 transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity -z-10" />

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Heart className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-fg">For Collectors</h3>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <span className="text-muted">Track every item in your collection</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <span className="text-muted">Monitor value changes over time</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <span className="text-muted">Watchlists and releases for your next buy</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <span className="text-muted">See what your collection would be worth if you sold</span>
              </li>
            </ul>

            <Link href="/auth/sign-up">
              <Button className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30">
                <Eye className="mr-2 h-4 w-4" />
                Start A Portfolio
              </Button>
            </Link>
          </div>

          {/* Resellers Card */}
          <div className="group relative bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-2xl p-8 transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-accent/10">
            <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 to-green-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity -z-10" />

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-fg">For Resellers</h3>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                </div>
                <span className="text-muted">See real profit after fees, shipping and expenses</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                </div>
                <span className="text-muted">P&L and tax-ready summaries</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                </div>
                <span className="text-muted">Multi-platform analytics in one place</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                </div>
                <span className="text-muted">Packages, expenses, and forecasting</span>
              </li>
            </ul>

            <Link href="/auth/sign-up">
              <Button className="w-full bg-accent hover:bg-accent/90 text-fg font-semibold">
                <LineChart className="mr-2 h-4 w-4" />
                Start Tracking Profit
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
