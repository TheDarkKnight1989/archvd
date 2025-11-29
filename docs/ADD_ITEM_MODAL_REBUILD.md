# Add Item Modal - Rebuild Documentation

## Overview

The AddItemModal has been completely rebuilt with a vibrant StockX-style design, featuring unified product search, multi-size selection, and enhanced UX.

## What Changed

### Visual Design
- **Full-screen vibrant dark modal** matching StockX aesthetic
- **Gradient backgrounds** with green accent colors (#00FF87)
- **Glowing borders and shadows** for interactive elements
- **Two-column responsive layout** for better organization
- **Smooth animations** and transitions throughout

### Features

#### 1. Unified Product Search
- **Two search modes**: Search Product and Manual SKU tabs
- **Combined results** from StockX and Alias catalogs
- **Real-time search** with debounced API calls
- **Visual badges** showing product source (StockX/Alias)
- **Product thumbnails** in search results

#### 2. Smart Size Selection
- **Size system tabs**: UK, US, EU with easy switching
- **Grid-based selection** for multiple sizes at once
- **Quantity controls** per size (stepper + direct input)
- **Custom size support** via "+ Add Other Size" button
- **Visual feedback** for selected sizes
- **Size conversion** (basic implementation - can be enhanced)

#### 3. Purchase Information
- **Typeable "Place of purchase"** combobox
- **Smart suggestions** from user's purchase history
- **Remembered values** via purchase_places table
- **All existing fields** maintained (tax, shipping, notes, etc.)
- **Real-time total calculation**

#### 4. Multi-Item Support
- **Bulk creation**: Select multiple sizes and quantities
- **"Save & Add Another"** button for rapid entry
- **Smart defaults** remembered in localStorage
- **Progress feedback** showing number of items being created

## File Structure

### New Files Created

```
src/
├── app/api/
│   ├── catalog/search/
│   │   └── route.ts                          # Unified catalog search API
│   └── purchase-places/
│       └── route.ts                           # Purchase places CRUD API
├── components/modals/
│   ├── AddItemModal.tsx                       # Main modal (rebuilt)
│   ├── AddItemModal.backup.tsx                # Backup of old version
│   └── AddItemModal/
│       ├── ProductSearch.tsx                  # Search with tabs component
│       ├── ProductCard.tsx                    # Selected product hero card
│       ├── SizeGrid.tsx                       # Size selection grid
│       ├── SelectedSizesList.tsx              # Selected sizes with quantities
│       └── PurchaseForm.tsx                   # Purchase info form
└── supabase/migrations/
    └── 20251128_create_purchase_places.sql    # New table migration
```

### Modified Dependencies

Added to package.json:
- `lodash` - for debounced search
- `@types/lodash` - TypeScript types

## Component Architecture

### AddItemModal (Main)
The orchestrator component that manages:
- Product selection state
- Size selection state
- Purchase form state
- Validation and submission
- Smart defaults from localStorage

### ProductSearch
**Props**: `onProductSelect`, `selectedProduct`
**Features**:
- Tab switching (Search vs Manual SKU)
- Debounced search with visual loading states
- Product selection from results
- Error handling

### ProductCard
**Props**: `product`, `onClear`
**Features**:
- Hero card display with image
- Source badge (StockX/Alias)
- SKU, brand, colorway display
- Clear button to reset selection

### SizeGrid
**Props**: `product`, `selectedSizes`, `onSizeToggle`, `sizeSystem`, `onSizeSystemChange`
**Features**:
- UK/US/EU system tabs
- Grid of clickable size buttons
- Visual selection state
- Uses StockX variants when available, falls back to default grid

### SelectedSizesList
**Props**: `selectedSizes`, `onQuantityChange`, `onRemoveSize`, `onAddCustomSize`
**Features**:
- List of selected sizes with quantities
- Quantity stepper controls
- Remove button per size
- Add custom size input
- Total pairs counter

### PurchaseForm
**Props**: `formData`, `onFieldChange`, `errors`
**Features**:
- All purchase information fields
- Place of purchase combobox with suggestions
- Real-time total calculation
- Field validation errors
- Character counter for notes

## API Endpoints

### GET /api/catalog/search
**Query Params**: `q` (query), `limit` (optional)
**Returns**: Unified product results from StockX and Alias

**Response Format**:
```typescript
{
  results: UnifiedProduct[]
  total: number
  duration_ms: number
}
```

**UnifiedProduct Type**:
```typescript
{
  id: string
  source: 'stockx' | 'alias'
  sku: string
  name: string
  brand: string
  colorway?: string
  imageUrl: string | null
  releaseDate?: string | null
  retailPrice?: number | null
  stockxProductId?: string
  stockxVariants?: Array<{
    id: string
    size: string
    gtins?: string[]
  }>
  aliasCatalogId?: string
}
```

### GET /api/purchase-places
**Returns**: User's purchase place suggestions ordered by last used

**Response Format**:
```json
{
  "suggestions": ["SNKRS", "StockX", "GOAT", ...]
}
```

### POST /api/purchase-places
**Body**: `{ name: string }`
**Action**: Records/updates purchase place usage for current user

## Database Schema

### purchase_places Table
```sql
CREATE TABLE purchase_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

**Purpose**: Store user's frequently used purchase places for autocomplete suggestions

**RLS Policies**: Users can only access their own purchase places

## Setup Instructions

### 1. Apply Database Migration

```bash
# Option 1: Using the project's migration script
node scripts/apply-migration.mjs 20251128_create_purchase_places.sql

# Option 2: Direct SQL (requires DATABASE_URL in .env.local)
psql "$DATABASE_URL" -f supabase/migrations/20251128_create_purchase_places.sql
```

### 2. Verify Dependencies

Dependencies have been installed:
- `lodash` ✓
- `@types/lodash` ✓

### 3. Environment Variables

Ensure you have:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server-side operations
- StockX and Alias API credentials (as per existing setup)

## Usage

The modal is already integrated into your app wherever `AddItemModal` was previously used. The component signature remains the same:

```tsx
<AddItemModal
  open={isOpen}
  onOpenChange={setIsOpen}
  onSuccess={() => {
    // Refresh inventory list
  }}
/>
```

## Behavior Notes

### Multi-Size Creation
When a user selects multiple sizes and quantities:
1. The modal validates all required fields
2. Creates one inventory item per size per quantity
3. For example: Size 9 UK (qty 2) + Size 10 UK (qty 1) = 3 total items created
4. All items share the same purchase price, date, and other details
5. Success message shows total items created

### Smart Defaults
The modal remembers:
- **Size system** (UK/US/EU) - saved to localStorage
- **Tax amount** - saved to localStorage
- **Shipping amount** - saved to localStorage
- **Place of purchase** - saved to localStorage + purchase_places table

### Save & Add Another
When using "Save & Add Another":
1. Items are created successfully
2. Database refreshes
3. Product selection is kept
4. Selected sizes are cleared
5. Purchase price, order number, and notes are reset
6. Other fields keep their smart default values
7. User can immediately select new sizes for the same product

## Color Palette

The vibrant design uses:
- **Primary accent**: `#00FF87` (vibrant green)
- **Primary dark**: `#0A1510` (deep dark green)
- **Elevated surfaces**: `#0E1A15` (slightly lighter)
- **Borders**: `#1D3E2B` (muted green)
- **Text primary**: `#E8F6EE` (light cream)
- **Text secondary**: `#B4D4C3` (light green-gray)
- **Text muted**: `#7FA08F` (green-gray)
- **Text dim**: `#4A6B58` (darker green-gray)

## Future Enhancements

Potential improvements:
1. **Enhanced size conversion** - More accurate UK/US/EU mapping
2. **Product favorites** - Save frequently purchased products
3. **Barcode scanning** - Use device camera for SKU entry
4. **Batch import** - CSV upload for multiple items
5. **Purchase templates** - Save purchase info presets
6. **Image upload** - Add custom product images
7. **Bulk operations** - Edit multiple selected sizes at once

## Rollback Instructions

If you need to revert to the old modal:

```bash
# Restore the backup
mv src/components/modals/AddItemModal.backup.tsx src/components/modals/AddItemModal.tsx

# Remove new component files
rm -rf src/components/modals/AddItemModal/

# Remove new API endpoints (optional)
rm -rf src/app/api/catalog/search/
rm -rf src/app/api/purchase-places/
```

The old modal will work without the new features, but you'll lose the vibrant design and multi-size support.

## Testing Checklist

- [ ] Product search returns results from both StockX and Alias
- [ ] Manual SKU lookup works correctly
- [ ] Product selection updates the hero card
- [ ] Size system switching updates the grid
- [ ] Multiple sizes can be selected
- [ ] Quantity controls work (stepper and direct input)
- [ ] Custom size can be added
- [ ] Purchase place suggestions load and work
- [ ] Form validation catches missing required fields
- [ ] Single item creation works
- [ ] Multiple items creation works (multiple sizes/quantities)
- [ ] "Save & Add Another" keeps product and resets sizes
- [ ] Smart defaults are remembered across sessions
- [ ] Modal closes after successful save
- [ ] Toast notifications appear for errors and success

## Support

For issues or questions:
1. Check browser console for errors
2. Verify database migration was applied successfully
3. Ensure API credentials are configured correctly
4. Review network requests in DevTools
5. Check Supabase logs for RLS or database errors

---

**Built with**: Next.js, React, TypeScript, TailwindCSS, Supabase
**Design inspiration**: StockX listing modals
**Last updated**: November 28, 2025
