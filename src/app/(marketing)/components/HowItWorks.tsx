'use client'

import { Database, Receipt, FileText } from 'lucide-react'

const steps = [
  {
    icon: Database,
    title: 'Connect Or Import Your Data',
    description: 'Manually add sales, or import from CSV. Integrations for eBay, StockX, Alias, and Shopify are rolling out.',
    color: 'from-blue-500/10 to-blue-500/5',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
  {
    icon: Receipt,
    title: 'Add Expenses And Fees',
    description: 'Add shipping, subscriptions, tools, and other costs. Recurring expenses and tags keep everything organised.',
    color: 'from-purple-500/10 to-purple-500/5',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
  },
  {
    icon: FileText,
    title: 'See Profit, Performance And Tax-Ready Reports',
    description: 'P&L, VAT (margin scheme), and exportable reports for your accountant or HMRC.',
    color: 'from-accent/10 to-accent/5',
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
  },
]

export function HowItWorks() {
  return (
    <section className="py-20 border-b border-border/40 bg-elev-0/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4">
            How It <span className="text-accent">Works</span>
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Get up and running in minutes. No complex setup required.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector line (desktop only) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[calc(50%+2rem)] w-[calc(100%-2rem)] h-0.5 bg-gradient-to-r from-border to-transparent z-0" />
              )}

              <div className={`relative bg-gradient-to-br ${step.color} border border-border/30 rounded-xl p-6 transition-all hover:shadow-lg hover:-translate-y-1`}>
                {/* Step number */}
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center text-sm font-bold text-fg shadow-lg">
                  {index + 1}
                </div>

                <div className={`w-14 h-14 rounded-full ${step.iconBg} flex items-center justify-center mb-4`}>
                  <step.icon className={`h-7 w-7 ${step.iconColor}`} />
                </div>

                <h3 className="text-lg font-semibold text-fg mb-2">{step.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
