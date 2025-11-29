/**
 * Alias Link API Route
 * Create inventory_alias_links mapping after manual approval
 *
 * ⚠️ MANUAL APPROVAL REQUIRED - Only creates link after user confirms match
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Create inventory_alias_links mapping
 * POST /api/alias/link
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[Alias Link] Request received:', {
      inventory_id: body.inventory_id,
      alias_catalog_id: body.alias_catalog_id,
      match_confidence: body.match_confidence,
    });

    // Validate required fields
    if (!body.inventory_id || !body.alias_catalog_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: inventory_id and alias_catalog_id',
        },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Alias Link] Auth error:', authError);
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    console.log('[Alias Link] Authenticated user:', user.id);

    // Verify inventory item belongs to user
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('inventory')
      .select('id, user_id')
      .eq('id', body.inventory_id)
      .eq('user_id', user.id)
      .single();

    if (inventoryError || !inventoryItem) {
      console.error('[Alias Link] Inventory verification failed:', inventoryError);
      return NextResponse.json(
        {
          success: false,
          error: 'Inventory item not found or access denied',
          details: inventoryError?.message || 'Item not found',
        },
        { status: 404 }
      );
    }

    console.log('[Alias Link] Inventory item verified:', inventoryItem.id);

    // Create or update the link
    const linkData = {
      inventory_id: body.inventory_id,
      alias_catalog_id: body.alias_catalog_id,
      mapping_status: 'ok',
      match_confidence: body.match_confidence || null,
      last_sync_success_at: new Date().toISOString(),
    };

    console.log('[Alias Link] Attempting to upsert:', linkData);

    const { data: link, error: linkError } = await supabase
      .from('inventory_alias_links')
      .upsert(linkData, {
        onConflict: 'inventory_id',
      })
      .select()
      .single();

    if (linkError) {
      console.error('[Alias Link] Database error:', {
        code: linkError.code,
        message: linkError.message,
        details: linkError.details,
        hint: linkError.hint,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create Alias mapping',
          message: linkError.message,
          code: linkError.code,
          details: linkError.details,
          hint: linkError.hint,
        },
        { status: 500 }
      );
    }

    console.log('[Alias Link] Created mapping for inventory_id:', body.inventory_id);

    return NextResponse.json({
      success: true,
      link,
      message: 'Alias mapping created successfully',
    });

  } catch (error) {
    console.error('[Alias Link] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
