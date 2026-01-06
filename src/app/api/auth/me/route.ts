/**
 * Auth Debug Route - Returns current user from server-side session
 *
 * Used to verify that cookies are being properly sent and session persists.
 * If this returns null after reopening the PWA, cookies aren't persisting.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.log('[Auth Me] Error getting user:', error.message)
      return NextResponse.json({ user: null, error: error.message })
    }

    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
    })

  } catch (error: any) {
    console.error('[Auth Me] Error:', error)
    return NextResponse.json(
      { user: null, error: error.message },
      { status: 500 }
    )
  }
}
