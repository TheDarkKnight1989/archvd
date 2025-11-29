# Platform Constraint Fix

## Issue

When trying to mark items as sold with the "Alias" platform, the application threw this error:

```
Failed to update item: new row for relation 'Inventory' violates check constraint 'Inventory_platform_check'
```

## Root Cause

The `Inventory` table's `platform` column had a CHECK constraint with **capitalized** values:
- `'StockX'`, `'Alias'`, `'Shopify'`, `'eBay'`, etc.

But the application code sends **lowercase** values:
- `'stockx'`, `'goat'`, `'ebay'`, etc.

This case-sensitivity mismatch caused constraint violations whenever the app tried to insert or update platform values.

### Technical Details

- Column type: `TEXT` (not an enum)
- Old constraint values: Capitalized (e.g., `'StockX'`, `'Alias'`)
- Application values: Lowercase (e.g., `'stockx'`, `'goat'`)
- **Note**: Display label "Alias" → database value "goat" is intentional

## Solution

The fix requires three steps:

1. **Update existing data** from capitalized to lowercase (including `'Alias'` → `'goat'`)
2. **Drop old constraint** with capitalized values
3. **Create new constraint** with all lowercase values

## How to Apply

### Option 1: Using Supabase CLI (Recommended)

```bash
npx supabase db push
```

This will apply the migration file:
`supabase/migrations/20251128_fix_inventory_platform_constraint.sql`

### Option 2: Manual Application

Run the SQL script in Supabase Dashboard → SQL Editor:
`scripts/fix-platform-data-and-constraint.sql`

## Verification

After applying the fix, run:

```bash
node scripts/verify-platform-fix.mjs
```

This will check:
- ✅ All platform values in database are lowercase
- ✅ Constraint accepts all expected platforms
- ✅ 'goat' platform is accepted (for Alias)

## Expected Platforms

After the fix, these lowercase platform values are accepted:

- `stockx` - StockX
- `goat` - Alias (GOAT)
- `ebay` - eBay
- `instagram` - Instagram
- `tiktok` - TikTok Shop
- `vinted` - Vinted
- `depop` - Depop
- `private` - Private Sale
- `shopify` - Shopify
- `other` - Other

## Related Files

- **Migration**: `supabase/migrations/20251128_fix_inventory_platform_constraint.sql`
- **Standalone SQL**: `scripts/fix-platform-data-and-constraint.sql`
- **Verification**: `scripts/verify-platform-fix.mjs`
- **Platform enum migration**: `supabase/migrations/20251128_add_new_sale_platforms.sql`

## Testing

After applying the fix:

1. Go to Portfolio → Inventory
2. Select an item
3. Click "Mark as Sold"
4. Select "Alias" as the platform
5. Fill in sale details
6. Submit

The item should be marked as sold without errors.
