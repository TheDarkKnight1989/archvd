import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  // Handle /dashboard -> /portfolio redirect (308 Permanent Redirect)
  if (request.nextUrl.pathname === '/dashboard' || request.nextUrl.pathname.startsWith('/dashboard/')) {
    const newPath = request.nextUrl.pathname.replace('/dashboard', '/portfolio');
    const url = request.nextUrl.clone();
    url.pathname = newPath;
    return NextResponse.redirect(url, 308);
  }

  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );

  // Touch session so refreshed cookies are set on the response
  await supabase.auth.getUser();

  return response;
}

// exclude Next static assets/images, favicon, and OAuth callback routes
// OAuth callback needs to read OAuth cookies without Supabase interference
// Start routes need middleware to refresh session for user auth
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stockx/oauth/callback|api/stockx/internal).*)',
  ],
};
