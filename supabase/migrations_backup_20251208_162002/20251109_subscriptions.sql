-- Subscriptions table for tracking recurring expenses
-- Simple implementation for MVP

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  vendor text,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'GBP',
  interval text not null check (interval in ('monthly', 'annual')),
  next_charge date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_subscriptions_user on subscriptions(user_id);
create index if not exists idx_subscriptions_active on subscriptions(user_id, is_active);

-- RLS policies
alter table subscriptions enable row level security;

create policy "Users can view own subscriptions"
  on subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own subscriptions"
  on subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own subscriptions"
  on subscriptions for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own subscriptions"
  on subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

-- Grant permissions
grant all on subscriptions to authenticated;

-- Trigger for updated_at
create or replace function update_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists trigger_update_subscriptions_updated_at on subscriptions;
create trigger trigger_update_subscriptions_updated_at
  before update on subscriptions
  for each row
  execute function update_subscriptions_updated_at();

-- Helper view for monthly subscription cost
create or replace view subscription_monthly_cost
with (security_invoker = on) as
select
  user_id,
  sum(
    case
      when interval = 'monthly' then amount
      when interval = 'annual' then amount / 12
      else 0
    end
  ) as monthly_total,
  count(*) filter (where is_active) as active_count,
  count(*) as total_count
from subscriptions
where user_id = auth.uid() and is_active = true
group by user_id;

-- Grant access to view
grant select on subscription_monthly_cost to authenticated;

-- Add audit logging for subscriptions
create or replace function log_subscription_events()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') then
    perform log_audit_event(
      'subscription.created',
      'subscription',
      NEW.id,
      format('Added subscription: %s', NEW.name),
      format('%s/%s - %s',
        to_char(NEW.amount, 'FM£999,999.00'),
        NEW.interval,
        coalesce(NEW.vendor, 'No vendor')
      ),
      jsonb_build_object(
        'subscription_id', NEW.id,
        'name', NEW.name,
        'amount', NEW.amount,
        'interval', NEW.interval
      )
    );
  elsif (TG_OP = 'UPDATE') then
    if NEW.is_active != OLD.is_active then
      perform log_audit_event(
        case when NEW.is_active then 'subscription.activated' else 'subscription.deactivated' end,
        'subscription',
        NEW.id,
        format('%s subscription: %s',
          case when NEW.is_active then 'Activated' else 'Deactivated' end,
          NEW.name
        ),
        null,
        jsonb_build_object('subscription_id', NEW.id, 'name', NEW.name)
      );
    end if;
  elsif (TG_OP = 'DELETE') then
    perform log_audit_event(
      'subscription.deleted',
      'subscription',
      OLD.id,
      format('Deleted subscription: %s', OLD.name),
      null,
      jsonb_build_object('subscription_id', OLD.id, 'name', OLD.name)
    );
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trigger_log_subscription_events on subscriptions;
create trigger trigger_log_subscription_events
  after insert or update or delete on subscriptions
  for each row
  execute function log_subscription_events();
