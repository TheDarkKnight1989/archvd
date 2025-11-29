import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Cinzel } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
});

const jetmono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetmono'
});

const cinzel = Cinzel({
  subsets: ['latin'],
  display: 'swap',
  weight: ['600', '700'],
  variable: '--font-cinzel'
});

export const metadata: Metadata = {
  metadataBase: new URL('https://archvd.io'),
  title: {
    default: 'Archvd - Track Your Collection, Know Your Profit | UK Reseller Analytics',
    template: '%s | Archvd'
  },
  description: 'Archvd helps UK collectors and resellers understand true profit, track every sale and expense, and stay ready for HMRC. Free for collectors, powerful for resellers.',
  keywords: [
    'reseller analytics UK',
    'collection tracker',
    'HMRC tax ready',
    'profit tracking',
    'sneaker reselling',
    'eBay profit calculator',
    'StockX analytics',
    'reseller accounting',
    'VAT margin scheme',
    'UK reseller tax',
    'inventory management',
    'reseller software UK'
  ],
  authors: [{ name: 'Archvd' }],
  creator: 'Archvd',
  publisher: 'Archvd',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://archvd.io',
    title: 'Archvd - Track Your Collection, Know Your Profit',
    description: 'Archvd helps UK collectors and resellers understand true profit, track every sale and expense, and stay ready for HMRC.',
    siteName: 'Archvd',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Archvd - Reseller Analytics Dashboard'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Archvd - Track Your Collection, Know Your Profit',
    description: 'Archvd helps UK collectors and resellers understand true profit, track every sale and expense, and stay ready for HMRC.',
    images: ['/images/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your verification codes here when you have them
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F3EE' },
    { media: '(prefers-color-scheme: dark)', color: '#050807' }
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#050608" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Archvd" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${inter.variable} ${jetmono.variable} ${cinzel.variable} font-sans min-h-screen bg-[#050608] text-zinc-100`} suppressHydrationWarning>
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
