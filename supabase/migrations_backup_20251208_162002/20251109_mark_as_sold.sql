-- Add sale fields to Inventory table
-- Enables "Mark as Sold" functionality

alter table "Inventory"
  add column if not exists sold_price numeric(12,2),
  add column if not exists sold_date timestamptz,
  add column if not exists sale_platform text,
  add column if not exists sale_fees numeric(12,2) default 0,
  add column if not exists sale_shipping numeric(12,2) default 0;

-- Add comment for clarity
comment on column "Inventory".sold_price is 'Final sale price in item currency';
comment on column "Inventory".sold_date is 'Date the item was sold';
comment on column "Inventory".sale_platform is 'Platform where item was sold (e.g., StockX, GOAT, eBay, Instagram)';
comment on column "Inventory".sale_fees is 'Platform/transaction fees in item currency';
comment on column "Inventory".sale_shipping is 'Shipping cost in item currency';

-- Helper view for sales page (only sold items)
create or replace view sales_view
with (security_invoker = on) as
select *
from "Inventory"
where user_id = auth.uid() and status = 'sold'
order by sold_date desc nulls last, created_at desc;

-- Grant access to view
grant select on sales_view to authenticated;

-- Add trigger to log audit event when item is marked as sold
create or replace function log_item_sold()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only log if status changed to 'sold'
  if NEW.status = 'sold' and (OLD.status is null or OLD.status != 'sold') then
    perform log_audit_event(
      'item.sold',
      'Inventory',
      NEW.id,
      format('Sold %s', NEW.name),
      format('Sold for %s on %s',
        to_char(NEW.sold_price, 'FM£999,999.00'),
        coalesce(NEW.sale_platform, 'Unknown platform')
      ),
      jsonb_build_object(
        'item_id', NEW.id,
        'item_name', NEW.name,
        'sold_price', NEW.sold_price,
        'sale_platform', NEW.sale_platform,
        'profit', NEW.sold_price - NEW.purchase_price
      )
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trigger_log_item_sold on "Inventory";
create trigger trigger_log_item_sold
  after update on "Inventory"
  for each row
  execute function log_item_sold();
