-- Tabela de slots da roleta (gerenciados pelo admin)
create table if not exists coupon_slots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  type text not null check (type in ('percent', 'free_shipping')),
  value integer not null default 0,
  weight integer not null default 1,
  is_active boolean not null default true,
  created_at timestamp with time zone default now()
);

-- Tabela de cupons gerados por usuário
create table if not exists user_coupons (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  code text not null unique,
  coupon_slot_id uuid references coupon_slots(id) on delete set null,
  type text not null,
  value integer not null default 0,
  label text not null,
  used boolean not null default false,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

create index if not exists user_coupons_phone_idx on user_coupons (customer_phone);
create index if not exists user_coupons_code_idx on user_coupons (code);

-- Colunas de desconto na tabela de pedidos
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists discount_cents integer default 0;

-- Slots padrão
insert into coupon_slots (label, type, value, weight, is_active) values
  ('5% de desconto', 'percent', 5, 3, true),
  ('10% de desconto', 'percent', 10, 2, true),
  ('Frete grátis', 'free_shipping', 0, 1, true)
on conflict do nothing;
