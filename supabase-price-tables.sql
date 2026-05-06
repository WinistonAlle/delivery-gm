-- Price tables and CPF/CNPJ order/customer compatibility.

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price_table text not null,
  price numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_prices_table_valid check (price_table in ('varejo', 'atacado_2')),
  constraint product_prices_price_non_negative check (price >= 0),
  constraint product_prices_unique unique (product_id, price_table)
);

create index if not exists product_prices_product_id_idx
  on public.product_prices (product_id);

alter table public.product_prices enable row level security;

drop policy if exists product_prices_public_select on public.product_prices;
create policy product_prices_public_select on public.product_prices
for select
using (true);

grant select on public.product_prices to anon, authenticated;

drop trigger if exists trg_product_prices_set_updated_at on public.product_prices;
create trigger trg_product_prices_set_updated_at
before update on public.product_prices
for each row
execute function public.set_updated_at();

insert into public.product_prices (product_id, price_table, price)
select p.id, 'varejo', p.employee_price
from public.products p
on conflict (product_id, price_table) do update
set price = excluded.price;

alter table public.orders add column if not exists customer_type text null;
alter table public.orders add column if not exists customer_document text null;
alter table public.orders add column if not exists price_table_used text null;
alter table public.orders add column if not exists subtotal_products numeric(12,2) null;
alter table public.orders add column if not exists delivery_fee numeric(12,2) null;
alter table public.orders add column if not exists discount numeric(12,2) null;

alter table public.order_items add column if not exists original_retail_price numeric(12,2) null;
alter table public.order_items add column if not exists price_table_used text null;
alter table public.order_items add column if not exists total_item_price numeric(12,2) null;

alter table public.delivery_customers add column if not exists customer_type text null;
alter table public.delivery_customers add column if not exists document_cnpj text null;
alter table public.delivery_customers add column if not exists company_legal_name text null;
alter table public.delivery_customers add column if not exists company_trade_name text null;
alter table public.delivery_customers add column if not exists state_registration text null;
alter table public.delivery_customers add column if not exists order_responsible_name text null;
