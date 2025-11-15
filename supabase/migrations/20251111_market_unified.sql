-- ============================================================================
-- Market Unified Schema
-- Additive, backward-compatible migration for provider-agnostic market data
-- Supports: StockX, Alias, eBay
-- ============================================================================

-- 1. Catalog (provider-agnostic product catalog)
-- ============================================================================
create table if not exists market_products (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stockx','alias','ebay','seed')),
  provider_product_id text not null,
  brand text,
  model text,
  colorway text,
  sku text,
  slug text,
  image_url text,
  release_date date,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_market_products_provider_pid
  on market_products(provider, provider_product_id);

create index if not exists idx_market_products_sku
  on market_products(sku);

create index if not exists idx_market_products_slug
  on market_products(slug);

-- 2. Time-series prices (per size)
-- ============================================================================
create table if not exists market_prices (
  id bigserial primary key,
  provider text not null check (provider in ('stockx','alias','ebay','seed')),
  sku text not null,
  size_uk text,                      -- nullable for one-size products
  currency text not null,            -- 'GBP'|'EUR'|'USD'
  ask numeric,
  bid numeric,
  last_sale numeric,
  as_of timestamptz not null,
  meta jsonb default '{}'::jsonb
);

create index if not exists idx_market_prices_key
  on market_prices(provider, sku, coalesce(size_uk,''), as_of desc);

create index if not exists idx_market_prices_sku_date
  on market_prices(sku, as_of desc);

-- 3. Daily medians (Materialized View)
-- ============================================================================
drop materialized view if exists market_price_daily_medians cascade;
create materialized view market_price_daily_medians as
select
  provider,
  sku,
  coalesce(size_uk,'') as size_uk,
  date_trunc('day', as_of)::date as day,
  percentile_cont(0.5) within group (order by coalesce(last_sale, ask, bid)) as median,
  count(*) as points
from market_prices
group by 1,2,3,4
with no data;

create unique index if not exists idx_mv_medians_key
  on market_price_daily_medians(provider, sku, size_uk, day);

-- 4. Inventory linkage (unifies stockx/alias links)
-- ============================================================================
create table if not exists inventory_market_links (
  inventory_id uuid not null references "Inventory"(id) on delete cascade,
  provider text not null check (provider in ('stockx','alias','ebay','seed')),
  provider_listing_id text,
  provider_product_sku text,
  size_uk text,
  ask_price numeric,
  status text,
  last_sync_at timestamptz,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (inventory_id, provider)
);

create index if not exists idx_inventory_market_links_provider
  on inventory_market_links(provider);

create index if not exists idx_inventory_market_links_listing_id
  on inventory_market_links(provider, provider_listing_id);

-- 5. Imported orders (raw)
-- ============================================================================
create table if not exists market_orders (
  id bigserial primary key,
  provider text not null check (provider in ('stockx','alias','ebay','seed')),
  order_id text not null,
  sku text,
  size_uk text,
  currency text,
  price_gross numeric,
  fees numeric,
  payout numeric,
  ordered_at timestamptz,
  listing_id text,
  status text,
  raw jsonb not null,
  created_at timestamptz default now()
);

create unique index if not exists idx_market_orders_provider_oid
  on market_orders(provider, order_id);

create index if not exists idx_market_orders_sku
  on market_orders(sku);

-- 6. Latest price preference view (StockX -> Alias -> eBay)
-- ============================================================================
drop view if exists latest_market_prices cascade;
create view latest_market_prices as
with ranked as (
  select
    sku,
    size_uk,
    provider,
    currency,
    last_sale,
    ask,
    bid,
    as_of,
    row_number() over (
      partition by sku, coalesce(size_uk, '')
      order by
        case provider
          when 'stockx' then 1
          when 'alias' then 2
          else 3
        end,
        as_of desc
    ) as rnk
  from market_prices
)
select
  sku,
  size_uk,
  provider,
  currency,
  last_sale,
  ask,
  bid,
  as_of
from ranked
where rnk = 1;

-- 7. Portfolio daily value (uses unified medians; 30d window)
-- ============================================================================
drop materialized view if exists portfolio_value_daily cascade;
create materialized view portfolio_value_daily as
select
  i.user_id,
  d.day,
  sum(coalesce(d.median,0)) as value
from "Inventory" i
join latest_market_prices l
  on l.sku = i.sku
  and (l.size_uk is null or l.size_uk = i.size_uk)
join market_price_daily_medians d
  on d.sku = l.sku
  and d.size_uk = coalesce(l.size_uk,'')
  and d.provider = l.provider
where d.day >= (current_date - interval '30 days')
  and i.status in ('active', 'listed')
group by 1,2
with no data;

create unique index if not exists idx_portfolio_value_daily_user
  on portfolio_value_daily(user_id, day);

-- ============================================================================
-- Compatibility views (backward compatibility with existing code)
-- ============================================================================

-- StockX products compatibility
drop view if exists stockx_products_compat cascade;
create view stockx_products_compat as
select
  sku,
  slug,
  brand || ' ' || coalesce(model, '') as name,
  brand,
  model,
  colorway,
  release_date,
  image_url,
  null::numeric as retail_price,
  jsonb_build_object(
    'product_id', provider_product_id,
    'category', 'sneaker'
  ) as meta,
  updated_at
from market_products
where provider = 'stockx';

-- StockX latest prices compatibility
drop view if exists stockx_latest_prices cascade;
create view stockx_latest_prices as
select
  sku,
  size_uk,
  currency,
  last_sale,
  ask,
  bid,
  as_of
from latest_market_prices
where provider = 'stockx';

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Market products: public read
alter table market_products enable row level security;

drop policy if exists "Market products are viewable by everyone" on market_products;
create policy "Market products are viewable by everyone"
  on market_products for select
  using (true);

-- Market prices: public read
alter table market_prices enable row level security;

drop policy if exists "Market prices are viewable by everyone" on market_prices;
create policy "Market prices are viewable by everyone"
  on market_prices for select
  using (true);

-- Market orders: public read
alter table market_orders enable row level security;

drop policy if exists "Market orders are viewable by everyone" on market_orders;
create policy "Market orders are viewable by everyone"
  on market_orders for select
  using (true);

-- Inventory market links: user-scoped
alter table inventory_market_links enable row level security;

drop policy if exists "Users can view their own inventory market links" on inventory_market_links;
create policy "Users can view their own inventory market links"
  on inventory_market_links for select
  using (
    inventory_id in (
      select id from "Inventory" where user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their own inventory market links" on inventory_market_links;
create policy "Users can insert their own inventory market links"
  on inventory_market_links for insert
  with check (
    inventory_id in (
      select id from "Inventory" where user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own inventory market links" on inventory_market_links;
create policy "Users can update their own inventory market links"
  on inventory_market_links for update
  using (
    inventory_id in (
      select id from "Inventory" where user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own inventory market links" on inventory_market_links;
create policy "Users can delete their own inventory market links"
  on inventory_market_links for delete
  using (
    inventory_id in (
      select id from "Inventory" where user_id = auth.uid()
    )
  );

-- ============================================================================
-- Refresh functions for materialized views
-- ============================================================================

create or replace function refresh_market_price_daily_medians()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently market_price_daily_medians;
end;
$$;

create or replace function refresh_portfolio_value_daily()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently portfolio_value_daily;
end;
$$;

create or replace function refresh_all_market_mvs()
returns void
language plpgsql
security definer
as $$
begin
  perform refresh_market_price_daily_medians();
  perform refresh_portfolio_value_daily();
end;
$$;

-- ============================================================================
-- Initial refresh of materialized views
-- ============================================================================
-- Note: Will fail on first run due to no data, that's expected
-- Run after seeding data: select refresh_all_market_mvs();
