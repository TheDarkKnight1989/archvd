'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const faqs = [
  {
    question: 'DO I NEED ARCHVD IF I ONLY SELL A FEW ITEMS?',
    answer:
      "If you're under the £1,000 trading allowance, you may not need full records – but Archvd's free tier is perfect for tracking your collection and testing the waters.",
  },
  {
    question: 'IS THIS A FULL ACCOUNTING TOOL?',
    answer:
      'Archvd focuses on reselling and marketplace income – we handle sales, expenses, fees and P&L, and give you exports your accountant can use.',
  },
  {
    question: 'DOES THIS WORK OUTSIDE THE UK?',
    answer:
      'Yes – Archvd works anywhere, with extra support for UK/EU tax concepts like the VAT Margin Scheme.',
  },
  {
    question: 'DO YOU CONNECT DIRECTLY TO EBAY/STOCKX/ETC.?',
    answer:
      "Integrations are being rolled out – you can start today with manual entry and CSV imports, and hook up marketplaces as they're supported.",
  },
  {
    question: 'WHAT HAPPENS TO MY DATA?',
    answer:
      'Your data is encrypted and stored securely. You own your data and can export it anytime. We never sell or share your information.',
  },
  {
    question: 'CAN I UPGRADE OR DOWNGRADE LATER?',
    answer:
      'Yes! You can change your plan at any time. Upgrades take effect immediately, and downgrades apply at the end of your billing period.',
  },
]

export function FAQ({ id }: { id?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id={id} className="py-20 border-b border-border/40 bg-elev-0/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-fg mb-4">
            Frequently Asked <span className="text-accent">Questions</span>
          </h2>
          <p className="text-lg text-muted">
            Have a question that's not answered here? <a href="mailto:hello@archvd.io" className="text-accent hover:underline">Get in touch</a>
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-elev-1/50 border border-border/30 rounded-xl overflow-hidden transition-all hover:border-border/50"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <span className="text-fg font-semibold">{faq.question}</span>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-muted transition-transform flex-shrink-0 ml-4',
                    openIndex === index && 'rotate-180'
                  )}
                />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-muted leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
