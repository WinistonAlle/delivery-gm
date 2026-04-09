alter table public.products
add column if not exists sale_type text not null default 'kg';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_sale_type_valid'
  ) then
    alter table public.products
    add constraint products_sale_type_valid
    check (sale_type in ('kg', 'pct'));
  end if;
end $$;
