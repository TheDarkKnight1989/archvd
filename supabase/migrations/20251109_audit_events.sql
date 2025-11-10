-- Audit events table for activity feed
-- Tracks all user actions across the platform

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  title text not null,
  description text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_audit_events_user_created on audit_events(user_id, created_at desc);
create index if not exists idx_audit_events_type on audit_events(event_type);
create index if not exists idx_audit_events_entity on audit_events(entity_type, entity_id);

-- RLS policies
alter table audit_events enable row level security;

create policy "Users can view own audit events"
  on audit_events for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own audit events"
  on audit_events for insert
  to authenticated
  with check (user_id = auth.uid());

-- Grant permissions
grant select, insert on audit_events to authenticated;

-- Helper function to log events
create or replace function log_audit_event(
  p_event_type text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  v_event_id uuid;
begin
  insert into audit_events (
    user_id,
    event_type,
    entity_type,
    entity_id,
    title,
    description,
    metadata
  ) values (
    auth.uid(),
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_title,
    p_description,
    p_metadata
  ) returning id into v_event_id;

  return v_event_id;
end;
$$;
