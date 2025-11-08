# AddItemModal - Usage Guide

## Overview

The `AddItemModal` is a premium Matrix V2-styled modal for adding new inventory items. It includes comprehensive form validation, auto-fill functionality, and a polished user experience.

## Basic Usage

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddItemModal } from '@/components/modals/AddItemModal'

export default function InventoryPage() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div>
      {/* Trigger Button */}
      <Button
        onClick={() => setModalOpen(true)}
        className="bg-accent text-black hover:bg-accent-600 glow-accent-hover"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Item
      </Button>

      {/* Modal */}
      <AddItemModal
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  )
}
```

## Components Created

### 1. Main Components

- **`AddItemModal.tsx`** - Main modal component with all fields and validation
- **`ModalFooter.tsx`** - Reusable footer with Save/Cancel/Save & Add Another buttons

### 2. Form Components

- **`SizeSelector.tsx`** - Grid selector for UK sizes 3-16 (incl. halves) or clothing sizes
- **`TagInput.tsx`** - Token-style tag input with keyboard support
- **`WatchlistCombobox.tsx`** - Searchable combobox with inline create-new functionality

### 3. UI Components (Supporting)

- **`Label.tsx`** - Form label component
- **`Textarea.tsx`** - Textarea with Matrix V2 styling
- **`Command.tsx`** - Command palette primitives for combobox

## Features

### All Fields Included

1. **Name*** (required)
2. **Style ID / SKU** - Auto-fills brand/colorway/name on blur
3. **Brand**
4. **Colorway**
5. **Condition*** - Select: New/Used/Worn/Defect
6. **Category Tabs*** - Shoes/Clothes/Other
7. **Size Grid** - Single-select with category-specific sizes
8. **Other Size** - Text input for custom sizes
9. **Purchase Price*** (£) - Required, right-aligned
10. **Tax** (£) - Optional
11. **Shipping** (£) - Optional
12. **Purchase Total** - Auto-computed (price + tax + shipping)
13. **Place of Purchase** - Dropdown: SNKRS/StockX/GOAT/etc.
14. **Purchase Date*** - Date picker
15. **Order Number** - Optional text
16. **Tags** - Token input (press Enter to add)
17. **Watchlist** - Combobox with create-new inline
18. **Custom Market Value** - Toggle + numeric input
19. **Notes** - Textarea with 250 char counter

### Matrix V2 Styling Applied

✅ **Modal Surface**: bg-elev-2 with shadow-elev
✅ **Focused Inputs**: Accent glow (green 25% opacity)
✅ **Numeric Inputs**: Right-aligned with `.num` class
✅ **Section Borders**: border-border/40
✅ **Transitions**: 120ms ease-terminal
✅ **Primary Button**: bg-accent text-black with glow
✅ **Secondary Button**: Outline variant
✅ **Category Tabs**: Active state with accent glow
✅ **Size Grid**: Active selection with Matrix green highlight

### Form Validation

- **Zod Schema**: Client-side validation with inline errors
- **Required Fields**: Name, Purchase Price, Purchase Date, Condition, Category
- **Character Limits**: Notes max 250 characters
- **Inline Errors**: Red border + error text under invalid fields
- **Real-time Validation**: Errors clear as user types

### User Experience

✅ **Auto-fill on SKU Blur** - Mock API call to `/api/market/[sku]` (500ms delay)
✅ **Computed Subtotal** - Live calculation of purchase total
✅ **Save & Add Another** - Keeps modal open, resets form (preserves category)
✅ **Success Toast** - Matrix-styled glow toast on successful save
✅ **Mock Submit Handler** - 1s delay to simulate API call
✅ **Keyboard Support** - Esc closes modal, Tab navigation
✅ **Accessible** - aria-modal, keyboard-friendly
✅ **Responsive** - 3-column grid on desktop, single column on mobile

## Integration with Supabase

To connect to your Supabase database, replace the mock submit handler in `AddItemModal.tsx`:

```tsx
// Replace this section in handleSubmit:
try {
  // Mock API call with 1s delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  console.log('Form submitted:', formData)

  // REPLACE WITH:
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id

  if (!userId) {
    throw new Error('No authenticated user found')
  }

  const { error } = await supabase.from('Inventory').insert({
    user_id: userId,
    name: formData.name,
    sku: formData.styleId,
    brand: formData.brand,
    colorway: formData.colorway,
    condition: formData.condition,
    category: formData.category,
    size: formData.size || formData.sizeAlt,
    purchase_price: parseFloat(formData.purchasePrice),
    tax: formData.tax ? parseFloat(formData.tax) : null,
    shipping: formData.shipping ? parseFloat(formData.shipping) : null,
    place_of_purchase: formData.placeOfPurchase,
    purchase_date: formData.purchaseDate,
    order_number: formData.orderNumber,
    watchlist_id: formData.watchlist,
    custom_market_value: formData.customMarketValue ? parseFloat(formData.customMarketValue) : null,
    notes: formData.notes,
    tags: formData.tags,
  })

  if (error) throw error

  // ... rest of success handling
}
```

## Customization

### Change Validation Rules

Edit the Zod schema in `AddItemModal.tsx`:

```tsx
const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"), // Add min length
  purchasePrice: z.string()
    .min(1, "Purchase price is required")
    .refine((val) => parseFloat(val) > 0, "Price must be greater than 0"), // Add custom validation
  // ... other fields
})
```

### Add More Fields

1. Add to `FormData` type
2. Add to initial `formData` state
3. Add field in the appropriate section
4. Update Zod schema if validation needed

### Modify Styling

All styling uses Matrix V2 tokens. To adjust:

- Modal width: Change `max-w-[900px]` in DialogContent
- Grid columns: Modify `grid-cols-1 md:grid-cols-3`
- Colors: Use `bg-elev-{0,1,2,3}`, `text-{fg,muted,dim}`, `border-border`

## Keyboard Shortcuts

- **Esc** - Close modal
- **Tab** - Navigate between fields
- **Enter** - Submit form (when Save button focused)
- **Enter in Tags** - Add new tag
- **Backspace in Tags** - Remove last tag (when input empty)

## Accessibility

✅ aria-modal on dialog
✅ Proper label associations
✅ Focus management
✅ Keyboard navigation
✅ Screen reader friendly
✅ Error announcements

## Files Modified/Created

### Created (10 files):
1. `/src/components/modals/AddItemModal.tsx` - Main modal
2. `/src/components/modals/ModalFooter.tsx` - Reusable footer
3. `/src/components/forms/SizeSelector.tsx` - Size grid selector
4. `/src/components/forms/TagInput.tsx` - Tag token input
5. `/src/components/forms/WatchlistCombobox.tsx` - Searchable combobox
6. `/src/components/ui/label.tsx` - Label component
7. `/src/components/ui/textarea.tsx` - Textarea component
8. `/src/components/ui/command.tsx` - Command primitives
9. `/docs/AddItemModal_Usage.md` - This documentation

### No Files Modified
All components are new and don't modify existing code.

## Testing Checklist

- [ ] Modal opens from trigger button
- [ ] All fields render correctly
- [ ] Size grid changes based on category (Shoes vs Clothes)
- [ ] Style ID blur triggers mock API call
- [ ] Purchase total computes correctly
- [ ] Tags can be added/removed with keyboard
- [ ] Watchlist combobox searches and creates new items
- [ ] Custom market value toggle shows/hides field
- [ ] Notes character counter updates
- [ ] Form validation shows inline errors
- [ ] Save button disabled while submitting
- [ ] Success toast appears on save
- [ ] Save & Add Another resets form but keeps category
- [ ] Save closes modal after 1.5s
- [ ] Modal closes on Esc key
- [ ] Responsive layout works on mobile
- [ ] No console errors
- [ ] No hydration errors

## Next Steps

1. **Replace mock submit** with actual Supabase insert
2. **Replace mock SKU lookup** with real `/api/market/[sku]` endpoint
3. **Load watchlists** from Supabase instead of mock data
4. **Add image upload** field (optional enhancement)
5. **Integrate with existing inventory page** by replacing old form

---

**Version**: 1.0
**Last Updated**: 2025-11-08
**Matrix V2 Compliance**: ✅ Full
