/**
 * DEBUG: Check StockX connection state
 * Shows exactly what each endpoint sees
 * GET /api/stockx/debug/check-connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { isStockxMockMode, isStockxEnabled } from '@/lib/config/stockx';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check config
    const mockMode = isStockxMockMode();
    const enabled = isStockxEnabled();

    // Get user from regular client (what Orders API uses)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        step: 'auth',
        error: 'Not authenticated',
        authError: authError?.message,
        hasUser: false
      });
    }

    // Check stockx_accounts with regular client (what Orders API uses)
    const { data: accountViaRegular, error: regularError } = await supabase
      .from('stockx_accounts')
      .select('user_id, account_email, created_at, updated_at')
      .eq('user_id', user.id)
      .single();

    // Check stockx_accounts with service role (bypasses RLS)
    const adminSupabase = createServiceRoleClient();
    const { data: accountViaAdmin, error: adminError } = await adminSupabase
      .from('stockx_accounts')
      .select('user_id, account_email, created_at, updated_at')
      .eq('user_id', user.id)
      .single();

    // Also check if there are ANY records in the table
    const { data: allAccounts, error: allError } = await adminSupabase
      .from('stockx_accounts')
      .select('user_id, account_email')
      .limit(10);

    return NextResponse.json({
      config: {
        enabled,
        mockMode,
        mockModeWouldBlock: mockMode
      },
      auth: {
        userId: user.id,
        email: user.email
      },
      regularClient: {
        found: !!accountViaRegular,
        error: regularError?.message || null,
        errorCode: regularError?.code || null,
        data: accountViaRegular ? {
          userId: accountViaRegular.user_id,
          email: accountViaRegular.account_email,
          createdAt: accountViaRegular.created_at
        } : null
      },
      adminClient: {
        found: !!accountViaAdmin,
        error: adminError?.message || null,
        errorCode: adminError?.code || null,
        data: accountViaAdmin ? {
          userId: accountViaAdmin.user_id,
          email: accountViaAdmin.account_email,
          createdAt: accountViaAdmin.created_at
        } : null
      },
      allAccountsInTable: {
        count: allAccounts?.length || 0,
        error: allError?.message || null,
        accounts: allAccounts?.map(a => ({
          userId: a.user_id,
          email: a.account_email
        })) || []
      },
      diagnosis: getDiagnosis(mockMode, accountViaRegular, regularError, accountViaAdmin, adminError)
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      details: error.message
    }, { status: 500 });
  }
}

function getDiagnosis(
  mockMode: boolean,
  regularAccount: any,
  regularError: any,
  adminAccount: any,
  adminError: any
): string[] {
  const issues: string[] = [];

  if (mockMode) {
    issues.push('❌ Mock mode is ON - Orders API will block');
  } else {
    issues.push('✅ Mock mode is OFF');
  }

  if (!adminAccount) {
    issues.push('❌ No stockx_accounts record exists (checked with admin client)');
    issues.push('→ OAuth callback did not store tokens');
  } else {
    issues.push('✅ stockx_accounts record exists');
  }

  if (adminAccount && !regularAccount) {
    issues.push('❌ Record exists but RLS blocks read - Orders API cannot see it');
    issues.push('→ RLS policy issue on stockx_accounts SELECT');
  }

  if (adminAccount && regularAccount) {
    issues.push('✅ Record is readable via regular client');
    if (!mockMode) {
      issues.push('✅ Orders API should work!');
    }
  }

  return issues;
}
