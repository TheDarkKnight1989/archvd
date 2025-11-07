import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

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

export const metadata: Metadata = {
  title: 'archvd.io',
  description: 'Premium sneaker inventory management',
  themeColor: '#050807',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#050807" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} ${jetmono.variable} font-sans min-h-screen bg-bg text-fg`}>
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
