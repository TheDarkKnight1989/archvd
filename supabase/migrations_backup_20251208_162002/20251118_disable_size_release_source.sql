-- Disable Size? (size.co.uk) as a release source
-- Reason: Size? launches page is fully JS-rendered client-side with no structured data
-- The page has no __NEXT_DATA__, JSON-LD, or embedded JSON feeds available
-- Until they provide a structured data source (API or feed), we cannot reliably scrape launches

-- Update Size? to disabled
UPDATE public.release_sources_whitelist
SET enabled = false
WHERE source_name = 'size.co.uk';

-- Add comment for documentation
COMMENT ON TABLE public.release_sources_whitelist IS 'Whitelist of release sources for workers. Size? disabled due to JS-only rendering without structured data.';
