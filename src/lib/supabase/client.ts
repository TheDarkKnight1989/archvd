import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.'
  );
}

// Browser client handles cookies automatically - no custom handlers needed
// @supabase/ssr will use standard cookie names (sb-{project-ref}-auth-token)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);