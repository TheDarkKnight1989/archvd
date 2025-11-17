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
  title: 'archvd.io',
  description: 'Premium sneaker inventory management',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} ${jetmono.variable} ${cinzel.variable} font-sans min-h-screen bg-bg text-fg`}>
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
