import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  const safeGet = (name: string) => {
    try {
      const c = (cookieStore as any).get?.(name);
      return !c ? undefined : (typeof c === 'string' ? c : c.value);
    } catch {
      return undefined;
    }
  };

  const safeSet = (name: string, value: string, options: CookieOptions) => {
    try {
      (cookieStore as any).set?.({ name, value, ...options });
    } catch {
      /* read-only in some runtimes */
    }
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: safeGet,
        set: safeSet,
        remove(name: string, options: CookieOptions) {
          safeSet(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );
}

// Alias for backwards compatibility
export const createServerSupabaseClient = createClient;

/**
 * Create a service role client (bypasses RLS)
 * Use ONLY for server-side admin operations like syncs, migrations, etc.
 * NEVER expose this client to the frontend
 */
export function createServiceRoleClient() {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}