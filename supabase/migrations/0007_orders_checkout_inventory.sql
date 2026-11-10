-- SHAKH STORE / M05: order placement and merchant order lifecycle.
-- All order writes are performed by trusted server-side APIs via service-role RPC.
-- Prices are snapshotted in IQD at checkout; stock is reserved atomically.

begin;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references auth.users(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','confirmed','preparing','ready','out_for_delivery','delivered','cancelled')),
  subtotal_iqd bigint not null check (subtotal_iqd > 0),
  delivery_fee_iqd bigint not null default 0 check (delivery_fee_iqd >= 0),
  total_iqd bigint not null check (total_iqd = subtotal_iqd + delivery_fee_iqd),
  customer_name text,
  customer_phone text,
  delivery_address text not null check (char_length(trim(delivery_address)) between 5 and 1000),
  customer_note text,
  merchant_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  unit_price_iqd bigint not null check (unit_price_iqd > 0),
  quantity integer not null check (quantity > 0 and quantity <= 10000),
  line_total_iqd bigint generated always as (unit_price_iqd * quantity) stored,
  created_at timestamptz not null default now()
);

create index if not exists orders_customer_created_idx
  on public.orders(customer_id, created_at desc);
create index if not exists orders_store_status_created_idx
  on public.orders(store_id, status, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists orders_customer_read on public.orders;
create policy orders_customer_read on public.orders
for select to authenticated using (customer_id = (select auth.uid()));

drop policy if exists orders_store_owner_read on public.orders;
create policy orders_store_owner_read on public.orders
for select to authenticated using (
  exists (select 1 from public.stores s
    where s.id = orders.store_id and s.owner_id = (select auth.uid()))
);

drop policy if exists order_items_participant_read on public.order_items;
create policy order_items_participant_read on public.order_items
for select to authenticated using (
  exists (select 1 from public.orders o
    left join public.stores s on s.id = o.store_id
    where o.id = order_items.order_id
      and (o.customer_id = (select auth.uid()) or s.owner_id = (select auth.uid())))
);

revoke all on public.orders, public.order_items from anon, authenticated;
grant select on public.orders, public.order_items to authenticated;

create or replace function public.place_store_order(
  p_customer_id uuid,
  p_items jsonb,
  p_delivery_address text,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_note text default null,
  p_delivery_fee_iqd bigint default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_subtotal bigint := 0;
  v_total bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_count integer := 0;
begin
  if p_customer_id is null then raise exception 'Customer is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Order must contain between 1 and 50 items';
  end if;
  if p_delivery_address is null or char_length(trim(p_delivery_address)) < 5 then
    raise exception 'Delivery address is required';
  end if;
  if p_delivery_fee_iqd is null or p_delivery_fee_iqd < 0 or p_delivery_fee_iqd > 100000000 then
    raise exception 'Invalid delivery fee';
  end if;

  -- Lock products in deterministic ID order to reduce deadlock risk.
  for v_item in
    select value from jsonb_array_elements(p_items)
    order by (value->>'product_id')
  loop
    if coalesce(v_item->>'product_id','') !~* '^[0-9a-f-]{36}$' then
      raise exception 'Invalid product ID';
    end if;
    if coalesce(v_item->>'quantity','') !~ '^[0-9]+$' then
      raise exception 'Invalid quantity';
    end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 10000 then raise exception 'Invalid quantity'; end if;

    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and is_active = true
      for update;
    if not found then raise exception 'Product is unavailable'; end if;
    if v_store_id is null then v_store_id := v_product.store_id;
    elsif v_store_id is distinct from v_product.store_id then
      raise exception 'An order can contain products from one store only';
    end if;
    if v_product.store_id is null then raise exception 'Platform products are not orderable yet'; end if;
    if v_product.stock_quantity < v_qty then raise exception 'Insufficient stock for %', v_product.name; end if;
    v_subtotal := v_subtotal + (v_product.price_iqd * v_qty);
    v_count := v_count + 1;
  end loop;

  if v_count <> jsonb_array_length(p_items) then raise exception 'Invalid order items'; end if;
  if not exists (select 1 from public.stores where id = v_store_id and status = 'approved') then
    raise exception 'Store is unavailable';
  end if;
  if v_subtotal <= 0 or v_subtotal > 9000000000000 then raise exception 'Order total is invalid'; end if;

  v_total := v_subtotal + p_delivery_fee_iqd;
  v_order_number := 'SHK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  insert into public.orders(
    order_number, customer_id, store_id, subtotal_iqd, delivery_fee_iqd, total_iqd,
    customer_name, customer_phone, delivery_address, customer_note
  ) values (
    v_order_number, p_customer_id, v_store_id, v_subtotal, p_delivery_fee_iqd, v_total,
    nullif(trim(p_customer_name),''), nullif(trim(p_customer_phone),''),
    trim(p_delivery_address), nullif(trim(p_customer_note),'')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid for update;
    v_qty := (v_item->>'quantity')::integer;
    update public.products set stock_quantity = stock_quantity - v_qty
      where id = v_product.id;
    insert into public.order_items(order_id, product_id, product_name, unit_price_iqd, quantity)
      values (v_order_id, v_product.id, v_product.name, v_product.price_iqd, v_qty);
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.place_store_order(uuid,jsonb,text,text,text,text,bigint)
  from public, anon, authenticated;
grant execute on function public.place_store_order(uuid,jsonb,text,text,text,text,bigint)
  to service_role;

comment on table public.orders is 'Customer orders; totals and item prices are immutable checkout snapshots.';
comment on function public.place_store_order(uuid,jsonb,text,text,text,text,bigint) is
  'Atomically validates a single-store cart, snapshots IQD prices and reserves product stock.';

commit;
