/**
 * POST /api/transactions/item
 * WHY: Create a new transaction (sale or purchase)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProductImage } from '@/lib/product/getProductImage'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      type,
      inventory_id,
      sku,
      size_uk,
      brand,
      model,
      colorway,
      qty,
      unit_price,
      fees,
      platform,
      notes,
      occurred_at,
    } = body

    // Validate required fields
    if (!type || !qty || !unit_price || !occurred_at) {
      return NextResponse.json(
        { error: 'Missing required fields: type, qty, unit_price, occurred_at' },
        { status: 400 }
      )
    }

    // Build title
    const title = [brand, model, colorway].filter(Boolean).join(' ')

    // Resolve image URL
    const imageResolved = getProductImage({
      marketImageUrl: null,
      inventoryImageUrl: null,
      provider: null,
      brand,
      model,
      colorway,
      sku,
    })

    // Insert transaction
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type,
        inventory_id: inventory_id || null,
        sku: sku || null,
        size_uk: size_uk || null,
        title: title || null,
        image_url: imageResolved.src,
        qty,
        unit_price,
        fees: fees || 0,
        platform: platform || null,
        notes: notes || null,
        occurred_at,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, transaction: data }, { status: 201 })
  } catch (error: any) {
    console.error('[Create Transaction] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
