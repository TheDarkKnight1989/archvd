/**
 * DEBUG: Force disconnect StockX account
 * Bypasses all checks and directly deletes the record
 * DELETE /api/stockx/debug/force-disconnect
 *
 * REMOVE THIS IN PRODUCTION after testing!
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    // Get user from session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to force delete
    const adminSupabase = createServiceRoleClient();

    // First, check if record exists
    const { data: existing, error: checkError } = await adminSupabase
      .from('stockx_accounts')
      .select('id, user_id, account_email')
      .eq('user_id', user.id)
      .single();

    console.log('[Force Disconnect] Existing record:', existing, 'Error:', checkError);

    if (!existing) {
      return NextResponse.json({
        success: true,
        message: 'No record found to delete',
        userId: user.id
      });
    }

    // Force delete
    const { error: deleteError, count } = await adminSupabase
      .from('stockx_accounts')
      .delete()
      .eq('user_id', user.id);

    console.log('[Force Disconnect] Delete result:', { deleteError, count });

    if (deleteError) {
      return NextResponse.json({
        error: 'Delete failed',
        details: deleteError.message,
        userId: user.id
      }, { status: 500 });
    }

    // Verify deletion
    const { data: verify } = await adminSupabase
      .from('stockx_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Force disconnected',
      userId: user.id,
      deletedRecord: existing,
      stillExists: !!verify
    });

  } catch (error: any) {
    console.error('[Force Disconnect] Error:', error);
    return NextResponse.json({
      error: 'Unexpected error',
      details: error.message
    }, { status: 500 });
  }
}
