-- Execute no SQL Editor do Supabase para habilitar o admin de ofertas.
-- Data: 2026-03-06

create extension if not exists pgcrypto;

create table if not exists public.delivery_combos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  badge text not null default 'Combo',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.delivery_combos(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_recommendations (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('cart', 'checkout')),
  product_id uuid not null references public.products(id) on delete cascade,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_cross_sell (
  id uuid primary key default gen_random_uuid(),
  source_product_id uuid not null references public.products(id) on delete cascade,
  target_product_id uuid not null references public.products(id) on delete cascade,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.app_theme_settings (
  id integer primary key,
  theme_key text not null default 'default',
  updated_at timestamptz not null default now()
);

create unique index if not exists delivery_combo_item_unique
  on public.delivery_combo_items (combo_id, product_id);

create index if not exists delivery_recommendations_placement_idx
  on public.delivery_recommendations (placement, priority, is_active);

create index if not exists delivery_cross_sell_source_idx
  on public.delivery_cross_sell (source_product_id, priority, is_active);

alter table public.delivery_combos enable row level security;
alter table public.delivery_combo_items enable row level security;
alter table public.delivery_recommendations enable row level security;
alter table public.delivery_cross_sell enable row level security;
alter table public.app_theme_settings enable row level security;

-- Ajuste para sua política interna:
-- leitura para usuários logados
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'delivery_combos' and policyname = 'delivery_combos_read_authenticated'
  ) then
    create policy delivery_combos_read_authenticated
      on public.delivery_combos
      for select
      to authenticated
      using (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'app_theme_settings' and policyname = 'app_theme_settings_read_authenticated'
  ) then
    create policy app_theme_settings_read_authenticated
      on public.app_theme_settings
      for select
      to authenticated
      using (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'delivery_combo_items' and policyname = 'delivery_combo_items_read_authenticated'
  ) then
    create policy delivery_combo_items_read_authenticated
      on public.delivery_combo_items
      for select
      to authenticated
      using (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'app_theme_settings' and policyname = 'app_theme_settings_write_authenticated'
  ) then
    create policy app_theme_settings_write_authenticated
      on public.app_theme_settings
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'delivery_recommendations' and policyname = 'delivery_recommendations_read_authenticated'
  ) then
    create policy delivery_recommendations_read_authenticated
      on public.delivery_recommendations
      for select
      to authenticated
      using (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'delivery_cross_sell' and policyname = 'delivery_cross_sell_read_authenticated'
  ) then
    create policy delivery_cross_sell_read_authenticated
      on public.delivery_cross_sell
      for select
      to authenticated
      using (true);
  end if;
end$$;

-- escrita para usuários logados (recomendado restringir para admin depois)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'delivery_combos' and policyname = 'delivery_combos_write_authenticated'
  ) then
    create policy delivery_combos_write_authenticated
      on public.delivery_combos
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'delivery_combo_items' and policyname = 'delivery_combo_items_write_authenticated'
  ) then
    create policy delivery_combo_items_write_authenticated
      on public.delivery_combo_items
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'delivery_recommendations' and policyname = 'delivery_recommendations_write_authenticated'
  ) then
    create policy delivery_recommendations_write_authenticated
      on public.delivery_recommendations
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'delivery_cross_sell' and policyname = 'delivery_cross_sell_write_authenticated'
  ) then
    create policy delivery_cross_sell_write_authenticated
      on public.delivery_cross_sell
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end$$;
