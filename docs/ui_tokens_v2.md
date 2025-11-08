# Matrix V2 – UI Tokens & Design System

**Version:** 2.0
**Date:** 2025-11-08
**Status:** Phase 2 Complete (Visual Depth Foundation)

---

## 1. Elevation Tokens

### Scale (0–3)
The elevation system creates visual hierarchy through background layers:

| Token | CSS Variable | Hex | Usage |
|-------|-------------|-----|-------|
| `bg-elev-0` | `--archvd-bg-elev-0` | `#050807` | Page shell, header backgrounds |
| `bg-elev-1` | `--archvd-bg-elev-1` | `#08100C` | Standard cards, tables, data containers |
| `bg-elev-2` | `--archvd-bg-elev-2` | `#0B1510` | Raised cards, KPIs, feature highlights, table headers |
| `bg-elev-3` | `--archvd-bg-elev-3` | `#0E1A15` | Modals, dialogs, dropdowns, tooltips |

### Implementation
```tsx
// Card component with elevation prop
<Card elevation={2} className="p-4">
  {/* KPI content */}
</Card>

// Direct usage
<div className="bg-elev-1 border border-border rounded-xl">
  {/* Table or card content */}
</div>
```

### Usage Guidelines
- **Page shells/headers:** Always use `bg-elev-0` for base surfaces
- **Data cards/tables:** Use `bg-elev-1` for standard containers
- **Feature cards/KPIs:** Use `bg-elev-2` for emphasis
- **Modals/overlays:** Use `bg-elev-3` for highest layer elements
- **Borders:** Keep `border-border` across all elevations – no new border colors

---

## 2. Gradient Utility (Subtle Depth)

### Class: `.gradient-elev`
Creates a subtle vertical gradient from elevation 1 to elevation 2 (6–8% intensity).

```css
.gradient-elev {
  background: linear-gradient(
    180deg,
    var(--archvd-bg-elev-1) 0%,
    var(--archvd-bg-elev-2) 100%
  );
}
```

### Usage Guidelines
- **Allowed:** KPI cards, hero/feature cards, analytics cards
- **Not allowed:** Tables, dense lists, data rows (maintain flat surfaces for readability)
- **Combine with:** elevation 2 and glow-accent-hover for maximum impact

```tsx
// Good: KPI card with gradient
<Card elevation={2} className="gradient-elev glow-accent-hover p-4">
  <div className="text-xs text-muted">Revenue</div>
  <div className="text-2xl font-bold">{value}</div>
</Card>

// Bad: Don't use on tables
<div className="gradient-elev"> {/* ❌ */}
  <table>...</table>
</div>
```

---

## 3. Accent Glow Utility (Measured)

### Class: `.glow-accent-hover`
Adds a subtle Matrix-green glow on hover/focus states only.

```css
.glow-accent-hover {
  transition: box-shadow 120ms cubic-bezier(.22,.61,.36,1);
}

.glow-accent-hover:hover,
.glow-accent-hover:focus-visible {
  box-shadow: var(--archvd-glow-accent);
}
```

**Glow definition:**
```css
--archvd-glow-accent: 0 0 0 1px #0C6C51, 0 0 24px #00FF9440;
```

### Usage Guidelines
- **Apply to:**
  - Primary action buttons
  - Active tab/list states
  - KPI/feature cards (interactive states)
  - FAB buttons
- **Don't apply to:**
  - Static body content
  - Table rows (use bg-elev-2 hover instead)
  - Disabled elements

```tsx
// Good: Interactive button with glow
<button className="bg-accent text-black glow-accent-hover">
  Add Item
</button>

// Good: KPI card with glow on hover
<Card elevation={2} className="gradient-elev glow-accent-hover">
  {/* ... */}
</Card>

// Bad: Table row (use elevation hover instead)
<tr className="hover:bg-elev-2"> {/* ✓ */}
  {/* ... */}
</tr>
```

---

## 4. Branded Skeleton Pattern

### Class: `.skeleton`
Matrix-themed loading skeleton with scanline texture and shimmer animation.

```css
.skeleton {
  position: relative;
  background-color: var(--archvd-bg-elev-1);
  overflow: hidden;
  border-radius: 0.5rem;
}

.skeleton::before {
  /* Shimmer overlay */
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 255, 148, 0.03) 50%,
    transparent 100%
  );
  animation: skeleton-shimmer 2s ease-in-out infinite;
}

.skeleton::after {
  /* Scanline texture */
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 148, 0.02) 2px,
    rgba(0, 255, 148, 0.02) 4px
  );
  opacity: 0.5;
}

@keyframes skeleton-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  .skeleton::before {
    animation: none;
  }
}
```

### Component Integration
The Skeleton component automatically uses this pattern:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

// Loading state
{loading && (
  <div className="space-y-2">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-8 w-full" />
  </div>
)}
```

### Usage by Component Type

| Component | Skeleton Usage |
|-----------|---------------|
| KPI Cards | Value + label (2 skeletons) |
| Tables | 6 rows × columns |
| Charts | Full card shimmer (single skeleton) |
| Forms | Input + button (2–3 skeletons) |

---

## 5. A11y & Performance Guardrails

### Contrast Requirements
- **bg-elev-0:** Minimum 12:1 contrast with foreground text
- **bg-elev-1/2/3:** Minimum 7:1 contrast with foreground text
- **Text-dim:** Never used below 12px font size

### Motion Preferences
- **UI transitions:** 120ms (fast interactions)
- **Chart motions:** 200ms (data animations)
- **Respect `prefers-reduced-motion`:** Skeleton shimmer disabled when user preference is set

### Neon Control
- **Accents:** Used only for actions, active states, and subtle keylines
- **Body text:** Never use green for body content
- **Glow:** Only on hover/focus, never static

### Performance
- All CSS utilities use GPU-accelerated properties where possible
- Skeleton animations use `transform` (not `left/right`)
- Glow transitions use `box-shadow` with minimal re-paint

---

## 6. Component-Specific Guidelines

### KPI Cards
```tsx
<Card elevation={2} className="p-4 gradient-elev glow-accent-hover">
  <div className="text-xs text-muted uppercase tracking-wide mb-1">
    Revenue
  </div>
  <div className="text-2xl font-bold text-fg font-mono">
    £12,345
  </div>
</Card>
```

**Features:**
- Elevation 2 with gradient
- Glow on hover
- Monospace numbers

### Data Tables
```tsx
<div className="bg-elev-1 border border-border rounded-xl overflow-hidden">
  <table className="w-full">
    <thead className="bg-elev-2 border-b border-border">
      {/* Headers */}
    </thead>
    <tbody className="divide-y divide-border">
      <tr className="hover:bg-elev-2 transition-colors">
        {/* Cells */}
      </tr>
    </tbody>
  </table>
</div>
```

**Features:**
- Container: elevation 1
- Header: elevation 2
- Row hover: elevation 2
- No gradients

### Buttons
```tsx
// Primary action
<button className="bg-accent text-black glow-accent-hover hover:bg-accent-600">
  Add Item
</button>

// Secondary action
<Button variant="outline" className="glow-accent-hover">
  Export
</Button>
```

### FAB (Floating Action Button)
```tsx
<button className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-accent text-black glow-accent-hover">
  <Plus className="h-6 w-6" />
</button>
```

---

## 7. Migration Checklist

When updating existing components to Matrix V2:

- [ ] Replace `bg-surface` with `bg-elev-1`
- [ ] Replace `bg-surface2` with `bg-elev-2` (for emphasis)
- [ ] Add `bg-elev-0` to page shells/headers
- [ ] Add `gradient-elev` to KPI/feature cards
- [ ] Add `glow-accent-hover` to interactive elements
- [ ] Replace old skeleton with new `.skeleton` class
- [ ] Update table headers to `bg-elev-2`
- [ ] Update row hovers to `hover:bg-elev-2`
- [ ] Verify contrast ratios (use browser DevTools)
- [ ] Test with `prefers-reduced-motion` enabled

---

## 8. Examples

### Dashboard KPI Section (Real Implementation)
From [/src/app/dashboard/components/KpiCard.tsx](/src/app/dashboard/components/KpiCard.tsx):

```tsx
export function KpiCard({ label, value, delta, period, loading }: KpiCardProps) {
  if (loading) {
    return (
      <Card elevation={2} className="p-4 md:p-5 gradient-elev">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-3 w-24" />
          {period && <Skeleton className="h-5 w-8" />}
        </div>
        <Skeleton className="h-8 w-32 mt-2" />
        {delta !== undefined && <Skeleton className="h-4 w-16 mt-2" />}
      </Card>
    )
  }

  return (
    <Card elevation={2} className="p-4 md:p-5 gradient-elev glow-accent-hover">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        {period && (
          <Badge variant="outline" className="text-[11px] px-2 py-0.5">
            {period}
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="num text-2xl md:text-3xl font-semibold text-fg">
          {value}
        </span>
        {delta !== undefined && (
          <span className={`text-sm font-mono flex items-center gap-1 ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
    </Card>
  )
}

// Usage in /src/app/dashboard/page.tsx:
<div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
  <KpiCard label="Total Items" value={kpiStats.data.totalItems} loading={kpiStats.loading} />
  <KpiCard label="In Stock" value={kpiStats.data.inStock} loading={kpiStats.loading} />
  <KpiCard label="Sold" value={kpiStats.data.sold} loading={kpiStats.loading} />
  <KpiCard
    label="Inventory Value"
    value={gbp0.format(kpiStats.data.totalValue)}
    loading={kpiStats.loading}
  />
</div>
```

**Key Features:**
- Loading state uses Matrix skeleton pattern
- Loaded state: elevation 2 + gradient + glow on hover
- Supports optional delta (trend) and period badge
- Monospace numbers with semantic color (success/danger)

### Inventory Table (Real Implementation)
From [/src/app/dashboard/inventory/page.tsx](/src/app/dashboard/inventory/page.tsx):

```tsx
<Card elevation={1} className="border border-border rounded-2xl overflow-hidden">
  {loading ? (
    <div className="p-3 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  ) : filteredItems.length === 0 ? (
    <div className="text-center py-10 text-dim">
      <p className="font-mono text-sm">
        {items.length === 0 ? 'No items yet • Add your first pair!' : 'No results • Try adjusting your filters.'}
      </p>
    </div>
  ) : (
    <div className="max-h-[70vh] overflow-auto">
      <Table className="min-w-[920px]">
        <TableHeader className="text-muted text-xs bg-elev-2 sticky top-0 z-10">
          <TableRow className="border-border border-t border-t-accent-400/25">
            <TableHead className="px-3 md:px-4 py-3">SKU</TableHead>
            <TableHead className="px-3 md:px-4 py-3">Brand</TableHead>
            <TableHead className="px-3 md:px-4 py-3">Model</TableHead>
            <TableHead className="px-3 md:px-4 py-3">Size</TableHead>
            <TableHead className="px-3 md:px-4 py-3 text-right">Purchase</TableHead>
            <TableHead className="px-3 md:px-4 py-3 text-right">Market</TableHead>
            <TableHead className="px-3 md:px-4 py-3 text-right">P/L</TableHead>
            <TableHead className="px-3 md:px-4 py-3">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredItems.map((item) => {
            const pl = item.market_value && item.purchase_price ? item.market_value - item.purchase_price : null
            const gain = pl !== null && pl > 0
            const loss = pl !== null && pl < 0

            return (
              <TableRow key={item.id} className="border-border hover:bg-elev-2 h-12">
                <TableCell className="px-3 md:px-4 py-3 font-mono text-xs">{item.sku}</TableCell>
                <TableCell className="px-3 md:px-4 py-3 text-sm">{item.brand}</TableCell>
                <TableCell className="px-3 md:px-4 py-3 text-sm">{item.model}</TableCell>
                <TableCell className="px-3 md:px-4 py-3 text-sm">{item.size}</TableCell>
                <TableCell className="px-3 md:px-4 py-3 font-mono text-sm text-right">
                  {gbp2.format(item.purchase_price)}
                </TableCell>
                <TableCell className="px-3 md:px-4 py-3 font-mono text-sm text-right">
                  {item.market_value ? (
                    <div>
                      <div>{gbp2.format(item.market_value)}</div>
                      {item.market_meta?.sources_used?.[0] && item.market_updated_at && (
                        <div className="mt-0.5 text-[10px] text-dim font-mono flex items-center justify-end gap-1">
                          <span className="h-1 w-1 rounded-full bg-accent" />
                          {item.market_meta.sources_used[0]} • {formatRelativeTime(item.market_updated_at)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-dim">—</span>
                  )}
                </TableCell>
                <TableCell className="px-3 md:px-4 py-3 font-mono text-sm text-right">
                  {pl === null || pl === 0 ? (
                    <span className="text-dim">—</span>
                  ) : (
                    <div className={cn('inline-flex items-center gap-1', gain && 'text-accent', loss && 'text-danger')}>
                      {gain && <TrendingUp className="h-3.5 w-3.5" />}
                      {loss && <TrendingDown className="h-3.5 w-3.5" />}
                      <span>{gbp2.format(pl)}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="px-3 md:px-4 py-3">
                  <Badge variant="outline" className="border-border text-xs capitalize">
                    {item.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )}
</Card>
```

**Key Features:**
- Card container: elevation 1
- Table header: bg-elev-2 (sticky)
- Row hover: bg-elev-2
- Loading state: Matrix skeleton (6 rows, h-12 each)
- Market value cell: shows source + relative time with accent indicator dot
- P/L cell: TrendingUp/Down icons with semantic colors
- NO gradients on tables (flat surfaces for readability)

### P&L Table with Footer (Real Implementation)
From [/src/app/dashboard/expenses/page.tsx](/src/app/dashboard/expenses/page.tsx):

```tsx
<Card elevation={1} className="border border-border rounded-2xl overflow-hidden">
  {loading ? (
    <div className="p-3 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  ) : (
    <>
      <div className="max-h-[70vh] overflow-auto">
        <Table className="min-w-[720px]">
          <TableHeader className="text-muted text-xs bg-elev-2 sticky top-0 z-10">
            <TableRow className="border-border border-t border-t-accent-400/25">
              <TableHead className="px-3 md:px-4 py-3">Date</TableHead>
              <TableHead className="px-3 md:px-4 py-3">Description</TableHead>
              <TableHead className="px-3 md:px-4 py-3">Category</TableHead>
              <TableHead className="px-3 md:px-4 py-3 text-right">Amount</TableHead>
              <TableHead className="px-3 md:px-4 py-3 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.map((expense) => (
              <TableRow key={expense.id} className="border-border hover:bg-elev-2 h-12">
                <TableCell className="px-3 md:px-4 py-3 font-mono text-xs">
                  {formatUKDate(expense.date)}
                </TableCell>
                <TableCell className="px-3 md:px-4 py-3 text-sm">{expense.description}</TableCell>
                <TableCell className="px-3 md:px-4 py-3">
                  <Badge variant="outline" className="border-border text-xs capitalize">
                    {expense.category}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 md:px-4 py-3 font-mono text-sm text-right">
                  {gbp2.format(expense.amount)}
                </TableCell>
                <TableCell className="px-3 md:px-4 py-3 text-center">
                  <button className="inline-flex items-center gap-1 px-2 py-1 text-xs text-danger hover:text-danger/80 font-medium">
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Total Footer - elevation 2 for emphasis */}
      <div className="border-t border-border bg-elev-2 px-4 py-3 flex justify-between items-center">
        <span className="text-sm font-medium text-muted">
          Total ({filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'})
        </span>
        <span className="text-lg font-bold text-fg font-mono">{gbp2.format(totalExpenses)}</span>
      </div>
    </>
  )}
</Card>
```

**Key Features:**
- Footer uses bg-elev-2 to visually separate from table body
- Totals row has semantic meaning (elevation + bold typography)
- Sticky header remains visible during scroll
- Loading skeleton maintains 6-row pattern

---

## 9. Troubleshooting

### Gradient not showing
- Ensure you're using both `bg-elev-2` and `gradient-elev` (gradient overrides bg)
- Check element has height/content

### Glow not appearing
- Verify element is interactive (`:hover` or `:focus-visible`)
- Check `--archvd-glow-accent` is defined in globals.css

### Skeleton not animating
- Confirm element has `.skeleton` class
- Check user's `prefers-reduced-motion` setting
- Verify element has explicit height/width

### Contrast issues
- Use browser DevTools contrast checker
- Never use `text-dim` below 12px
- Test on actual device (not just simulator)

---

## 10. File Reference

| File | Purpose |
|------|---------|
| [/src/app/globals.css](/src/app/globals.css) | Elevation tokens, gradient, glow, skeleton CSS |
| [/tailwind.config.ts](/tailwind.config.ts) | Elevation utilities mapping |
| [/src/components/ui/card.tsx](/src/components/ui/card.tsx) | Card with elevation prop |
| [/src/components/ui/skeleton.tsx](/src/components/ui/skeleton.tsx) | Branded skeleton component |
| [/src/app/dashboard/components/KpiCard.tsx](/src/app/dashboard/components/KpiCard.tsx) | Example KPI implementation |

---

## 11. Version History

### V2.0 (Phase 2 – Visual Depth) – 2025-11-08
- **Added:** 4-level elevation system (0-3)
- **Added:** Gradient utility for KPI/feature cards
- **Added:** Accent glow utility for interactive states
- **Added:** Branded Matrix skeleton with reduced-motion support
- **Updated:** Card component with elevation prop
- **Updated:** Skeleton component with Matrix pattern
- **Applied:** /dashboard and /dashboard/pnl pages

### V1.0 (Foundation) – Previous
- Matrix color tokens
- Typography system
- Basic card/button components

---

**Next Steps (Phase 3+):**
- Apply to remaining dashboard pages (/inventory, /expenses, /market, /releases)
- Chart elevation patterns
- Form input elevation patterns
- Modal/dialog elevation (elev-3) patterns
