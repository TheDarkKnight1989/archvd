'use client'

import { DollarSign, Receipt, TrendingUp, Package } from 'lucide-react'

const features = [
  {
    icon: DollarSign,
    title: 'True Profit & P/L',
    description: 'See revenue, fees, COGS, expenses and net profit in one place.',
    color: 'from-green-500/10 to-green-500/5',
    borderColor: 'border-green-500/20',
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-400',
  },
  {
    icon: Receipt,
    title: 'Expenses & Receipts',
    description: 'Track subscriptions, shipping, tools and more with budgets, tags and recurring expenses.',
    color: 'from-blue-500/10 to-blue-500/5',
    borderColor: 'border-blue-500/20',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
  {
    icon: TrendingUp,
    title: 'Analytics & Trends',
    description: 'Margin, ROI, sell-through, hold time, platform performance and more – visualised over time.',
    color: 'from-purple-500/10 to-purple-500/5',
    borderColor: 'border-purple-500/20',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
  },
  {
    icon: Package,
    title: 'Packages & Shipping',
    description: 'Track orders from sold to shipped with package tracking and delivery status.',
    color: 'from-orange-500/10 to-orange-500/5',
    borderColor: 'border-orange-500/20',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
  },
]

export function FeatureHighlights({ id }: { id?: string }) {
  return (
    <section id={id} className="py-20 border-b border-border/40 bg-elev-0/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4">
            Everything You Need To <span className="text-accent">Succeed</span>
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            From tracking to tax prep, Archvd handles the complexity so you can focus on growing.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`group relative bg-gradient-to-br ${feature.color} border ${feature.borderColor} rounded-xl p-6 transition-all hover:shadow-lg hover:-translate-y-1`}
            >
              <div className={`w-12 h-12 rounded-full ${feature.iconBg} flex items-center justify-center mb-4`}>
                <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
              </div>
              <h3 className="text-lg font-semibold text-fg mb-2">{feature.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
