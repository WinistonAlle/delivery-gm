-- ============================================================
-- Supabase Local Complete Schema
-- Projeto: Delivery Gostinho Mineiro
-- Data: 2026-03-13
--
-- Objetivo:
-- 1. Criar todas as tabelas/funcoes/views usadas hoje pelo app.
-- 2. Manter compatibilidade com colunas legadas e colunas novas.
-- 3. Permitir rodar localmente com o frontend atual.
--
-- Observacao importante:
-- Este script usa politicas RLS permissivas em varias tabelas para
-- nao quebrar o frontend atual, que ainda faz muita coisa com a anon key
-- e com "admin" controlado no cliente/localStorage.
-- Em producao, o ideal e endurecer essas politicas.
-- ============================================================

begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============================================================
-- Helpers
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.only_digits(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(input, ''), '\D', '', 'g');
$$;

create or replace function public.current_pay_cycle_key()
returns text
language sql
stable
as $$
  select to_char(current_date, 'YYYY-MM');
$$;

create or replace function public.order_total_cents_legacy(order_total_value numeric)
returns bigint
language sql
immutable
as $$
  select round(coalesce(order_total_value, 0) * 100)::bigint;
$$;

create or replace function public.compute_payment_method(
  p_wallet_cents bigint,
  p_pickup_cents bigint
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_wallet_cents, 0) > 0 and coalesce(p_pickup_cents, 0) > 0 then 'split'
    when coalesce(p_wallet_cents, 0) > 0 then 'wallet'
    when coalesce(p_pickup_cents, 0) > 0 then 'pickup'
    else null
  end;
$$;

-- ============================================================
-- Catalogo / Produtos
-- ============================================================

create table if not exists public.product_categories (
  id integer primary key,
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.product_categories (id, name, sort_order)
values
  (1, 'Pao de Queijo', 1),
  (2, 'Salgados Assados', 2),
  (3, 'Salgados P/ Fritar', 3),
  (4, 'Paes e Massas Doces', 4),
  (5, 'Biscoito de Queijo', 5),
  (6, 'Salgados Grandes', 6),
  (7, 'Alho em creme', 7),
  (8, 'Outros', 8)
on conflict (id) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  old_id bigint null unique,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0,
  employee_price numeric(12,2) not null default 0,
  unit text not null default 'un',
  category_id integer null references public.product_categories(id),
  image_path text null,
  images text[] not null default '{}',
  package_info text not null default '',
  weight numeric(12,3) not null default 0,
  is_package boolean not null default false,
  featured boolean not null default false,
  in_stock boolean not null default true,
  is_launch boolean not null default false,
  extra_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_price_non_negative check (price >= 0),
  constraint products_employee_price_non_negative check (employee_price >= 0),
  constraint products_weight_non_negative check (weight >= 0)
);

create index if not exists products_name_idx on public.products using gin (name gin_trgm_ops);
create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_featured_idx on public.products (featured, in_stock);
create index if not exists products_old_id_idx on public.products (old_id);

drop trigger if exists trg_products_set_updated_at on public.products;
create trigger trg_products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create table if not exists public.weight (
  product_id uuid primary key references public.products(id) on delete cascade,
  weight numeric(12,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_non_negative check (weight >= 0)
);

drop trigger if exists trg_weight_set_updated_at on public.weight;
create trigger trg_weight_set_updated_at
before update on public.weight
for each row
execute function public.set_updated_at();

create or replace function public.sync_product_weight_to_weight_table()
returns trigger
language plpgsql
as $$
begin
  insert into public.weight (product_id, weight, created_at, updated_at)
  values (new.id, coalesce(new.weight, 0), now(), now())
  on conflict (product_id)
  do update set
    weight = excluded.weight,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_product_weight_to_weight_table on public.products;
create trigger trg_sync_product_weight_to_weight_table
after insert or update of weight on public.products
for each row
execute function public.sync_product_weight_to_weight_table();

create or replace function public.sync_weight_table_to_products()
returns trigger
language plpgsql
as $$
begin
  update public.products
     set weight = coalesce(new.weight, 0),
         updated_at = now()
   where id = new.product_id
     and coalesce(weight, 0) is distinct from coalesce(new.weight, 0);
  return new;
end;
$$;

drop trigger if exists trg_sync_weight_table_to_products on public.weight;
create trigger trg_sync_weight_table_to_products
after insert or update of weight on public.weight
for each row
execute function public.sync_weight_table_to_products();

-- ============================================================
-- Funcionarios / RH
-- ============================================================

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  cpf text not null unique,
  full_name text not null,
  email text null,
  phone text null,
  department text null,
  job_title text null,
  status text not null default 'active',
  hired_at date null,
  terminated_at date null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_status_valid check (status in ('active', 'inactive', 'onboarding')),
  constraint employees_cpf_digits check (public.only_digits(cpf) = cpf),
  constraint employees_name_not_blank check (btrim(full_name) <> '')
);

create index if not exists employees_full_name_idx on public.employees using gin (full_name gin_trgm_ops);
create index if not exists employees_status_idx on public.employees (status);
create index if not exists employees_user_id_idx on public.employees (user_id);

drop trigger if exists trg_employees_set_updated_at on public.employees;
create trigger trg_employees_set_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();

create table if not exists public.hr_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid null references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Pedidos
-- ============================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text null unique,
  employee_id uuid null references public.employees(id) on delete set null,
  employee_cpf text null,
  employee_name text null,
  customer_phone text null,
  customer_document_cpf text null,
  customer_address text null,
  customer_city text null,
  customer_cep text null,
  notes text null,
  total_items integer not null default 0,
  total_value numeric(12,2) not null default 0,
  total_cents bigint not null default 0,
  wallet_used_cents bigint not null default 0,
  spent_from_balance_cents bigint not null default 0,
  pay_on_pickup_cents bigint not null default 0,
  wallet_debited boolean not null default false,
  payment_method text null,
  status text not null default 'recebido',
  cancelled_at timestamptz null,
  cancel_reason text null,
  paid_at timestamptz null,
  ready_at timestamptz null,
  picked_up_at timestamptz null,
  delivered_at timestamptz null,
  saibweb_status text not null default 'PENDING',
  saibweb_error text null,
  saibweb_synced_at timestamptz null,
  saibweb_external_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_items_non_negative check (total_items >= 0),
  constraint orders_total_value_non_negative check (total_value >= 0),
  constraint orders_total_cents_non_negative check (total_cents >= 0),
  constraint orders_wallet_non_negative check (wallet_used_cents >= 0 and spent_from_balance_cents >= 0 and pay_on_pickup_cents >= 0),
  constraint orders_status_valid check (
    status in (
      'recebido',
      'em_preparo',
      'saiu_para_entrega',
      'entregue',
      'cancelado',
      'aguardando_pagamento',
      'pago',
      'aguardando_separacao',
      'em_separacao',
      'pronto_para_retirada'
    )
  ),
  constraint orders_saibweb_status_valid check (
    saibweb_status in ('PENDING', 'PROCESSING', 'SYNCED', 'ERROR')
  )
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_employee_cpf_idx on public.orders (employee_cpf);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_saibweb_status_idx on public.orders (saibweb_status, created_at asc);

drop trigger if exists trg_orders_set_updated_at on public.orders;
create trigger trg_orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid null references public.products(id) on delete set null,
  product_old_id bigint null,
  product_name text null,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  unit_price_cents bigint not null default 0,
  subtotal numeric(12,2) generated always as (round((coalesce(unit_price, 0) * quantity)::numeric, 2)) stored,
  total_cents bigint generated always as (coalesce(unit_price_cents, 0) * quantity) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_non_negative check (unit_price >= 0),
  constraint order_items_unit_price_cents_non_negative check (unit_price_cents >= 0)
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists order_items_product_old_id_idx on public.order_items (product_old_id);

drop trigger if exists trg_order_items_set_updated_at on public.order_items;
create trigger trg_order_items_set_updated_at
before update on public.order_items
for each row
execute function public.set_updated_at();

create or replace function public.order_items_fill_compat_fields()
returns trigger
language plpgsql
as $$
begin
  if new.product_name is null and new.product_id is not null then
    select p.name, p.old_id
      into new.product_name, new.product_old_id
      from public.products p
     where p.id = new.product_id;
  end if;

  if coalesce(new.unit_price_cents, 0) = 0 and coalesce(new.unit_price, 0) > 0 then
    new.unit_price_cents = round(new.unit_price * 100)::bigint;
  end if;

  if coalesce(new.unit_price, 0) = 0 and coalesce(new.unit_price_cents, 0) > 0 then
    new.unit_price = round((new.unit_price_cents::numeric / 100), 2);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_order_items_fill_compat_fields on public.order_items;
create trigger trg_order_items_fill_compat_fields
before insert or update on public.order_items
for each row
execute function public.order_items_fill_compat_fields();

create or replace function public.recalculate_order_totals(p_order_id uuid)
returns void
language plpgsql
as $$
declare
  v_qty integer := 0;
  v_total_reais numeric(12,2) := 0;
  v_total_cents bigint := 0;
  v_old_total_cents bigint := 0;
  v_old_wallet bigint := 0;
  v_old_pickup bigint := 0;
  v_new_wallet bigint := 0;
  v_new_pickup bigint := 0;
begin
  select
    coalesce(sum(quantity), 0),
    coalesce(sum(subtotal), 0),
    coalesce(sum(total_cents), 0)
    into v_qty, v_total_reais, v_total_cents
  from public.order_items
  where order_id = p_order_id;

  select
    coalesce(total_cents, public.order_total_cents_legacy(total_value)),
    greatest(coalesce(wallet_used_cents, spent_from_balance_cents, 0), 0),
    greatest(
      coalesce(
        pay_on_pickup_cents,
        coalesce(total_cents, public.order_total_cents_legacy(total_value)) - coalesce(wallet_used_cents, spent_from_balance_cents, 0)
      ),
      0
    )
    into v_old_total_cents, v_old_wallet, v_old_pickup
  from public.orders
  where id = p_order_id;

  if v_old_total_cents <= 0 then
    v_new_wallet := least(v_old_wallet, v_total_cents);
  else
    v_new_wallet := round((v_old_wallet::numeric * v_total_cents::numeric) / v_old_total_cents::numeric)::bigint;
    v_new_wallet := least(greatest(v_new_wallet, 0), v_total_cents);
  end if;

  v_new_pickup := greatest(v_total_cents - v_new_wallet, 0);

  update public.orders
     set total_items = v_qty,
         total_value = round(v_total_reais, 2),
         total_cents = v_total_cents,
         wallet_used_cents = v_new_wallet,
         spent_from_balance_cents = v_new_wallet,
         pay_on_pickup_cents = v_new_pickup,
         wallet_debited = (v_new_wallet > 0),
         payment_method = public.compute_payment_method(v_new_wallet, v_new_pickup),
         updated_at = now()
   where id = p_order_id;

  if v_qty = 0 then
    update public.orders
       set status = 'cancelado',
           cancelled_at = coalesce(cancelled_at, now()),
           cancel_reason = coalesce(cancel_reason, 'Pedido esvaziado por remocao administrativa'),
           updated_at = now()
     where id = p_order_id;
  end if;
end;
$$;

create or replace function public.after_order_items_change_recalc()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_order_totals(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_after_order_items_change_recalc on public.order_items;
create trigger trg_after_order_items_change_recalc
after insert or update or delete on public.order_items
for each row
execute function public.after_order_items_change_recalc();

create table if not exists public.order_admin_actions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid null references public.order_items(id) on delete set null,
  actor_cpf text null,
  action text not null,
  reason text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_admin_actions_order_id_idx on public.order_admin_actions (order_id, created_at desc);
create index if not exists order_admin_actions_action_idx on public.order_admin_actions (action, created_at desc);

-- ============================================================
-- Conteudo / Avisos / Destaques / Tema
-- ============================================================

create table if not exists public.carousel_settings (
  id integer primary key,
  mode text not null default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carousel_settings_mode_valid check (mode in ('auto', 'manual'))
);

insert into public.carousel_settings (id, mode)
values (1, 'auto')
on conflict (id) do nothing;

drop trigger if exists trg_carousel_settings_set_updated_at on public.carousel_settings;
create trigger trg_carousel_settings_set_updated_at
before update on public.carousel_settings
for each row
execute function public.set_updated_at();

create table if not exists public.featured_products (
  position integer primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint featured_products_position_valid check (position between 1 and 20)
);

create index if not exists featured_products_active_idx on public.featured_products (active, position);

drop trigger if exists trg_featured_products_set_updated_at on public.featured_products;
create trigger trg_featured_products_set_updated_at
before update on public.featured_products
for each row
execute function public.set_updated_at();

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  is_published boolean not null default true,
  image_url text null,
  created_by_employee_id uuid null references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notices_title_not_blank check (btrim(title) <> '')
);

create index if not exists notices_published_created_at_idx on public.notices (is_published, created_at desc);

drop trigger if exists trg_notices_set_updated_at on public.notices;
create trigger trg_notices_set_updated_at
before update on public.notices
for each row
execute function public.set_updated_at();

create table if not exists public.app_theme_settings (
  id integer primary key,
  theme_key text not null default 'default',
  updated_at timestamptz not null default now()
);

insert into public.app_theme_settings (id, theme_key)
values (1, 'default')
on conflict (id) do nothing;

-- ============================================================
-- Ofertas do Delivery
-- ============================================================

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

drop trigger if exists trg_delivery_combos_set_updated_at on public.delivery_combos;
create trigger trg_delivery_combos_set_updated_at
before update on public.delivery_combos
for each row
execute function public.set_updated_at();

create table if not exists public.delivery_combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.delivery_combos(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists delivery_combo_item_unique
  on public.delivery_combo_items (combo_id, product_id);

create table if not exists public.delivery_recommendations (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('cart', 'checkout')),
  product_id uuid not null references public.products(id) on delete cascade,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists delivery_recommendations_placement_idx
  on public.delivery_recommendations (placement, priority, is_active);

create table if not exists public.delivery_cross_sell (
  id uuid primary key default gen_random_uuid(),
  source_product_id uuid not null references public.products(id) on delete cascade,
  target_product_id uuid not null references public.products(id) on delete cascade,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists delivery_cross_sell_source_idx
  on public.delivery_cross_sell (source_product_id, priority, is_active);

-- ============================================================
-- Eventos de visitantes / conversao
-- ============================================================

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

-- ============================================================
-- Cliente local -> pronto para futura migracao
-- Hoje o app ainda guarda cadastro em localStorage, mas estas
-- tabelas ajudam se voce quiser mover isso para o Supabase depois.
-- ============================================================

create table if not exists public.delivery_customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  document_cpf text null,
  primary_address text null,
  how_found_us text null,
  how_found_us_details text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_customers_name_not_blank check (btrim(full_name) <> ''),
  constraint delivery_customers_phone_not_blank check (btrim(phone) <> '')
);

create index if not exists delivery_customers_name_idx on public.delivery_customers using gin (full_name gin_trgm_ops);

drop trigger if exists trg_delivery_customers_set_updated_at on public.delivery_customers;
create trigger trg_delivery_customers_set_updated_at
before update on public.delivery_customers
for each row
execute function public.set_updated_at();

create table if not exists public.delivery_customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.delivery_customers(id) on delete cascade,
  label text null,
  cep text null,
  address_line text not null,
  city text null,
  state text null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_customer_addresses_line_not_blank check (btrim(address_line) <> '')
);

create index if not exists delivery_customer_addresses_customer_id_idx
  on public.delivery_customer_addresses (customer_id, is_primary desc, created_at desc);

drop trigger if exists trg_delivery_customer_addresses_set_updated_at on public.delivery_customer_addresses;
create trigger trg_delivery_customer_addresses_set_updated_at
before update on public.delivery_customer_addresses
for each row
execute function public.set_updated_at();

-- ============================================================
-- Views / RPCs
-- ============================================================

create or replace function public.get_top_selling_products(limit_count integer default 5)
returns table (
  product_id uuid,
  product_name text,
  total_quantity bigint,
  image_path text
)
language sql
stable
as $$
  select
    oi.product_id,
    coalesce(max(oi.product_name), max(p.name)) as product_name,
    sum(oi.quantity)::bigint as total_quantity,
    max(p.image_path) as image_path
  from public.order_items oi
  join public.orders o
    on o.id = oi.order_id
  left join public.products p
    on p.id = oi.product_id
  where coalesce(o.status, '') <> 'cancelado'
    and oi.product_id is not null
  group by oi.product_id
  order by sum(oi.quantity) desc, coalesce(max(oi.product_name), max(p.name)) asc
  limit greatest(coalesce(limit_count, 5), 1);
$$;

create or replace function public.admin_get_employees_basic()
returns table (
  id uuid,
  cpf text,
  full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.cpf, e.full_name
  from public.employees e
  order by e.full_name asc;
$$;

create or replace function public.admin_cancel_order_v2(
  p_order_id uuid,
  p_reason text,
  p_actor_cpf text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_order_id is null then
    raise exception 'p_order_id obrigatorio';
  end if;

  update public.orders
     set status = 'cancelado',
         cancelled_at = now(),
         cancel_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         updated_at = now()
   where id = p_order_id;

  if not found then
    raise exception 'Pedido nao encontrado';
  end if;

  insert into public.order_admin_actions (
    order_id,
    actor_cpf,
    action,
    reason,
    payload
  ) values (
    p_order_id,
    nullif(public.only_digits(p_actor_cpf), ''),
    'cancel_order',
    nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object('source', 'admin_cancel_order_v2')
  );
end;
$$;

create or replace function public.admin_remove_order_item_v3(
  p_order_id uuid,
  p_order_item_id uuid,
  p_reason text,
  p_actor_cpf text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_name text;
  v_qty integer;
  v_total_cents bigint;
begin
  select product_name, quantity, total_cents
    into v_product_name, v_qty, v_total_cents
  from public.order_items
  where id = p_order_item_id
    and order_id = p_order_id;

  if not found then
    raise exception 'Item do pedido nao encontrado';
  end if;

  delete from public.order_items
   where id = p_order_item_id
     and order_id = p_order_id;

  perform public.recalculate_order_totals(p_order_id);

  insert into public.order_admin_actions (
    order_id,
    order_item_id,
    actor_cpf,
    action,
    reason,
    payload
  ) values (
    p_order_id,
    p_order_item_id,
    nullif(public.only_digits(p_actor_cpf), ''),
    'remove_order_item',
    nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object(
      'product_name', v_product_name,
      'removed_quantity', v_qty,
      'removed_total_cents', v_total_cents,
      'source', 'admin_remove_order_item_v3'
    )
  );
end;
$$;

create or replace function public.admin_remove_order_item_qty_v1(
  p_order_id uuid,
  p_order_item_id uuid,
  p_remove_qty integer,
  p_reason text,
  p_actor_cpf text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_qty integer;
  v_product_name text;
  v_unit_cents bigint;
begin
  if coalesce(p_remove_qty, 0) <= 0 then
    raise exception 'Quantidade a remover deve ser maior que zero';
  end if;

  select quantity, product_name, unit_price_cents
    into v_current_qty, v_product_name, v_unit_cents
  from public.order_items
  where id = p_order_item_id
    and order_id = p_order_id;

  if not found then
    raise exception 'Item do pedido nao encontrado';
  end if;

  if p_remove_qty >= v_current_qty then
    perform public.admin_remove_order_item_v3(
      p_order_id,
      p_order_item_id,
      p_reason,
      p_actor_cpf
    );
    return;
  end if;

  update public.order_items
     set quantity = quantity - p_remove_qty,
         updated_at = now()
   where id = p_order_item_id
     and order_id = p_order_id;

  perform public.recalculate_order_totals(p_order_id);

  insert into public.order_admin_actions (
    order_id,
    order_item_id,
    actor_cpf,
    action,
    reason,
    payload
  ) values (
    p_order_id,
    p_order_item_id,
    nullif(public.only_digits(p_actor_cpf), ''),
    'remove_order_item_qty',
    nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object(
      'product_name', v_product_name,
      'removed_quantity', p_remove_qty,
      'unit_price_cents', v_unit_cents,
      'removed_total_cents', coalesce(v_unit_cents, 0) * p_remove_qty,
      'source', 'admin_remove_order_item_qty_v1'
    )
  );
end;
$$;

create or replace view public.rh_spending_report as
select
  coalesce(o.employee_id, e.id) as employee_id,
  coalesce(
    nullif(o.employee_name, ''),
    e.full_name,
    'Funcionario nao identificado'
  ) as employee_name,
  coalesce(nullif(o.employee_cpf, ''), e.cpf) as employee_cpf,
  to_char(date_trunc('month', o.created_at), 'YYYY-MM') as month_key,
  count(*)::bigint as orders_count,
  round(sum(coalesce(o.total_value, 0)), 2) as total_spent,
  round(sum(coalesce(o.spent_from_balance_cents, o.wallet_used_cents, 0)) / 100.0, 2) as payroll_discount,
  round(sum(coalesce(o.pay_on_pickup_cents, 0)) / 100.0, 2) as spent_pay_on_pickup
from public.orders o
left join public.employees e
  on e.cpf = o.employee_cpf
where coalesce(o.status, '') <> 'cancelado'
group by
  coalesce(o.employee_id, e.id),
  coalesce(nullif(o.employee_name, ''), e.full_name, 'Funcionario nao identificado'),
  coalesce(nullif(o.employee_cpf, ''), e.cpf),
  to_char(date_trunc('month', o.created_at), 'YYYY-MM');

-- ============================================================
-- RLS
-- ============================================================

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.weight enable row level security;
alter table public.employees enable row level security;
alter table public.hr_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_admin_actions enable row level security;
alter table public.carousel_settings enable row level security;
alter table public.featured_products enable row level security;
alter table public.notices enable row level security;
alter table public.app_theme_settings enable row level security;
alter table public.delivery_combos enable row level security;
alter table public.delivery_combo_items enable row level security;
alter table public.delivery_recommendations enable row level security;
alter table public.delivery_cross_sell enable row level security;
alter table public.delivery_customer_events enable row level security;
alter table public.delivery_customers enable row level security;
alter table public.delivery_customer_addresses enable row level security;

-- Catalogo publico
drop policy if exists product_categories_select_all on public.product_categories;
create policy product_categories_select_all on public.product_categories
for select to anon, authenticated using (true);

drop policy if exists products_select_all on public.products;
create policy products_select_all on public.products
for select to anon, authenticated using (true);

drop policy if exists products_write_all_local on public.products;
create policy products_write_all_local on public.products
for all to anon, authenticated using (true) with check (true);

drop policy if exists weight_select_all on public.weight;
create policy weight_select_all on public.weight
for select to anon, authenticated using (true);

drop policy if exists weight_write_all_local on public.weight;
create policy weight_write_all_local on public.weight
for all to anon, authenticated using (true) with check (true);

-- Funcionarios / RH
drop policy if exists employees_select_all_local on public.employees;
create policy employees_select_all_local on public.employees
for select to anon, authenticated using (true);

drop policy if exists employees_write_all_local on public.employees;
create policy employees_write_all_local on public.employees
for all to anon, authenticated using (true) with check (true);

drop policy if exists hr_users_select_authenticated on public.hr_users;
create policy hr_users_select_authenticated on public.hr_users
for select to authenticated using (true);

drop policy if exists hr_users_write_authenticated on public.hr_users;
create policy hr_users_write_authenticated on public.hr_users
for all to authenticated using (true) with check (true);

-- Pedidos
drop policy if exists orders_select_all_local on public.orders;
create policy orders_select_all_local on public.orders
for select to anon, authenticated using (true);

drop policy if exists orders_insert_all_local on public.orders;
create policy orders_insert_all_local on public.orders
for insert to anon, authenticated with check (true);

drop policy if exists orders_update_all_local on public.orders;
create policy orders_update_all_local on public.orders
for update to anon, authenticated using (true) with check (true);

drop policy if exists order_items_select_all_local on public.order_items;
create policy order_items_select_all_local on public.order_items
for select to anon, authenticated using (true);

drop policy if exists order_items_insert_all_local on public.order_items;
create policy order_items_insert_all_local on public.order_items
for insert to anon, authenticated with check (true);

drop policy if exists order_items_update_all_local on public.order_items;
create policy order_items_update_all_local on public.order_items
for update to anon, authenticated using (true) with check (true);

drop policy if exists order_items_delete_all_local on public.order_items;
create policy order_items_delete_all_local on public.order_items
for delete to anon, authenticated using (true);

drop policy if exists order_admin_actions_select_all_local on public.order_admin_actions;
create policy order_admin_actions_select_all_local on public.order_admin_actions
for select to anon, authenticated using (true);

drop policy if exists order_admin_actions_insert_all_local on public.order_admin_actions;
create policy order_admin_actions_insert_all_local on public.order_admin_actions
for insert to anon, authenticated with check (true);

-- Conteudo / avisos / destaques
drop policy if exists carousel_settings_select_all on public.carousel_settings;
create policy carousel_settings_select_all on public.carousel_settings
for select to anon, authenticated using (true);

drop policy if exists carousel_settings_write_all_local on public.carousel_settings;
create policy carousel_settings_write_all_local on public.carousel_settings
for all to anon, authenticated using (true) with check (true);

drop policy if exists featured_products_select_all on public.featured_products;
create policy featured_products_select_all on public.featured_products
for select to anon, authenticated using (true);

drop policy if exists featured_products_write_all_local on public.featured_products;
create policy featured_products_write_all_local on public.featured_products
for all to anon, authenticated using (true) with check (true);

drop policy if exists notices_select_all on public.notices;
create policy notices_select_all on public.notices
for select to anon, authenticated using (true);

drop policy if exists notices_write_all_local on public.notices;
create policy notices_write_all_local on public.notices
for all to anon, authenticated using (true) with check (true);

drop policy if exists app_theme_settings_read_all on public.app_theme_settings;
create policy app_theme_settings_read_all on public.app_theme_settings
for select to anon, authenticated using (true);

drop policy if exists app_theme_settings_write_all_local on public.app_theme_settings;
create policy app_theme_settings_write_all_local on public.app_theme_settings
for all to anon, authenticated using (true) with check (true);

-- Ofertas
drop policy if exists delivery_combos_read_all on public.delivery_combos;
create policy delivery_combos_read_all on public.delivery_combos
for select to anon, authenticated using (true);

drop policy if exists delivery_combos_write_all_local on public.delivery_combos;
create policy delivery_combos_write_all_local on public.delivery_combos
for all to anon, authenticated using (true) with check (true);

drop policy if exists delivery_combo_items_read_all on public.delivery_combo_items;
create policy delivery_combo_items_read_all on public.delivery_combo_items
for select to anon, authenticated using (true);

drop policy if exists delivery_combo_items_write_all_local on public.delivery_combo_items;
create policy delivery_combo_items_write_all_local on public.delivery_combo_items
for all to anon, authenticated using (true) with check (true);

drop policy if exists delivery_recommendations_read_all on public.delivery_recommendations;
create policy delivery_recommendations_read_all on public.delivery_recommendations
for select to anon, authenticated using (true);

drop policy if exists delivery_recommendations_write_all_local on public.delivery_recommendations;
create policy delivery_recommendations_write_all_local on public.delivery_recommendations
for all to anon, authenticated using (true) with check (true);

drop policy if exists delivery_cross_sell_read_all on public.delivery_cross_sell;
create policy delivery_cross_sell_read_all on public.delivery_cross_sell
for select to anon, authenticated using (true);

drop policy if exists delivery_cross_sell_write_all_local on public.delivery_cross_sell;
create policy delivery_cross_sell_write_all_local on public.delivery_cross_sell
for all to anon, authenticated using (true) with check (true);

-- Eventos / clientes
drop policy if exists delivery_customer_events_insert_anon on public.delivery_customer_events;
create policy delivery_customer_events_insert_anon on public.delivery_customer_events
for insert to anon, authenticated with check (true);

drop policy if exists delivery_customer_events_read_all_local on public.delivery_customer_events;
create policy delivery_customer_events_read_all_local on public.delivery_customer_events
for select to anon, authenticated using (true);

drop policy if exists delivery_customers_all_local on public.delivery_customers;
create policy delivery_customers_all_local on public.delivery_customers
for all to anon, authenticated using (true) with check (true);

drop policy if exists delivery_customer_addresses_all_local on public.delivery_customer_addresses;
create policy delivery_customer_addresses_all_local on public.delivery_customer_addresses
for all to anon, authenticated using (true) with check (true);

-- ============================================================
-- Permissions on RPCs / Views
-- ============================================================

grant usage on schema public to anon, authenticated;
grant select on public.rh_spending_report to anon, authenticated;
grant execute on function public.current_pay_cycle_key() to anon, authenticated;
grant execute on function public.get_top_selling_products(integer) to anon, authenticated;
grant execute on function public.admin_get_employees_basic() to anon, authenticated;
grant execute on function public.admin_cancel_order_v2(uuid, text, text) to anon, authenticated;
grant execute on function public.admin_remove_order_item_v3(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.admin_remove_order_item_qty_v1(uuid, uuid, integer, text, text) to anon, authenticated;

-- ============================================================
-- Realtime
-- ============================================================

do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

-- ============================================================
-- Storage buckets
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('products', 'products', true),
  ('notice-images', 'notice-images', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "products_bucket_public_read" on storage.objects;
create policy "products_bucket_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'products');

drop policy if exists "products_bucket_public_write" on storage.objects;
create policy "products_bucket_public_write"
on storage.objects
for all
to anon, authenticated
using (bucket_id = 'products')
with check (bucket_id = 'products');

drop policy if exists "notice_images_bucket_public_read" on storage.objects;
create policy "notice_images_bucket_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'notice-images');

drop policy if exists "notice_images_bucket_public_write" on storage.objects;
create policy "notice_images_bucket_public_write"
on storage.objects
for all
to anon, authenticated
using (bucket_id = 'notice-images')
with check (bucket_id = 'notice-images');

commit;

-- ============================================================
-- Seed opcional minimo
-- ============================================================
-- insert into public.products (old_id, name, employee_price, price, category_id, image_path)
-- values
--   (1001, 'Pao de Queijo Tradicional 1kg', 25.90, 25.90, 1, null),
--   (1002, 'Coxinha Congelada 1kg', 29.90, 29.90, 3, null);
