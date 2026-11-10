-- SHAKH STORE / M04: product catalog and inventory foundation.
-- Additive only; preserves migrations 0001-0004.

begin;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text,
  category text not null check (category in ('food','grocery','produce','meat_seafood','drinks','household','other')),
  price_iqd bigint not null check (price_iqd > 0),
  image_url text,
  sku text,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_sku_owner_unique unique (owner_id, sku)
);

create index if not exists products_store_active_created_idx
  on public.products(store_id, is_active, created_at desc);
create index if not exists products_owner_created_idx
  on public.products(owner_id, created_at desc);
create index if not exists products_category_active_idx
  on public.products(category, is_active);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists products_public_active_read on public.products;
create policy products_public_active_read
on public.products for select to anon, authenticated
using (is_active = true);

drop policy if exists products_owner_read on public.products;
create policy products_owner_read
on public.products for select to authenticated
using (owner_id = (select auth.uid()));

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;

comment on table public.products is
  'SHAKH STORE catalog. Mutations are restricted to trusted server-side APIs; price_iqd is integer IQD.';
commit;
