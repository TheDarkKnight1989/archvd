/**
 * Purchase Places API
 * GET /api/purchase-places - Get user's purchase place suggestions (ordered by last used)
 * POST /api/purchase-places - Record/update a purchase place usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's purchase places ordered by last used
    const { data: places, error } = await supabase
      .from('purchase_places')
      .select('name, last_used_at')
      .eq('user_id', user.id)
      .order('last_used_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('[Purchase Places] Error fetching:', error)
      return NextResponse.json(
        { error: 'Failed to fetch purchase places' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      suggestions: (places || []).map(p => p.name)
    })

  } catch (error: any) {
    console.error('[Purchase Places] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Purchase place name is required' },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()

    // Upsert: insert or update last_used_at
    const { error } = await supabase
      .from('purchase_places')
      .upsert(
        {
          user_id: user.id,
          name: trimmedName,
          last_used_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id,name',
          ignoreDuplicates: false
        }
      )

    if (error) {
      console.error('[Purchase Places] Error upserting:', error)
      return NextResponse.json(
        { error: 'Failed to record purchase place' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[Purchase Places] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}
