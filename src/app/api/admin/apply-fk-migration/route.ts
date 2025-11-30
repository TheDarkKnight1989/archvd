import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createServiceRoleClient()

    // Add FK constraint from inventory_market_links.item_id to Inventory.id
    const sql = `
      -- Add FK if it doesn't exist
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'fk_inventory_market_links_item_id'
        ) THEN
          ALTER TABLE inventory_market_links
          ADD CONSTRAINT fk_inventory_market_links_item_id
          FOREIGN KEY (item_id)
          REFERENCES "Inventory"(id)
          ON DELETE CASCADE;

          RAISE NOTICE 'Added FK constraint';
        ELSE
          RAISE NOTICE 'FK already exists';
        END IF;
      END $$;

      -- Add index if not exists
      CREATE INDEX IF NOT EXISTS idx_inventory_market_links_item_id
      ON inventory_market_links(item_id);
    `

    // Execute using raw SQL via Supabase
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql })

    if (error) {
      console.error('[FK Migration] Error:', error)
      return NextResponse.json(
        { error: error.message, details: 'Try running the migration manually' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'FK constraint added successfully',
      data
    })
  } catch (error: any) {
    console.error('[FK Migration] Fatal error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
