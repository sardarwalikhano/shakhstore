\set ON_ERROR_STOP on

-- Isolated PostgreSQL 17 fixture for M18.
-- Never connects to Supabase Production and contains no real customer data.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null,
  slug text not null unique,
  store_type text not null,
  description text,
  phone text,
  address text,
  status text not null default 'pending',
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  delivery_fee_iqd bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id),
  owner_id uuid not null references auth.users(id),
  name text not null,
  description text,
  category text not null,
  price_iqd bigint not null,
  image_url text,
  sku text,
  stock_quantity integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references auth.users(id),
  store_id uuid not null references public.stores(id),
  status text not null default 'pending',
  subtotal_iqd bigint not null,
  delivery_fee_iqd bigint not null default 0,
  total_iqd bigint not null,
  customer_name text,
  customer_phone text,
  delivery_address text not null,
  customer_note text,
  merchant_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  product_name text not null,
  unit_price_iqd bigint not null,
  quantity integer not null,
  created_at timestamptz not null default now()
);

-- Confirm M18 removes the prior RPC signature rather than leaving an older
-- callable version exposed after the new function is installed.
create function public.place_store_order(
  uuid,jsonb,text,text,text,text,bigint
) returns uuid language sql as $$ select gen_random_uuid() $$;

\i supabase/migrations/20261114071730_store_service_zones_and_checkout_phone.sql

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

insert into public.stores(
  id,owner_id,name,slug,store_type,status,delivery_fee_iqd,
  service_center_lat,service_center_lng,service_radius_km
) values (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'Test Supermarket','test-supermarket','supermarket','approved',1000,
  36.19,44.01,5
);

insert into public.products(
  id,store_id,owner_id,name,category,price_iqd,stock_quantity,is_active
) values (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'Test Product','grocery',2500,10,true
);

-- The old signature must be gone and the new, service-role-only RPC installed.
do $$
begin
  if to_regprocedure('public.place_store_order(uuid,jsonb,text,text,text,text,bigint)') is not null then
    raise exception 'M18 did not remove the legacy place_store_order signature';
  end if;
  if has_function_privilege(
    'anon',
    'public.place_store_order(uuid,jsonb,text,text,text,text,bigint,double precision,double precision)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute the service-role order RPC';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.place_store_order(uuid,jsonb,text,text,text,text,bigint,double precision,double precision)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute the service-role order RPC';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.place_store_order(uuid,jsonb,text,text,text,text,bigint,double precision,double precision)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute the new order RPC';
  end if;
end
$$;

set role service_role;

-- Inside-zone order succeeds, stores the customer's telephone number,
-- and decrements stock exactly once.
select public.place_store_order(
  '11111111-1111-4111-8111-111111111111',
  '[{"product_id":"44444444-4444-4444-8444-444444444444","quantity":2}]'::jsonb,
  'Erbil, Test Street, Building 1',
  'Test Customer',
  '07501234567',
  null,
  1000,
  36.20,
  44.02
) as inside_zone_order_id
\gset

reset role;

do $$
declare
  v_phone text;
  v_count integer;
  v_stock integer;
  v_total bigint;
begin
  select customer_phone,total_iqd into v_phone,v_total
    from public.orders order by created_at desc limit 1;
  if v_phone <> '07501234567' then
    raise exception 'Customer phone was not persisted on the order';
  end if;
  if v_total <> 6000 then
    raise exception 'Unexpected order total: %', v_total;
  end if;
  select count(*) into v_count from public.order_items
    where order_id = (select id from public.orders order by created_at desc limit 1);
  if v_count <> 1 then
    raise exception 'Expected one order item, got %', v_count;
  end if;
  select stock_quantity into v_stock from public.products
    where id = '44444444-4444-4444-8444-444444444444';
  if v_stock <> 8 then
    raise exception 'Expected stock 8 after one order, got %', v_stock;
  end if;
end
$$;

-- Outside-zone destination is rejected and must not create an order or
-- decrement inventory.
set role service_role;
do $$
begin
  begin
    perform public.place_store_order(
      '11111111-1111-4111-8111-111111111111',
      '[{"product_id":"44444444-4444-4444-8444-444444444444","quantity":1}]'::jsonb,
      'Erbil, Far Away Street, Building 2',
      'Test Customer',
      '07501234567',
      null,
      1000,
      36.30,
      44.01
    );
    raise exception 'Expected outside-zone rejection';
  exception
    when others then
      if sqlerrm not like '%Delivery location is outside service zone%' then
        raise;
      end if;
  end;
end
$$;
reset role;

-- Missing/invalid mobile number is rejected before any order is written.
set role service_role;
do $$
begin
  begin
    perform public.place_store_order(
      '11111111-1111-4111-8111-111111111111',
      '[{"product_id":"44444444-4444-4444-8444-444444444444","quantity":1}]'::jsonb,
      'Erbil, Test Street, Building 1',
      'Test Customer',
      null,
      null,
      1000,
      36.20,
      44.02
    );
    raise exception 'Expected missing-phone rejection';
  exception
    when others then
      if sqlerrm not like '%Customer phone is required or invalid%' then
        raise;
      end if;
  end;
end
$$;
reset role;

-- Malformed mobile numbers and invalid GPS coordinates are rejected.
set role service_role;
do $
begin
  begin
    perform public.place_store_order(
      '11111111-1111-4111-8111-111111111111',
      '[{"product_id":"44444444-4444-4444-8444-444444444444","quantity":1}]'::jsonb,
      'Erbil, Test Street, Building 1',
      'Test Customer',
      'abc12345',
      null,
      1000,
      36.20,
      44.02
    );
    raise exception 'Expected malformed-phone rejection';
  exception
    when others then
      if sqlerrm not like '%Customer phone is required or invalid%' then
        raise;
      end if;
  end;

  begin
    perform public.place_store_order(
      '11111111-1111-4111-8111-111111111111',
      '[{"product_id":"44444444-4444-4444-8444-444444444444","quantity":1}]'::jsonb,
      'Erbil, Test Street, Building 1',
      'Test Customer',
      '07501234567',
      null,
      1000,
      null,
      44.02
    );
    raise exception 'Expected missing-GPS rejection';
  exception
    when others then
      if sqlerrm not like '%Delivery location is required or invalid%' then
        raise;
      end if;
  end;

  begin
    perform public.place_store_order(
      '11111111-1111-4111-8111-111111111111',
      '[{"product_id":"44444444-4444-4444-8444-444444444444","quantity":1}]'::jsonb,
      'Erbil, Test Street, Building 1',
      'Test Customer',
      '07501234567',
      null,
      1000,
      91,
      44.02
    );
    raise exception 'Expected out-of-range-GPS rejection';
  exception
    when others then
      if sqlerrm not like '%Delivery location is required or invalid%' then
        raise;
      end if;
  end;
end
$;
reset role;

-- A store without all three service-zone values is not orderable.
update public.stores
  set service_center_lat = null,
      service_center_lng = null,
      service_radius_km = null
  where id = '33333333-3333-4333-8333-333333333333';

set role service_role;
do $$
begin
  begin
    perform public.place_store_order(
      '11111111-1111-4111-8111-111111111111',
      '[{"product_id":"44444444-4444-4444-8444-444444444444","quantity":1}]'::jsonb,
      'Erbil, Test Street, Building 1',
      'Test Customer',
      '07501234567',
      null,
      1000,
      36.20,
      44.02
    );
    raise exception 'Expected missing-zone rejection';
  exception
    when others then
      if sqlerrm not like '%Store delivery zone is not configured%' then
        raise;
      end if;
  end;
end
$$;
reset role;

-- Partially configured zone must fail the table CHECK constraint.
do $$
begin
  begin
    update public.stores
      set service_center_lat = 36.19
      where id = '33333333-3333-4333-8333-333333333333';
    raise exception 'Expected partial-zone constraint rejection';
  exception
    when check_violation then
      null;
  end;
end
$$;

-- Failed orders did not leave extra order or order-item rows and did not
-- consume additional stock.
do $$
declare
  v_orders integer;
  v_items integer;
  v_stock integer;
begin
  select count(*) into v_orders from public.orders;
  select count(*) into v_items from public.order_items;
  select stock_quantity into v_stock from public.products
    where id = '44444444-4444-4444-8444-444444444444';
  if v_orders <> 1 or v_items <> 1 or v_stock <> 8 then
    raise exception 'Failed order attempts changed data: orders %, items %, stock %',
      v_orders,v_items,v_stock;
  end if;
end
$$;

\echo 'PASS: M18 service-zone and checkout phone integration tests'
