/**
 * Alias Delete Listing API Route
 * Delete a listing from Alias marketplace
 *
 * ⚠️ MANUAL DELETION ONLY - User must explicitly delete each listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAliasClient, deleteAliasListing } from '@/lib/services/alias';
import { AliasAPIError, AliasAuthenticationError } from '@/lib/services/alias/errors';

export const dynamic = 'force-dynamic';

/**
 * Delete an Alias listing
 * DELETE /api/alias/listings/[listingId]/delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Verify listing belongs to user
    const { data: existingListing, error: fetchError } = await supabase
      .from('alias_listings')
      .select('*')
      .eq('listing_id', listingId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingListing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Listing not found or access denied',
        },
        { status: 404 }
      );
    }

    // Create Alias client
    const client = createAliasClient();

    // Delete listing
    const result = await deleteAliasListing(client, {
      user_id: user.id,
      listing_id: listingId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Listing deleted successfully',
    });

  } catch (error) {
    console.error('[Alias Delete Listing] Error:', error);

    if (error instanceof AliasAuthenticationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Alias API authentication failed',
          message: error.message,
        },
        { status: 401 }
      );
    }

    if (error instanceof AliasAPIError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Alias API Error',
          message: error.getUserMessage(),
          statusCode: error.statusCode,
        },
        { status: error.statusCode }
      );
    }

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
