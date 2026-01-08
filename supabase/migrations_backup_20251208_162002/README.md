# Database Migrations

This directory contains SQL migrations for the Supabase database.

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended for Manual Runs)

1. Go to your Supabase project dashboard: https://app.supabase.com/project/cjoucwhhwhpippksytoi
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of the migration file (e.g., `20250107_pnl_vat_views.sql`)
5. Click **Run** to execute the SQL

### Option 2: Supabase CLI (Recommended for CI/CD)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link to your project:
   ```bash
   supabase link --project-ref cjoucwhhwhpippksytoi
   ```

3. Run migrations:
   ```bash
   supabase db push
   ```

## Migration: 20250107_pnl_vat_views.sql

**Purpose:** Creates database views for P&L and VAT reporting

**What it creates:**
- `profit_loss_monthly_view` - Monthly P&L with revenue, COGS, expenses, net profit
- `vat_margin_monthly_view` - Monthly VAT calculations (VAT = margin / 6)
- `vat_margin_detail_view` - Item-level VAT details for CSV exports

**RLS:** All views have RLS enabled with `security_invoker = on`

**Status:** Ready to apply (pending manual execution)

## Testing After Migration

After applying the migration, test the P&L page:

1. Navigate to http://localhost:3000/dashboard/pnl
2. Switch between months (This Month / Last Month / Custom)
3. Verify KPIs display correctly
4. Check sold items table
5. Test CSV exports:
   - P&L CSV
   - VAT Detail CSV
   - VAT Summary CSV
