-- Migration: Portfolio Daily Snapshots Table
-- Purpose: Store daily portfolio metrics for time-series charts and historical analysis
-- Date: 2025-11-16

-- Create portfolio_snapshots table
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  currency text NOT NULL CHECK (currency IN ('GBP', 'EUR', 'USD')),

  -- Portfolio metrics
  total_value numeric DEFAULT 0,
  invested numeric DEFAULT 0,
  unrealised_pl numeric DEFAULT 0,

  -- Profit metrics
  net_profit numeric DEFAULT 0,

  -- Income & spend metrics
  sales_income numeric DEFAULT 0,
  item_spend numeric DEFAULT 0,
  subscription_spend numeric DEFAULT 0,
  expense_spend numeric DEFAULT 0,
  total_spend numeric DEFAULT 0,

  -- Item counts
  items_purchased integer DEFAULT 0,
  items_sold integer DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure one snapshot per user/date/currency
  CONSTRAINT unique_user_date_currency UNIQUE (user_id, date, currency)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date
  ON portfolio_snapshots(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_currency_date
  ON portfolio_snapshots(user_id, currency, date DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date
  ON portfolio_snapshots(date DESC);

-- RLS Policies
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can only see their own snapshots
DROP POLICY IF EXISTS "Users can view own snapshots" ON portfolio_snapshots;
CREATE POLICY "Users can view own snapshots"
  ON portfolio_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update snapshots (for cron jobs)
DROP POLICY IF EXISTS "Service role can manage snapshots" ON portfolio_snapshots;
CREATE POLICY "Service role can manage snapshots"
  ON portfolio_snapshots
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_portfolio_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_portfolio_snapshots_updated_at ON portfolio_snapshots;
CREATE TRIGGER trigger_update_portfolio_snapshots_updated_at
  BEFORE UPDATE ON portfolio_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_portfolio_snapshots_updated_at();

-- Grant necessary permissions
GRANT SELECT ON portfolio_snapshots TO authenticated;
GRANT ALL ON portfolio_snapshots TO service_role;

-- Comment on table
COMMENT ON TABLE portfolio_snapshots IS 'Daily portfolio metrics snapshots for time-series analysis and historical tracking';
