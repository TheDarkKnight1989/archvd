-- Catalog cache table for product metadata
-- Stores SKU metadata from pricing providers to reduce API calls

create table if not exists catalog_cache (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  brand text,
  model text,
  colorway text,
  image_url text,
  source text not null, -- provider name (stockx, laced, etc)
  confidence integer default 90, -- 0-100
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Index for fast SKU lookups
create index if not exists idx_catalog_cache_sku on catalog_cache(sku);

-- Index for filtering by source
create index if not exists idx_catalog_cache_source on catalog_cache(source);

-- No RLS needed - this is a server-side cache table
alter table catalog_cache disable row level security;

-- Optional: Add a trigger to update updated_at on row updates
create or replace function update_catalog_cache_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_catalog_cache_updated_at on catalog_cache;
create trigger trigger_catalog_cache_updated_at
  before update on catalog_cache
  for each row
  execute function update_catalog_cache_updated_at();

-- Comment
comment on table catalog_cache is 'Product metadata cache from pricing providers';
comment on column catalog_cache.sku is 'Unique SKU identifier (uppercased)';
comment on column catalog_cache.confidence is 'Data quality score 0-100';
comment on column catalog_cache.source is 'Provider that supplied this data';
