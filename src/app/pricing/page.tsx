import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Pricing - Simple & Transparent Plans for Collectors & Resellers',
  description: 'Free for collectors, £12/mo for resellers, £29/mo for businesses. All plans include 14-day free trial. Track sales, expenses, and profit with HMRC-ready reports.',
  openGraph: {
    title: 'Archvd Pricing - Simple & Transparent Plans',
    description: 'Free for collectors, £12/mo for resellers, £29/mo for businesses. Track sales, expenses, and profit with HMRC-ready reports.',
    url: 'https://archvd.io/pricing',
    type: 'website',
  },
  alternates: {
    canonical: 'https://archvd.io/pricing',
  },
}

const tiers = [
  {
    name: 'Free',
    subtitle: 'For Collectors',
    price: '£0',
    period: 'forever',
    description: 'Perfect for tracking your personal collection',
    features: [
      'Track unlimited items in your collection',
      'Portfolio charts & item value tracking',
      'Watchlists and release calendars',
      'Basic market data and value estimates',
      'Manual entries and basic insights',
      'Mobile-friendly interface',
    ],
    cta: 'Start Free',
    color: 'from-blue-500/10 to-blue-500/5',
    borderColor: 'border-blue-500/20',
  },
  {
    name: 'Standard',
    subtitle: 'For Resellers',
    price: '£12',
    period: '/month',
    description: 'Essential tools for part-time and growing sellers',
    features: [
      'Everything in Free, plus:',
      'Sales tracking & profit analysis',
      'Expense management with categories',
      'P&L statements and reports',
      'Basic analytics & performance metrics',
      'CSV export for accountants',
      'Email support',
    ],
    cta: 'Start Free Trial',
    color: 'from-purple-500/10 to-purple-500/5',
    borderColor: 'border-purple-500/20',
  },
  {
    name: 'Pro',
    subtitle: 'For Businesses',
    price: '£29',
    period: '/month',
    description: 'Advanced features for serious sellers and stores',
    features: [
      'Everything in Standard, plus:',
      'Advanced analytics & custom reports',
      'Package tracking & shipping management',
      'Platform integrations (StockX, Alias, eBay, Shopify)',
      'VAT Margin Scheme support',
      'Automated expense tracking',
      'Priority support',
      'Multi-user access (coming soon)',
    ],
    cta: 'Start Free Trial',
    color: 'from-accent/10 to-accent/5',
    borderColor: 'border-accent/20',
    highlight: true,
  },
]

export default function PricingPage() {
  // Structured Data - Product Offers
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Archvd - Reseller Analytics Platform',
    description: 'Track your collection, know your profit. Perfect for UK collectors and resellers.',
    brand: {
      '@type': 'Brand',
      name: 'Archvd',
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Plan',
        price: '0',
        priceCurrency: 'GBP',
        description: 'Perfect for tracking your personal collection',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Standard Plan',
        price: '12',
        priceCurrency: 'GBP',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '12',
          priceCurrency: 'GBP',
          unitText: 'MONTH',
        },
        description: 'Essential tools for part-time and growing sellers',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Pro Plan',
        price: '29',
        priceCurrency: 'GBP',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '29',
          priceCurrency: 'GBP',
          unitText: 'MONTH',
        },
        description: 'Advanced features for serious sellers and stores',
        availability: 'https://schema.org/InStock',
      },
    ],
  }

  // FAQ Schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Can I change plans later?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes! You can upgrade or downgrade at any time. Upgrades take effect immediately, and downgrades apply at the end of your current billing period.',
        },
      },
      {
        '@type': 'Question',
        name: 'What payment methods do you accept?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We accept all major credit and debit cards via Stripe. More payment options coming soon.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is there a discount for annual billing?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes! Annual billing saves you 20% compared to monthly. Contact us for details.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do you offer refunds?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, we offer a 14-day money-back guarantee on all paid plans. If you are not satisfied, we will refund your payment in full.',
        },
      },
    ],
  }

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="min-h-screen bg-bg text-fg">
      {/* Header */}
      <div className="border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="inline-flex items-center gap-2 text-muted hover:text-fg transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative py-16 border-b border-border/40 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-fg mb-4">
            Simple, <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-400">Transparent</span> Pricing
          </h1>
          <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-8">
            Start free and scale as you grow. All paid plans include a 14-day free trial.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-dim">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
              No Credit Card Required
            </span>
            <span className="text-border">•</span>
            <span>Cancel Anytime</span>
            <span className="text-border">•</span>
            <span>14-Day Money-Back Guarantee</span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="relative py-16 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {tiers.map((tier, index) => (
              <div
                key={index}
                className={`relative group bg-gradient-to-br ${tier.color} border ${tier.borderColor} rounded-2xl p-8 transition-all hover:shadow-2xl hover:-translate-y-1 ${
                  tier.highlight ? 'md:-mt-8 md:mb-0 md:py-12 border-accent/40' : ''
                }`}
              >
                {/* Glow effect for highlighted tier */}
                {tier.highlight && (
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-accent/20 to-purple-500/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity -z-10" />
                )}

                {tier.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-accent to-purple-500 rounded-full text-xs font-semibold text-fg shadow-[0_0_20px_rgba(var(--archvd-accent-rgb),0.6)]">
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-8">
                  <div className="text-2xl font-bold bg-gradient-to-r from-fg to-muted bg-clip-text text-transparent mb-1">{tier.name}</div>
                  <div className="text-sm text-muted mb-4">{tier.subtitle}</div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-4xl font-bold ${tier.highlight ? 'text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-400' : 'text-fg'}`}>{tier.price}</span>
                    <span className="text-muted">{tier.period}</span>
                  </div>
                  <p className="text-sm text-muted mt-2">{tier.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="relative">
                        <Check className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                        <div className="absolute inset-0 blur-sm">
                          <Check className="h-5 w-5 text-accent flex-shrink-0 mt-0.5 opacity-50" />
                        </div>
                      </div>
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

      {/* FAQ Section */}
      <section className="relative py-16 border-t border-border/40 overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-fg mb-8 text-center">
            Pricing <span className="text-accent">FAQs</span>
          </h2>
          <div className="space-y-6">
            <div className="bg-elev-1/50 border border-border/30 rounded-xl p-6 hover:border-border/50 transition-colors">
              <h3 className="text-lg font-semibold text-fg mb-2">CAN I CHANGE PLANS LATER?</h3>
              <p className="text-muted">
                Yes! You can upgrade or downgrade at any time. Upgrades take effect immediately,
                and downgrades apply at the end of your current billing period.
              </p>
            </div>
            <div className="bg-elev-1/50 border border-border/30 rounded-xl p-6 hover:border-border/50 transition-colors">
              <h3 className="text-lg font-semibold text-fg mb-2">WHAT PAYMENT METHODS DO YOU ACCEPT?</h3>
              <p className="text-muted">
                We accept all major credit and debit cards via Stripe. More payment options coming soon.
              </p>
            </div>
            <div className="bg-elev-1/50 border border-border/30 rounded-xl p-6 hover:border-border/50 transition-colors">
              <h3 className="text-lg font-semibold text-fg mb-2">IS THERE A DISCOUNT FOR ANNUAL BILLING?</h3>
              <p className="text-muted">
                Yes! Annual billing saves you 20% compared to monthly. Contact us for details.
              </p>
            </div>
            <div className="bg-elev-1/50 border border-border/30 rounded-xl p-6 hover:border-border/50 transition-colors">
              <h3 className="text-lg font-semibold text-fg mb-2">DO YOU OFFER REFUNDS?</h3>
              <p className="text-muted">
                Yes, we offer a 14-day money-back guarantee on all paid plans. If you're not satisfied,
                we'll refund your payment in full.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 border-t border-border/40 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-t from-accent/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-fg mb-4">
            Ready To <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-400">Get Started?</span>
          </h2>
          <p className="text-lg text-muted mb-8">
            Start with our free plan and upgrade when you're ready.
          </p>
          <Link href="/auth/sign-up">
            <Button size="lg" className="px-10 py-6 !bg-accent !text-white">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>
    </main>
    </>
  )
}
