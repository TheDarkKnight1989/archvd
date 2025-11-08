// /components/nav/TopNav.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function TopNav() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          archvd.io
        </Link>
        {isLoggedIn && (
          <div className="flex items-center gap-4">
            <Link
              href="/portfolio"
              className="text-sm hover:text-blue-600 transition-colors"
            >
              Portfolio
            </Link>
            <Link
              href="/portfolio/inventory"
              className="text-sm hover:text-blue-600 transition-colors"
            >
              Inventory
            </Link>
            <Link
              href="/portfolio/expenses"
              className="text-sm hover:text-blue-600 transition-colors"
            >
              Expenses
            </Link>
            <Link
              href="/settings"
              className="text-sm hover:text-blue-600 transition-colors"
            >
              Settings
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}