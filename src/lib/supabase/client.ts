import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.'
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage (survives PWA close/reopen)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'archvd-auth',
    // Auto refresh tokens
    autoRefreshToken: true,
    // Persist session across tabs
    persistSession: true,
    // Detect session from URL hash (OAuth redirect)
    detectSessionInUrl: true,
  },
});