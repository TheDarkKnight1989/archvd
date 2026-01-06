/**
 * Server-side Login API
 *
 * Sets auth cookies via HTTP Set-Cookie headers (not client-side JS).
 * This is critical for iOS PWA cookie persistence - Safari treats
 * server-set cookies differently than JS-set cookies.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_CREDENTIALS', message: 'Email and password required' },
        { status: 400 }
      )
    }

    // Create response first - we'll set cookies on it
    const response = NextResponse.json({ ok: true })

    // Create Supabase client that writes cookies to the response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            // Set cookie on the response with proper options for persistence
            response.cookies.set({
              name,
              value,
              ...options,
              // Ensure cookies persist (iOS PWA fix)
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/',
            })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value: '',
              ...options,
              maxAge: 0,
            })
          },
        },
      }
    )

    // Perform sign-in - this will trigger cookie set via our handler
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('[Auth Login] Sign-in failed:', error.message)
      return NextResponse.json(
        { ok: false, error: 'INVALID_LOGIN', message: error.message },
        { status: 401 }
      )
    }

    if (!data.session) {
      console.error('[Auth Login] No session returned')
      return NextResponse.json(
        { ok: false, error: 'NO_SESSION', message: 'Sign-in succeeded but no session was created' },
        { status: 500 }
      )
    }

    console.log('[Auth Login] Success:', { userId: data.user?.id, email: data.user?.email })

    // Return success - cookies are already set on the response
    return response

  } catch (error: any) {
    console.error('[Auth Login] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: error.message },
      { status: 500 }
    )
  }
}
