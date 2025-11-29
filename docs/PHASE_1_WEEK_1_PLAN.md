# Phase 1, Week 1: Database Schema & Infrastructure

**Goal:** Set up all database tables and core authentication for Alias integration

**Personal Access Token:** `goatapi_1GFjmPCsaibJixPGmp2IfAcmVhRSdKfie0XsriE`

---

## ✅ Already Complete

1. ✅ **Multi-platform foundation**
   - Type system supports both StockX and Alias
   - `inventory_alias_links` table created
   - `useInventoryV3` hook fetches both platforms

2. ✅ **Existing Alias tables** (from earlier migration)
   - `alias_accounts` - OAuth credentials
   - `alias_listings` - Synced listings

---

## 🔨 Week 1 Tasks

### Task 1: Verify/Create Missing Tables

**Check status:**
- ✅ `alias_accounts` - EXISTS
- ✅ `alias_listings` - EXISTS
- ❌ `alias_market_snapshots` - MISSING (needed by hook)
- ❓ `alias_orders` - Check if exists
- ❓ `alias_batch_operations` - Check if exists
- ❓ `alias_payouts` - Check if exists

**Action:** Create migration for missing tables

---

### Task 2: Authentication Setup

**Since Alias uses PAT (Personal Access Token), not OAuth:**

1. **Create `alias_credentials` table:**
   ```sql
   CREATE TABLE alias_credentials (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES auth.users UNIQUE,
     access_token TEXT NOT NULL, -- encrypted PAT
     status TEXT DEFAULT 'active',
     last_verified_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Store PAT securely:**
   - Create encryption utilities
   - API route to save/verify PAT
   - Connection status indicator in UI

---

### Task 3: Core API Client

**Create:** `src/lib/services/alias/client.ts`

```typescript
export class AliasClient {
  constructor(private pat: string) {}

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`https://api.alias.org/api/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.pat}`,
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    if (!response.ok) {
      throw new AliasAPIError(response);
    }

    return response.json();
  }
}
```

**Features:**
- Bearer token authentication
- Error handling
- Type-safe responses
- Rate limiting awareness

---

### Task 4: Type Definitions

**Create:** `src/lib/services/alias/types.ts`

Based on API reference, define:
- `AliasCatalogItem`
- `AliasListing`
- `AliasOrder`
- `AliasPricingInsight`
- `AliasBatchOperation`
- Error types

---

### Task 5: Test Endpoint

**Create:** `src/app/api/alias/test/route.ts`

```typescript
// Test Alias PAT connectivity
export async function GET() {
  const response = await fetch('https://api.alias.org/api/v1/test', {
    headers: {
      'Authorization': `Bearer ${process.env.ALIAS_PAT}`
    }
  });

  return Response.json({ ok: response.ok });
}
```

---

## 📦 Deliverables

By end of Week 1:

1. ✅ All database tables created and verified
2. ✅ `alias_credentials` table for PAT storage
3. ✅ Encryption utilities for token security
4. ✅ `AliasClient` base class with authentication
5. ✅ Type definitions for all Alias API responses
6. ✅ Test endpoint to verify PAT connectivity
7. ✅ Environment variable setup (`ALIAS_PAT`)

---

## 🚀 Start Order

1. Check existing table status
2. Create missing tables migration
3. Build Alias client + types
4. Add PAT to environment
5. Test connectivity
6. Create credentials storage

---

**Ready to start?**

Let me know and I'll begin with checking table status and creating the missing migrations!
