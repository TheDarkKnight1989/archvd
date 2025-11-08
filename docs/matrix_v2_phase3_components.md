# Matrix V2 - Phase 3 Components

This document provides usage examples and prop tables for all Matrix V2 Phase 3 components.

---

## 1. ActivityFeedItem

**Purpose**: Timeline card for recent actions (purchases, listings, sales, price alerts).

**Import**:
```typescript
import { ActivityFeedItem, ActivityFeedItemSkeleton } from '@/components/ActivityFeedItem'
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `'purchase' \| 'listing' \| 'sale' \| 'price_alert' \| 'note'` | ✅ | Activity type |
| `title` | `string` | ✅ | Activity title |
| `subtitle` | `string` | ❌ | Subtitle (e.g., marketplace) |
| `timestampISO` | `string` | ✅ | ISO timestamp |
| `thumbUrl` | `string` | ❌ | Thumbnail image URL |
| `amountGBP` | `number` | ❌ | Transaction amount |
| `deltaPct` | `number` | ❌ | Percentage change |
| `tags` | `string[]` | ❌ | Activity tags |
| `cta` | `{ label: string; onClick: () => void }` | ❌ | Call-to-action button |
| `highlight` | `boolean` | ❌ | Use elevated surface |

**Examples**:

```tsx
// Purchase activity
<ActivityFeedItem
  type="purchase"
  title="Purchased — Nike Dunk Low Panda UK9"
  subtitle="StockX"
  timestampISO="2025-11-08T10:30:00Z"
  amountGBP={120}
  tags={['sneaker', 'nike']}
/>

// Sale with delta
<ActivityFeedItem
  type="sale"
  title="Sold — Air Jordan 1 Lost & Found UK9"
  subtitle="eBay"
  timestampISO="2025-11-07T15:00:00Z"
  amountGBP={280}
  deltaPct={15.5}
  highlight
  cta={{ label: 'View details', onClick: () => {} }}
/>

// Loading state
<ActivityFeedItemSkeleton />
```

---

## 2. ReleaseCard

**Purpose**: Upcoming sneaker drop card.

**Import**:
```typescript
import { ReleaseCard, ReleaseCardSkeleton } from '@/components/ReleaseCard'
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `imageUrl` | `string` | ✅ | Product image URL |
| `name` | `string` | ✅ | Product name |
| `brand` | `string` | ✅ | Brand name |
| `colorway` | `string` | ❌ | Colorway description |
| `releaseDateISO` | `string` | ✅ | Release date (ISO) |
| `retailers` | `{ name: string; logoUrl?: string; href?: string }[]` | ✅ | Retailer list |
| `priceGBP` | `number` | ❌ | Retail price |
| `sku` | `string` | ❌ | Product SKU |
| `remindable` | `boolean` | ❌ | Show remind button (default: `true`) |
| `onRemind` | `() => void` | ❌ | Remind callback |
| `onSave` | `() => void` | ❌ | Save callback |

**Examples**:

```tsx
<ReleaseCard
  imageUrl="/images/jordan-1-chicago.jpg"
  name="Air Jordan 1 High OG"
  brand="Nike"
  colorway="Chicago Lost & Found"
  releaseDateISO="2025-11-15T09:00:00Z"
  priceGBP={169.99}
  sku="DZ5485-612"
  retailers={[
    { name: 'Nike', href: 'https://nike.com' },
    { name: 'Footlocker', href: 'https://footlocker.com' },
  ]}
  onRemind={() => console.log('Remind me')}
  onSave={() => console.log('Save')}
/>

// Loading state
<ReleaseCardSkeleton />
```

---

## 3. MarketModal

**Purpose**: Price insights modal with chart, size selector, and time range controls.

**Import**:
```typescript
import { MarketModal } from '@/components/MarketModal'
import type { TimeRange } from '@/components/MarketModal'
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | ✅ | Modal open state |
| `onOpenChange` | `(open: boolean) => void` | ✅ | Open state callback |
| `product` | `{ name: string; sku: string; imageUrl?: string; brand?: string; colorway?: string }` | ✅ | Product info |
| `sizes` | `string[]` | ✅ | Available sizes |
| `activeSize` | `string` | ✅ | Selected size |
| `onSizeChange` | `(size: string) => void` | ✅ | Size change callback |
| `range` | `'7d' \| '30d' \| '90d' \| '1y'` | ✅ | Time range |
| `onRangeChange` | `(range: TimeRange) => void` | ✅ | Range change callback |
| `series` | `{ date: string; price: number }[]` | ✅ | Price data series |
| `sourceBadge` | `string` | ❌ | Data source label |
| `lastUpdatedISO` | `string` | ❌ | Last update timestamp |
| `loading` | `boolean` | ❌ | Loading state |
| `error` | `string` | ❌ | Error message |

**Example**:

```tsx
const [open, setOpen] = useState(false)
const [size, setSize] = useState('UK9')
const [range, setRange] = useState<TimeRange>('30d')

<MarketModal
  open={open}
  onOpenChange={setOpen}
  product={{
    name: 'Air Jordan 1 High OG',
    sku: 'DZ5485-612',
    brand: 'Nike',
    colorway: 'Chicago Lost & Found',
    imageUrl: '/images/jordan-1.jpg',
  }}
  sizes={['UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11']}
  activeSize={size}
  onSizeChange={setSize}
  range={range}
  onRangeChange={setRange}
  series={[
    { date: '2025-10-01', price: 250 },
    { date: '2025-10-15', price: 265 },
    { date: '2025-11-01', price: 280 },
  ]}
  sourceBadge="StockX"
  lastUpdatedISO="2025-11-08T10:00:00Z"
/>
```

---

## 4. SubscriptionRow

**Purpose**: Billing page subscription item.

**Import**:
```typescript
import { SubscriptionRow, SubscriptionRowSkeleton } from '@/components/SubscriptionRow'
import type { SubscriptionStatus, BillingInterval } from '@/components/SubscriptionRow'
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `planName` | `string` | ✅ | Plan name |
| `priceGBP` | `number` | ✅ | Price amount |
| `interval` | `'mo' \| 'yr'` | ✅ | Billing interval |
| `status` | `'active' \| 'past_due' \| 'canceled' \| 'trial'` | ✅ | Subscription status |
| `renewalDateISO` | `string` | ❌ | Next renewal date |
| `seats` | `number` | ❌ | Number of seats |
| `onManage` | `() => void` | ❌ | Manage callback |
| `onUpgrade` | `() => void` | ❌ | Upgrade callback |

**Examples**:

```tsx
<SubscriptionRow
  planName="Pro Plan"
  priceGBP={29}
  interval="mo"
  status="active"
  renewalDateISO="2025-12-08T00:00:00Z"
  seats={3}
  onManage={() => console.log('Manage')}
  onUpgrade={() => console.log('Upgrade')}
/>

// Loading state
<SubscriptionRowSkeleton />
```

---

## 5. PackageRow

**Purpose**: Shipping tracker row.

**Import**:
```typescript
import { PackageRow, PackageRowSkeleton } from '@/components/PackageRow'
import type { ShippingCarrier, ShippingStatus } from '@/components/PackageRow'
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `carrier` | `'RoyalMail' \| 'DPD' \| 'UPS' \| 'Evri' \| 'Other'` | ✅ | Shipping carrier |
| `trackingId` | `string` | ✅ | Tracking number |
| `status` | `'in_transit' \| 'out_for_delivery' \| 'delivered' \| 'exception'` | ✅ | Package status |
| `etaISO` | `string` | ❌ | Estimated arrival |
| `lastUpdateISO` | `string` | ❌ | Last update time |
| `onTrack` | `() => void` | ❌ | Track callback |

**Example**:

```tsx
<PackageRow
  carrier="RoyalMail"
  trackingId="RM123456789GB"
  status="in_transit"
  etaISO="2025-11-10T00:00:00Z"
  lastUpdateISO="2025-11-08T08:30:00Z"
  onTrack={() => window.open('https://track.royalmail.com')}
/>
```

---

## 6. ColumnChooser

**Purpose**: Toggle data-grid columns visibility.

**Import**:
```typescript
import { ColumnChooser } from '@/components/ColumnChooser'
import type { ColumnConfig } from '@/components/ColumnChooser'
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `ColumnConfig[]` | ✅ | Column configurations |
| `onChange` | `(next: { key: string; visible: boolean }[]) => void` | ✅ | Change callback |
| `defaultColumns` | `ColumnConfig[]` | ❌ | Default configuration |

**ColumnConfig Type**:
```typescript
type ColumnConfig = {
  key: string
  label: string
  visible: boolean
  lock?: boolean
}
```

**Example**:

```tsx
const [columns, setColumns] = useState([
  { key: 'sku', label: 'SKU', visible: true, lock: true },
  { key: 'brand', label: 'Brand', visible: true },
  { key: 'model', label: 'Model', visible: true },
  { key: 'size', label: 'Size', visible: false },
])

<ColumnChooser
  columns={columns}
  onChange={(next) => {
    setColumns(cols =>
      cols.map(col => ({
        ...col,
        visible: next.find(n => n.key === col.key)?.visible ?? col.visible
      }))
    )
  }}
  defaultColumns={[
    { key: 'sku', label: 'SKU', visible: true, lock: true },
    { key: 'brand', label: 'Brand', visible: true },
  ]}
/>
```

---

## 7. SavedViewChip

**Purpose**: Saved filter/view shortcut chip.

**Import**:
```typescript
import { SavedViewChip } from '@/components/SavedViewChip'
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ✅ | View label |
| `active` | `boolean` | ❌ | Active state |
| `onApply` | `() => void` | ✅ | Apply view callback |
| `onSave` | `() => void` | ❌ | Save changes callback |
| `onDelete` | `() => void` | ❌ | Delete view callback |

**Example**:

```tsx
<div className="flex gap-2">
  <SavedViewChip
    label="In Stock"
    active
    onApply={() => console.log('Apply In Stock filter')}
    onSave={() => console.log('Save changes')}
    onDelete={() => console.log('Delete view')}
  />
  <SavedViewChip
    label="High Value Items"
    onApply={() => console.log('Apply High Value filter')}
  />
</div>
```

---

## 8. IntegrationCard

**Purpose**: Integration connector card for third-party services.

**Import**:
```typescript
import { IntegrationCard, IntegrationCardSkeleton } from '@/components/IntegrationCard'
import type { IntegrationProvider, IntegrationStatus } from '@/components/IntegrationCard'
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `provider` | `'stockx' \| 'goat' \| 'ebay'` | ✅ | Integration provider |
| `status` | `'connected' \| 'disconnected' \| 'error'` | ✅ | Connection status |
| `accountLabel` | `string` | ❌ | Account identifier |
| `onConnect` | `() => void` | ❌ | Connect callback |
| `onDisconnect` | `() => void` | ❌ | Disconnect callback |
| `onFix` | `() => void` | ❌ | Fix error callback |

**Examples**:

```tsx
<IntegrationCard
  provider="stockx"
  status="connected"
  accountLabel="user@example.com"
  onDisconnect={() => console.log('Disconnect')}
/>

<IntegrationCard
  provider="goat"
  status="disconnected"
  onConnect={() => console.log('Connect to GOAT')}
/>

<IntegrationCard
  provider="ebay"
  status="error"
  accountLabel="seller123"
  onFix={() => console.log('Fix connection')}
/>
```

---

## 9. CurrencySwitcher

**Purpose**: Global currency selector.

**Import**:
```typescript
import { CurrencySwitcher } from '@/components/CurrencySwitcher'
import type { Currency } from '@/components/CurrencySwitcher'
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `'GBP' \| 'EUR' \| 'USD'` | ✅ | Selected currency |
| `onChange` | `(currency: Currency) => void` | ✅ | Change callback |
| `className` | `string` | ❌ | Additional CSS classes |

**Example**:

```tsx
const [currency, setCurrency] = useState<Currency>('GBP')

<CurrencySwitcher
  value={currency}
  onChange={setCurrency}
/>
```

---

## Matrix V2 Compliance

All components adhere to Matrix V2 design system:

✅ **Surfaces**: `bg-elev-1`, `bg-elev-2`, `gradient-elev`
✅ **Borders**: `border-border`, `border-border/40`
✅ **Motion**: 120ms for UI, 200ms for charts
✅ **Typography**: Inter (body), JetBrains Mono (numbers), Cinzel (headings)
✅ **States**: Skeleton, Empty, Error handling
✅ **A11y**: Focus rings, ARIA labels, keyboard navigation
✅ **Glows**: `glow-accent-hover` on interactive elements

---

## Component Placement

- **ActivityFeedItem**: Dashboard activity feed, Inventory activity sidebar
- **ReleaseCard**: `/dashboard/releases`, Dashboard "Upcoming" section
- **MarketModal**: Product rows/cards (Inventory, Dashboard top movers)
- **SubscriptionRow**: `/dashboard/settings/billing`
- **PackageRow**: `/dashboard/packages`
- **ColumnChooser**: Table toolbars (Inventory, Expenses, P&L)
- **SavedViewChip**: Table toolbars (Inventory, Expenses, P&L)
- **IntegrationCard**: `/dashboard/settings/integrations`
- **CurrencySwitcher**: Dashboard header, Global toolbar
