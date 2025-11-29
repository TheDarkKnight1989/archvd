'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const tiers = [
  {
    name: 'Free',
    subtitle: 'Collectors',
    features: [
      'Track your collection and watchlists',
      'Portfolio charts & item value',
      'Manual entries & basic insights',
    ],
    cta: 'Start Free',
    color: 'from-blue-500/10 to-blue-500/5',
    borderColor: 'border-blue-500/20',
  },
  {
    name: 'Standard',
    subtitle: 'Resellers',
    features: [
      'Sales, expenses & P/L',
      'Basic analytics & CSV export',
      'Ideal for part-time sellers',
    ],
    cta: 'Start Free',
    color: 'from-purple-500/10 to-purple-500/5',
    borderColor: 'border-purple-500/20',
  },
  {
    name: 'Pro',
    subtitle: 'Businesses / Stores',
    features: [
      'Advanced analytics, packages',
      'Integrations (StockX, Alias, Shopify)',
      'Tax-ready reports & forecasting',
    ],
    cta: 'Start Free',
    color: 'from-accent/10 to-accent/5',
    borderColor: 'border-accent/20',
    highlight: true,
  },
]

export function PricingTeaser() {
  return (
    <section className="py-20 border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4">
            Simple, Transparent <span className="text-accent">Pricing</span>
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto mb-6">
            Start free and scale as you grow. No hidden fees.
          </p>
          <Link href="/pricing">
            <Button variant="outline">
              View Full Pricing →
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className={`relative bg-gradient-to-br ${tier.color} border ${tier.borderColor} rounded-xl p-6 transition-all hover:shadow-lg ${
                tier.highlight ? 'md:-mt-4 md:mb-0' : ''
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent rounded-full text-xs font-semibold text-fg">
                  Most Popular
                </div>
              )}

              <div className="text-center mb-6">
                <div className="text-2xl font-bold text-fg mb-1">{tier.name}</div>
                <div className="text-sm text-muted">{tier.subtitle}</div>
              </div>

              <ul className="space-y-3 mb-6">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/auth/sign-up">
                <Button
                  variant={tier.highlight ? 'default' : 'secondary'}
                  className={tier.highlight ? 'w-full !bg-accent !text-white' : 'w-full'}
                >
                  {tier.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
