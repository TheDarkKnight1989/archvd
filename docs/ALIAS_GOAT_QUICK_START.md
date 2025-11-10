# GOAT API Integration - Quick Start Guide

This guide walks you through the first steps to integrate the Alias (GOAT) API into ArchVD.

---

## Prerequisites

1. **GOAT API Access**: Contact Alias/GOAT for API access
   - Get API base URL (likely `https://www.goat.com/api/v1` or `https://api.alias.org`)
   - Obtain API credentials (access token or OAuth client ID/secret)
   - Review official API documentation for any changes

2. **Environment Setup**: Add to `.env.local`
   ```bash
   GOAT_API_URL=https://www.goat.com/api/v1
   GOAT_ACCESS_TOKEN=your_token_here
   # OR for OAuth:
   GOAT_CLIENT_ID=your_client_id
   GOAT_CLIENT_SECRET=your_client_secret
   ```

---

## Step 1: Database Migration

Add GOAT-related columns to the `Inventory` table:

```sql
-- File: supabase/migrations/20251114_goat_integration.sql

-- Add GOAT tracking columns to Inventory
ALTER TABLE "Inventory"
  ADD COLUMN goat_listing_id TEXT UNIQUE,
  ADD COLUMN goat_product_id TEXT,
  ADD COLUMN goat_status TEXT CHECK (goat_status IN ('draft', 'listed', 'sold', 'cancelled', NULL)),
  ADD COLUMN goat_price NUMERIC(10,2),
  ADD COLUMN goat_listed_at TIMESTAMPTZ,
  ADD COLUMN goat_last_sync TIMESTAMPTZ,
  ADD COLUMN goat_sync_status TEXT DEFAULT 'synced' CHECK (goat_sync_status IN ('synced', 'pending', 'error'));

CREATE INDEX idx_inventory_goat_listing ON "Inventory"(goat_listing_id) WHERE goat_listing_id IS NOT NULL;
CREATE INDEX idx_inventory_goat_status ON "Inventory"(goat_status) WHERE goat_status IS NOT NULL;

COMMENT ON COLUMN "Inventory".goat_listing_id IS 'GOAT listing ID if item is listed on GOAT marketplace';
COMMENT ON COLUMN "Inventory".goat_status IS 'Status of GOAT listing (listed, sold, cancelled)';

-- Add GOAT token storage to profiles
ALTER TABLE profiles
  ADD COLUMN goat_access_token TEXT,
  ADD COLUMN goat_refresh_token TEXT,
  ADD COLUMN goat_token_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.goat_access_token IS 'Encrypted GOAT API access token (if user connected GOAT account)';
```

Apply migration:
```bash
# Via Supabase Dashboard SQL Editor:
# 1. Copy the SQL above
# 2. Go to Supabase Dashboard → SQL Editor
# 3. Paste and run

# OR via psql:
psql "$DATABASE_URL" -f supabase/migrations/20251114_goat_integration.sql
```

---

## Step 2: Test API Connection

Create a test script to verify GOAT API access:

```typescript
// scripts/test-goat-api.ts

import { createGoatClient, GoatProductsService } from '@/lib/services/goat';

async function testGoatAPI() {
  console.log('Testing GOAT API connection...\n');

  // 1. Create client
  const client = createGoatClient({
    apiUrl: process.env.GOAT_API_URL,
    accessToken: process.env.GOAT_ACCESS_TOKEN,
  });

  // 2. Test product search
  console.log('🔍 Testing product search...');
  const productsService = new GoatProductsService(client);

  try {
    const results = await productsService.search({
      query: 'Air Jordan 1',
      limit: 5,
    });

    console.log(`✅ Found ${results.total} products`);
    console.log('First result:', results.results[0]?.name || 'None');
  } catch (error) {
    console.error('❌ Product search failed:', error);
    return;
  }

  // 3. Test product details
  console.log('\n📦 Testing product details...');
  const firstResult = results.results[0];
  if (firstResult) {
    try {
      const product = await productsService.getBySlug(firstResult.slug);
      console.log(`✅ Product: ${product.brand} ${product.model}`);
      console.log(`   Retail: £${product.retailPrice}`);
      console.log(`   Release: ${product.releaseDate}`);
    } catch (error) {
      console.error('❌ Product details failed:', error);
    }
  }

  // 4. Test buy bar data (pricing)
  console.log('\n💰 Testing buy bar data (pricing)...');
  if (firstResult) {
    try {
      const buyBarData = await productsService.getBuyBarData(firstResult.id);
      console.log(`✅ Pricing data for ${buyBarData.variants.length} sizes`);

      const firstVariant = buyBarData.variants[0];
      if (firstVariant) {
        console.log(`   ${firstVariant.size}: Ask £${firstVariant.lowestAsk}, Bid £${firstVariant.highestBid}`);
      }
    } catch (error) {
      console.error('❌ Buy bar data failed:', error);
    }
  }

  console.log('\n✅ GOAT API connection test complete!');
}

testGoatAPI();
```

Run test:
```bash
npx tsx scripts/test-goat-api.ts
```

---

## Step 3: Build Product Search UI

Enhance the existing `AddItemModal` with GOAT product search:

```typescript
// src/components/modals/AddItemModal.tsx (additions)

import { GoatProductsService } from '@/lib/services/goat';
import { useState } from 'react';

function AddItemModal() {
  const [goatSearchQuery, setGoatSearchQuery] = useState('');
  const [goatResults, setGoatResults] = useState([]);
  const [searchingGoat, setSearchingGoat] = useState(false);

  const searchGoat = async () => {
    if (!goatSearchQuery.trim()) return;

    setSearchingGoat(true);
    try {
      const response = await fetch('/api/goat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: goatSearchQuery, limit: 10 }),
      });

      const data = await response.json();
      setGoatResults(data.results || []);
    } catch (error) {
      console.error('GOAT search failed:', error);
    } finally {
      setSearchingGoat(false);
    }
  };

  const selectGoatProduct = (product: any) => {
    // Auto-fill form with GOAT product data
    setFormData({
      ...formData,
      sku: product.sku,
      brand: product.brand,
      model: product.model,
      colorway: product.colorway,
      retail_price: product.retailPrice,
      image_url: product.mainPictureUrl,
    });

    setGoatResults([]);
    setGoatSearchQuery('');
  };

  return (
    <Modal>
      {/* Existing form fields */}

      {/* NEW: GOAT Product Search */}
      <div className="border-t border-white/10 pt-4 mt-4">
        <h3 className="text-sm font-medium text-white mb-2">
          🔍 Search GOAT Catalog
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={goatSearchQuery}
            onChange={(e) => setGoatSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchGoat()}
            placeholder="Search GOAT products..."
            className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded text-white"
          />
          <button
            onClick={searchGoat}
            disabled={searchingGoat}
            className="px-4 py-2 bg-accent-500 text-white rounded hover:bg-accent-600"
          >
            {searchingGoat ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search Results */}
        {goatResults.length > 0 && (
          <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
            {goatResults.map((product: any) => (
              <button
                key={product.id}
                onClick={() => selectGoatProduct(product)}
                className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded text-left"
              >
                <img
                  src={product.mainPictureUrl}
                  alt={product.name}
                  className="w-12 h-12 object-contain bg-black/20 rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {product.brand} {product.model}
                  </p>
                  <p className="text-xs text-white/50 truncate">
                    {product.sku} • £{product.retailPrice}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
```

Create corresponding API route:

```typescript
// src/app/api/goat/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createGoatClient, GoatProductsService } from '@/lib/services/goat';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, limit = 10 } = await request.json();

    // Create GOAT client (using global API key for now)
    const goatClient = createGoatClient();
    const productsService = new GoatProductsService(goatClient);

    // Search products
    const results = await productsService.search({
      query,
      limit,
    });

    return NextResponse.json({
      results: results.results,
      total: results.total,
    });
  } catch (error: any) {
    console.error('[GOAT Search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search GOAT', details: error.message },
      { status: 500 }
    );
  }
}
```

---

## Step 4: Implement One-Click Listing

Add "List on GOAT" button to inventory items:

```typescript
// src/app/portfolio/inventory/_components/RowActions.tsx

import { GoatListingsService } from '@/lib/services/goat';

async function listOnGoat(inventoryItem: any) {
  try {
    const response = await fetch('/api/goat/listings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_id: inventoryItem.id,
        price: inventoryItem.market || inventoryItem.purchase_price * 1.5,
      }),
    });

    if (!response.ok) throw new Error('Failed to list on GOAT');

    const { listing } = await response.json();
    console.log('Listed on GOAT:', listing.id);

    // Refresh inventory to show GOAT status
    window.location.reload();
  } catch (error) {
    console.error('List on GOAT failed:', error);
    alert('Failed to list on GOAT');
  }
}

// In your actions menu
<DropdownMenuItem onClick={() => listOnGoat(item)}>
  <Upload className="w-4 h-4 mr-2" />
  List on GOAT
</DropdownMenuItem>
```

API route:

```typescript
// src/app/api/goat/listings/create/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createUserGoatClient, GoatListingsService, GoatProductsService } from '@/lib/services/goat';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inventory_id, price } = await request.json();

    // Get inventory item
    const { data: item, error: itemError } = await supabase
      .from('Inventory')
      .select('*')
      .eq('id', inventory_id)
      .eq('user_id', user.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    // Create user's GOAT client
    const goatClient = await createUserGoatClient(user.id);
    const productsService = new GoatProductsService(goatClient);
    const listingsService = new GoatListingsService(goatClient);

    // Find GOAT product by SKU
    const goatProduct = await productsService.getBySku(item.sku);

    if (!goatProduct) {
      return NextResponse.json({ error: 'Product not found on GOAT' }, { status: 404 });
    }

    // Create listing
    const listing = await listingsService.create({
      productId: goatProduct.id,
      size: item.size_uk || 'UK9', // Adapt size format if needed
      price,
      condition: 'new',
    });

    // Update inventory with GOAT listing info
    await supabase
      .from('Inventory')
      .update({
        goat_listing_id: listing.id,
        goat_product_id: goatProduct.id,
        goat_status: 'listed',
        goat_price: price,
        goat_listed_at: new Date().toISOString(),
        goat_last_sync: new Date().toISOString(),
      })
      .eq('id', inventory_id);

    return NextResponse.json({
      success: true,
      listing,
    });
  } catch (error: any) {
    console.error('[GOAT List] Error:', error);
    return NextResponse.json(
      { error: 'Failed to list on GOAT', details: error.message },
      { status: 500 }
    );
  }
}
```

---

## Step 5: Auto-Sync Sold Orders (Cron Job)

Create a worker to sync GOAT sales every 15 minutes:

```typescript
// src/app/api/workers/goat-sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGoatClient, GoatOrdersService } from '@/lib/services/goat';

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  let syncedCount = 0;

  try {
    // Get all users with GOAT connected
    const { data: users } = await supabase
      .from('profiles')
      .select('id, goat_access_token')
      .not('goat_access_token', 'is', null);

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No users with GOAT connected' });
    }

    for (const user of users) {
      try {
        // Create user's GOAT client
        const goatClient = createGoatClient({
          accessToken: user.goat_access_token,
        });
        const ordersService = new GoatOrdersService(goatClient);

        // Fetch sold orders from last 24 hours
        const soldOrders = await ordersService.getSold({ since: '24h' });

        for (const order of soldOrders) {
          // Find matching inventory item
          const { data: item } = await supabase
            .from('Inventory')
            .select('*')
            .eq('goat_listing_id', order.listingId)
            .single();

          if (!item) continue;

          // Mark as sold (trigger will create sale record)
          await supabase
            .from('Inventory')
            .update({
              status: 'sold',
              sold_price: order.salePrice,
              sales_fee: order.commission,
              platform: 'goat',
              sold_date: order.soldAt,
              goat_status: 'sold',
            })
            .eq('id', item.id);

          syncedCount++;
        }
      } catch (error) {
        console.error(`[GOAT Sync] Error for user ${user.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
    });
  } catch (error: any) {
    console.error('[GOAT Sync] Error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}
```

Set up cron job (e.g., Vercel Cron):

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/workers/goat-sync",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

---

## Step 6: Display GOAT Status in UI

Update inventory table to show GOAT listing status:

```typescript
// src/app/portfolio/inventory/_components/InventoryTable.tsx

function InventoryTable({ items }: { items: any[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Purchase</th>
          <th>Market</th>
          <th>GOAT Status</th> {/* NEW */}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.brand} {item.model}</td>
            <td>£{item.purchase_price}</td>
            <td>£{item.market}</td>
            <td>
              {item.goat_status ? (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'px-2 py-1 text-xs rounded',
                    item.goat_status === 'listed' && 'bg-green-500/20 text-green-400',
                    item.goat_status === 'sold' && 'bg-blue-500/20 text-blue-400',
                    item.goat_status === 'draft' && 'bg-gray-500/20 text-gray-400'
                  )}>
                    {item.goat_status}
                  </span>
                  {item.goat_price && (
                    <span className="text-xs text-white/50">
                      £{item.goat_price}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-white/30">Not listed</span>
              )}
            </td>
            <td>
              <RowActions item={item} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## Step 7: Testing Checklist

- [ ] Product search returns results
- [ ] Product details page shows correct info
- [ ] Buy bar data returns pricing for all sizes
- [ ] Create listing succeeds
- [ ] Inventory item shows "listed" status
- [ ] Update listing price works
- [ ] Cron job syncs sold orders
- [ ] Sale record created when GOAT order detected
- [ ] Activity feed logs GOAT sales
- [ ] Vacation mode pauses all listings

---

## Next Steps

1. **User Authentication Flow**: Build OAuth flow for users to connect GOAT accounts
2. **Auto-Repricing**: Implement repricing rules engine
3. **Market Data Dashboard**: Real-time pricing charts
4. **Multi-Marketplace**: Add StockX, Flight Club integrations
5. **Analytics**: GOAT performance metrics dashboard

---

## Troubleshooting

### Error: "GOAT API Error 401: Unauthorized"
- Check `GOAT_ACCESS_TOKEN` in `.env.local`
- Verify token hasn't expired
- Test with GOAT support's test token first

### Error: "Product not found on GOAT"
- SKU format might differ (e.g., Nike uses different SKUs than GOAT)
- Try searching by product name instead
- Check if product exists on GOAT marketplace

### Listings not syncing
- Check cron job is running (`/api/workers/goat-sync`)
- Verify `goat_listing_id` is stored in Inventory
- Check error logs for rate limiting

---

**Ready to integrate?** Start with Steps 1-3 to get the foundation in place!
