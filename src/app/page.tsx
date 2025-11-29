import type { Metadata } from 'next'
import { NavBar } from './(marketing)/components/NavBar'
import { HeroSection } from './(marketing)/components/HeroSection'
import { PlatformStrip } from './(marketing)/components/PlatformStrip'
import { AudienceCards } from './(marketing)/components/AudienceCards'
import { FeatureHighlights } from './(marketing)/components/FeatureHighlights'
import { DashboardPreview } from './(marketing)/components/DashboardPreview'
import { HowItWorks } from './(marketing)/components/HowItWorks'
import { PricingTeaser } from './(marketing)/components/PricingTeaser'
import { FAQ } from './(marketing)/components/FAQ'
import { FinalCTA } from './(marketing)/components/FinalCTA'

export const metadata: Metadata = {
  title: 'Archvd - Track Your Collection, Know Your Profit | UK Reseller Analytics',
  description: 'Archvd helps UK collectors and resellers understand true profit, track every sale and expense, and stay ready for HMRC. Free for collectors, integrations with eBay, StockX, Alias & Shopify.',
  openGraph: {
    title: 'Archvd - Track Your Collection, Know Your Profit',
    description: 'Archvd helps UK collectors and resellers understand true profit, track every sale and expense, and stay ready for HMRC.',
    url: 'https://archvd.io',
    type: 'website',
  },
  alternates: {
    canonical: 'https://archvd.io',
  },
}

export default function LandingPage() {
  // Structured Data - Organization Schema
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Archvd',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'GBP',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '127',
    },
    description: 'Archvd helps UK collectors and resellers understand true profit, track every sale and expense, and stay ready for HMRC.',
    url: 'https://archvd.io',
    logo: 'https://archvd.io/images/logo.png',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'hello@archvd.io',
      contactType: 'Customer Support',
    },
    sameAs: [
      'https://discord.gg/6S7N92EYMa',
      'https://www.instagram.com/archvd.io',
    ],
  }

  // FAQ Schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Do I need Archvd if I only sell a few items?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "If you're under the £1,000 trading allowance, you may not need full records – but Archvd's free tier is perfect for tracking your collection and testing the waters.",
        },
      },
      {
        '@type': 'Question',
        name: 'Is this a full accounting tool?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Archvd focuses on reselling and marketplace income – we handle sales, expenses, fees and P&L, and give you exports your accountant can use.',
        },
      },
      {
        '@type': 'Question',
        name: 'What platforms does Archvd integrate with?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We currently integrate with StockX and Alias, with eBay and Shopify rolling out soon. You can also manually add sales from any platform.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does the VAT Margin Scheme work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "Archvd helps track your margin (profit) on each item, which is what you pay VAT on under the Margin Scheme. It's built into our Pro tier.",
        },
      },
      {
        '@type': 'Question',
        name: "Will Archvd help me prepare for HMRC?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Archvd tracks all your sales, fees, and expenses. You can export reports for your accountant or Self Assessment.',
        },
      },
      {
        '@type': 'Question',
        name: "Can I track items I haven't sold yet?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Absolutely. Our free tier lets you track your entire collection, see value estimates, and manage watchlists.',
        },
      },
    ],
  }

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="min-h-screen bg-bg text-fg">
        <NavBar />
        <HeroSection />
        <PlatformStrip />
        <AudienceCards />
        <FeatureHighlights id="features" />
        <DashboardPreview />
        <HowItWorks />
        <PricingTeaser />
        <FAQ id="faq" />
        <FinalCTA />
      </main>
    </>
  )
}
