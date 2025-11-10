-- ============================================================================
-- Add Profiles Table with Currency Preference
-- Created: 2025-01-10
-- Purpose: User preferences including currency (GBP/EUR)
-- ============================================================================

-- ============================================================================
-- 1. Profiles Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_pref TEXT NOT NULL DEFAULT 'GBP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_currency CHECK (currency_pref IN ('GBP', 'EUR'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_currency_pref ON public.profiles(currency_pref);

-- RLS: User-scoped (users can only see/modify their own profile)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

COMMENT ON TABLE public.profiles IS 'User preferences and settings';
COMMENT ON COLUMN public.profiles.currency_pref IS 'Preferred display currency (GBP or EUR)';

-- ============================================================================
-- 2. Trigger for updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. Function to auto-create profile on user signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, currency_pref)
  VALUES (NEW.id, 'GBP')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile when a new user signs up';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
