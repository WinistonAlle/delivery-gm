create table if not exists public.delivery_customer_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  event_name text not null,
  customer_name text null,
  phone text null,
  document_cpf text null,
  path text null,
  metadata jsonb not null default '{}'::jsonb,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists delivery_customer_events_created_at_idx
  on public.delivery_customer_events (created_at desc);

create index if not exists delivery_customer_events_visitor_id_idx
  on public.delivery_customer_events (visitor_id);

create index if not exists delivery_customer_events_event_name_idx
  on public.delivery_customer_events (event_name);

alter table public.delivery_customer_events enable row level security;

drop policy if exists "delivery_customer_events_insert_anon" on public.delivery_customer_events;
create policy "delivery_customer_events_insert_anon"
on public.delivery_customer_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "delivery_customer_events_read_authenticated" on public.delivery_customer_events;
create policy "delivery_customer_events_read_authenticated"
on public.delivery_customer_events
for select
to authenticated
using (true);
