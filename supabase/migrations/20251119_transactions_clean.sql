-- WHY: Unified transactions ledger for Sales & Purchases history
-- Provides fast UI-optimized rendering with cached product data
-- CLEAN VERSION: Drops everything first for complete idempotency

-- 1) Drop existing objects (if any)
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP VIEW IF EXISTS v_transactions_sales CASCADE;
DROP VIEW IF EXISTS v_transactions_purchases CASCADE;
DROP FUNCTION IF EXISTS update_transactions_updated_at() CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;

-- 2) Create enum for transaction type
CREATE TYPE transaction_type AS ENUM ('sale', 'purchase');

-- 3) Create main transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type transaction_type NOT NULL,

  -- Linked inventory item (if applicable)
  inventory_id UUID NULL,

  -- Cached product data for fast rendering
  sku TEXT NULL,
  size_uk TEXT NULL,
  title TEXT NULL,                           -- brand + model + colorway
  image_url TEXT NULL,                       -- resolved via fallback chain

  -- Transaction details
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(12,2) NOT NULL,         -- price per unit in base currency
  fees NUMERIC(12,2) DEFAULT 0,              -- selling fees or purchase fees
  total NUMERIC(12,2) GENERATED ALWAYS AS (qty * unit_price) STORED,

  -- Metadata
  platform TEXT NULL,                        -- e.g. 'StockX', 'Alias', 'eBay', 'Local'
  notes TEXT NULL,

  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL,          -- sale/purchase date
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key to auth.users
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Optional foreign key to inventory (null if imported transaction)
  CONSTRAINT fk_transactions_inventory FOREIGN KEY (inventory_id) REFERENCES "Inventory"(id) ON DELETE SET NULL
);

-- 4) Indexes for performance
CREATE INDEX ix_transactions_user_type ON transactions (user_id, type);
CREATE INDEX ix_transactions_occurred_at ON transactions (occurred_at DESC);
CREATE INDEX ix_transactions_inventory ON transactions (inventory_id) WHERE inventory_id IS NOT NULL;

-- 5) RLS Policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- 6) Views for convenient filtering
CREATE VIEW v_transactions_sales AS
  SELECT * FROM transactions WHERE type = 'sale';

CREATE VIEW v_transactions_purchases AS
  SELECT * FROM transactions WHERE type = 'purchase';

-- 7) Trigger to update updated_at
CREATE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transactions_updated_at();

-- 8) Table and column comments
COMMENT ON TABLE transactions IS 'Unified transactions ledger for sales and purchases with cached product data';
COMMENT ON COLUMN transactions.title IS 'Cached: brand + model + colorway for fast rendering';
COMMENT ON COLUMN transactions.image_url IS 'Cached: resolved via 5-tier fallback chain';
COMMENT ON COLUMN transactions.total IS 'Computed: qty * unit_price';
