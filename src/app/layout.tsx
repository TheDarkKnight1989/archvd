// /app/layout.tsx
import type { Metadata } from 'next';
import TopNav from '@/components/nav/TopNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'archvd.io',
  description: 'archvd.io application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}