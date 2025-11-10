# Boutique Redesign Progress

## Overview
Transitioning archvd from Matrix theme to premium Boutique aesthetic inspired by Kith, Aimé Leon Dore, and modern SaaS dashboards.

**Design Philosophy:** Premium collector's portfolio — refined, neutral, calm, and confident.

---

## ✅ Completed

### 1. Design System Foundation
- **New color palette implemented:**
  - Light mode: `#F7F7F5` (bg), `#FFFFFF` (surface), `#C4A484` (beige accent)
  - Dark mode: `#121212` (bg), `#1C1C1C` (surface), same beige accent
  - Profit/Loss: Muted green (#3E8E60/#74C39A) and red (#B24444/#E07A7A)

- **Typography system:**
  - Display font: DM Sans (alternative to Neue Haas Display)
  - Body/UI font: Inter
  - Monospace: SF Mono (for numbers/data)
  - Updated heading hierarchy with tighter tracking

- **Shadow system:**
  - Removed Matrix glow effects
  - Added soft/medium/large elevation shadows
  - Light, layered shadows for depth

- **Transitions:**
  - Boutique timing (120ms ease-out)
  - Smooth, subtle animations
  - Respects prefers-reduced-motion

### 2. Core Components Updated

#### Button Component
- ✅ Beige accent (#C4A484) as default
- ✅ Clean hover states (no glow)
- ✅ Outline and ghost variants
- ✅ New secondary variant (soft background)
- ✅ Reduced disabled opacity (40%)

#### Card Component
- ✅ Named elevation props (soft/medium/large)
- ✅ Increased padding for breathing room
- ✅ Display font for titles
- ✅ Better typography hierarchy

### 3. CSS Architecture
- ✅ New utility classes:
  - `.profit-text`, `.loss-text`, `.profit-bg`, `.loss-bg`
  - `.label-uppercase` for table headers
  - `.elevation-soft/medium/large`
  - `.hover-elevate`
  - `.transition-boutique`

---

## 🚧 In Progress / TODO

### High Priority Components

#### KPI Cards
- [ ] Remove Matrix border glows
- [ ] Update to soft shadows
- [ ] Use display font for titles
- [ ] Uppercase labels for metrics
- [ ] Increase padding

#### Tables (ItemsTable, InventoryTable, SalesTable)
- [ ] Right-align numeric columns
- [ ] Monospace font for numbers
- [ ] Uppercase, letter-spaced headers
- [ ] Subtle zebra stripes (sand tint)
- [ ] Remove Matrix accents

#### Modals
- [ ] QuickAddModal: warm backdrop, blur
- [ ] AddItemModal: update styling
- [ ] MarkAsSoldModal: Boutique aesthetic
- [ ] Remove green accents, use beige

#### Breakdown Cards
- [ ] Update chart colors to Boutique palette
- [ ] Remove Matrix styling
- [ ] Soft shadows

### Medium Priority

#### Portfolio Overview
- [ ] Update spacing and layout
- [ ] Refine visual hierarchy
- [ ] Polish hover states

#### Activity Feed
- [ ] Update profit/loss colors
- [ ] Improve density
- [ ] Better transitions

#### Navigation/Sidebar
- [ ] Update active states to beige
- [ ] Remove Matrix indicators
- [ ] Clean, minimal aesthetic

### Lower Priority

#### Form Components
- [ ] Input fields
- [ ] Select dropdowns
- [ ] Checkboxes/radio buttons

#### Other UI Elements
- [ ] Tooltips
- [ ] Badges
- [ ] Progress indicators
- [ ] Loading states

---

## Design Tokens Reference

```css
/* Light Mode */
--archvd-bg: #F7F7F5
--archvd-surface: #FFFFFF
--archvd-soft: #F1EFEA
--archvd-fg: #111111
--archvd-muted: #6A6A6A
--archvd-accent: #C4A484
--archvd-border: rgba(0, 0, 0, 0.06)

/* Dark Mode */
--archvd-bg: #121212
--archvd-surface: #1C1C1C
--archvd-soft: #161616
--archvd-fg: #F2F2F2
--archvd-muted: #A0A0A0
--archvd-accent: #C4A484
--archvd-border: rgba(255, 255, 255, 0.07)

/* Profit/Loss */
--archvd-profit: #3E8E60 (light) / #74C39A (dark)
--archvd-loss: #B24444 (light) / #E07A7A (dark)
```

---

## Next Steps

1. **Immediate:** Update KPI cards and tables (highest visual impact)
2. **Then:** Modals and overlays
3. **Finally:** Polish interactions, hover states, and micro-animations

The foundation is solid. Each component update should be straightforward now that the design system is in place.

---

## Notes

- All Matrix green (#00FF94) replaced with beige (#C4A484)
- No glow effects anywhere
- Maintain profit/loss color coding throughout
- Typography: generous spacing, clear hierarchy
- Motion: subtle, 120ms transitions
