-- Migration: Create Sell Lists feature
-- Description: Enables sellers to create shareable lists of inventory items with public links

-- ============================================================================
-- 0. Helper Functions
-- ============================================================================

-- Create or replace the set_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. Create sell_lists table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sell_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  allow_comments BOOLEAN NOT NULL DEFAULT false,
  show_market_prices BOOLEAN NOT NULL DEFAULT false,
  allow_offers BOOLEAN NOT NULL DEFAULT false,
  allow_asking_prices BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_sell_lists_user_id ON public.sell_lists(user_id);
CREATE INDEX idx_sell_lists_share_token ON public.sell_lists(share_token);
CREATE INDEX idx_sell_lists_created_at ON public.sell_lists(created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER set_sell_lists_updated_at
  BEFORE UPDATE ON public.sell_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. Create sell_list_items table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sell_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sell_list_id UUID NOT NULL REFERENCES public.sell_lists(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public."Inventory"(id) ON DELETE CASCADE,
  asking_price NUMERIC(10, 2),
  position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sell_list_id, inventory_item_id)
);

-- Add indexes
CREATE INDEX idx_sell_list_items_sell_list_id ON public.sell_list_items(sell_list_id);
CREATE INDEX idx_sell_list_items_inventory_item_id ON public.sell_list_items(inventory_item_id);
CREATE INDEX idx_sell_list_items_position ON public.sell_list_items(sell_list_id, position);

-- Add updated_at trigger
CREATE TRIGGER set_sell_list_items_updated_at
  BEFORE UPDATE ON public.sell_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. Create sell_list_interactions table
-- ============================================================================
CREATE TYPE public.sell_list_interaction_type AS ENUM ('comment', 'offer');

CREATE TABLE IF NOT EXISTS public.sell_list_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sell_list_id UUID NOT NULL REFERENCES public.sell_lists(id) ON DELETE CASCADE,
  sell_list_item_id UUID REFERENCES public.sell_list_items(id) ON DELETE CASCADE,
  type public.sell_list_interaction_type NOT NULL,
  buyer_name TEXT,
  buyer_email TEXT,
  message TEXT,
  offer_amount NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_sell_list_interactions_sell_list_id ON public.sell_list_interactions(sell_list_id);
CREATE INDEX idx_sell_list_interactions_sell_list_item_id ON public.sell_list_interactions(sell_list_item_id);
CREATE INDEX idx_sell_list_interactions_created_at ON public.sell_list_interactions(created_at DESC);
CREATE INDEX idx_sell_list_interactions_type ON public.sell_list_interactions(type);

-- ============================================================================
-- 4. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.sell_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sell_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sell_list_interactions ENABLE ROW LEVEL SECURITY;

-- sell_lists policies
-- Owners can view their own lists
CREATE POLICY "Users can view their own sell lists"
  ON public.sell_lists
  FOR SELECT
  USING (auth.uid() = user_id);

-- Owners can create their own lists
CREATE POLICY "Users can create their own sell lists"
  ON public.sell_lists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owners can update their own lists
CREATE POLICY "Users can update their own sell lists"
  ON public.sell_lists
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Owners can delete their own lists
CREATE POLICY "Users can delete their own sell lists"
  ON public.sell_lists
  FOR DELETE
  USING (auth.uid() = user_id);

-- sell_list_items policies
-- Owners can view items in their lists
CREATE POLICY "Users can view items in their sell lists"
  ON public.sell_list_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sell_lists
      WHERE sell_lists.id = sell_list_items.sell_list_id
      AND sell_lists.user_id = auth.uid()
    )
  );

-- Owners can add items to their lists
CREATE POLICY "Users can add items to their sell lists"
  ON public.sell_list_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sell_lists
      WHERE sell_lists.id = sell_list_items.sell_list_id
      AND sell_lists.user_id = auth.uid()
    )
  );

-- Owners can update items in their lists
CREATE POLICY "Users can update items in their sell lists"
  ON public.sell_list_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sell_lists
      WHERE sell_lists.id = sell_list_items.sell_list_id
      AND sell_lists.user_id = auth.uid()
    )
  );

-- Owners can delete items from their lists
CREATE POLICY "Users can delete items from their sell lists"
  ON public.sell_list_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sell_lists
      WHERE sell_lists.id = sell_list_items.sell_list_id
      AND sell_lists.user_id = auth.uid()
    )
  );

-- sell_list_interactions policies
-- Owners can view all interactions on their lists
CREATE POLICY "Users can view interactions on their sell lists"
  ON public.sell_list_interactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sell_lists
      WHERE sell_lists.id = sell_list_interactions.sell_list_id
      AND sell_lists.user_id = auth.uid()
    )
  );

-- Note: Public insertion is handled via API with service role, not RLS
-- This keeps the share_token validation server-side for security

-- ============================================================================
-- 5. Helper functions
-- ============================================================================

-- Function to generate unique share token
CREATE OR REPLACE FUNCTION public.generate_sell_list_share_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 16-character URL-safe token
    token := encode(gen_random_bytes(12), 'base64');
    token := replace(token, '/', '-');
    token := replace(token, '+', '_');
    token := replace(token, '=', '');

    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM public.sell_lists WHERE share_token = token) INTO token_exists;

    -- Exit loop if unique token found
    EXIT WHEN NOT token_exists;
  END LOOP;

  RETURN token;
END;
$$;

-- ============================================================================
-- 6. Comments
-- ============================================================================

COMMENT ON TABLE public.sell_lists IS 'Shareable lists of inventory items that sellers can send to buyers';
COMMENT ON TABLE public.sell_list_items IS 'Items included in sell lists with optional asking prices';
COMMENT ON TABLE public.sell_list_interactions IS 'Comments and offers from buyers on sell lists (no account required)';
COMMENT ON COLUMN public.sell_lists.share_token IS 'Unique URL-safe token for public access without authentication';
COMMENT ON COLUMN public.sell_lists.allow_comments IS 'Whether buyers can leave comments on this list';
COMMENT ON COLUMN public.sell_lists.show_market_prices IS 'Whether to show market prices from StockX to buyers';
COMMENT ON COLUMN public.sell_lists.allow_offers IS 'Whether buyers can submit offers on items';
COMMENT ON COLUMN public.sell_lists.allow_asking_prices IS 'Whether seller can set and display asking prices';
