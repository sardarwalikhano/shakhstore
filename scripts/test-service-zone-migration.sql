\set ON_ERROR_STOP on

-- Isolated PostgreSQL 17 fixture for M18. This never connects to Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create table public.stores (
  id uuid primary key,
  status text not null
);

create table public.products (
  id uuid primary key,
  store_id uuid not null references public.stores(id),
  name text not null,
  price_iqd bigint not null check (price_iqd > 0),
  stock_quantity integer not null check (stock_quantity >= 0),
  is_active boolean not null default true
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null,
  store_id uuid not null references public.stores(id),
  subtotal_iqd bigint not null,
  delivery_fee_iqd bigint not null,
  total_iqd bigint not null,
  customer_name text,
  customer_phone text,
  delivery_address text not null,
  customer_note text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  product_name text not null,
  unit_price_iqd bigint not null,
  quantity integer not null check (quantity > 0),
  line_total_iqd bigint generated always as (unit_price_iqd * quantity) stored
);

\i supabase/migrations/20261114071730_store_service_zones_and_checkout_phone.sql

insert into public.stores(id, status, service_center_lat, service_center_lng, service_radius_km) values
  ('20000000-0000-0000-0000-000000000001', 'approved', 0, 0, 10),
  ('20000000-0000-0000-0000-000000000002', 'approved', null, null, null);

insert into public.products(id, store_id, name, price_iqd, stock_quantity) values
  ('30000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'Product inside zone', 2000, 5),
  ('30000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000002', 'Product without zone', 3000, 5);

-- A zone is either completely unset or completely valid; partial settings fail.
do $$
begin
  begin
    update public.stores
       set service_center_lat = 1
     where id = '20000000-0000-0000-0000-000000000002';
    raise exception 'Expected partially configured service zone to fail';
  exception when check_violation then
    null;
  end;
end;
$$;

-- Missing or malformed phone must be rejected by the database RPC itself.
do $$
begin
  begin
    perform public.place_store_order(
      '40000000-0000-0000-0000-000000000001',
      '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,
      'Test address, Erbil',
      null, null, null, 500, 0, 0
    );
    raise exception 'Expected missing phone to fail';
  exception when raise_exception then
    if sqlerrm <> 'Customer phone is required or invalid' then raise; end if;
  end;

  begin
    perform public.place_store_order(
      '40000000-0000-0000-0000-000000000001',
      '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,
      'Test address, Erbil',
      null, 'abc12345', null, 500, 0, 0
    );
    raise exception 'Expected malformed phone to fail';
  exception when raise_exception then
    if sqlerrm <> 'Customer phone is required or invalid' then raise; end if;
  end;

  begin
    perform public.place_store_order(
      '40000000-0000-0000-0000-000000000001',
      '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,
      'Test address, Erbil',
      null, '07712345678', null, 500, null, 0
    );
    raise exception 'Expected missing coordinates to fail';
  exception when raise_exception then
    if sqlerrm <> 'Delivery location is required or invalid' then raise; end if;
  end;

  begin
    perform public.place_store_order(
      '40000000-0000-0000-0000-000000000001',
      '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,
      'Test address, Erbil',
      null, '07712345678', null, 500, 91, 0
    );
    raise exception 'Expected invalid coordinates to fail';
  exception when raise_exception then
    if sqlerrm <> 'Delivery location is required or invalid' then raise; end if;
  end;
end;
$$;

-- A customer outside the configured circle is refused, before stock changes.
do $$
begin
  begin
    perform public.place_store_order(
      '40000000-0000-0000-0000-000000000002',
      '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,
      'Outside address, Erbil',
      null, '07712345678', null, 500, 0, 1
    );
    raise exception 'Expected outside-zone delivery to fail';
  exception when raise_exception then
    if sqlerrm <> 'Delivery location is outside service zone' then raise; end if;
  end;
end;
$$;

-- A store without a configured service zone cannot accept an order.
do $$
begin
  begin
    perform public.place_store_order(
      '40000000-0000-0000-0000-000000000003',
      '[{"product_id":"30000000-0000-0000-0000-000000000002","quantity":1}]'::jsonb,
      'Unconfigured address, Erbil',
      null, '07712345678', null, 500, 0, 0
    );
    raise exception 'Expected unconfigured service zone to fail';
  exception when raise_exception then
    if sqlerrm <> 'Store delivery zone is not configured' then raise; end if;
  end;
end;
$$;

-- A valid in-zone order stores the contact phone and decrements stock once.
do $$
declare
  v_order_id uuid;
  v_phone text;
  v_total bigint;
  v_stock integer;
  v_items integer;
  v_order_count integer;
begin
  v_order_id := public.place_store_order(
    '40000000-0000-0000-0000-000000000004',
    '[{"product_id":"30000000-0000-0000-0000-000000000001","quantity":1}]'::jsonb,
    'Inside address, Erbil',
    'Test Customer', '07712345678', null, 500, 0, 0.02
  );

  select customer_phone, total_iqd into v_phone, v_total
    from public.orders where id = v_order_id;
  select stock_quantity into v_stock
    from public.products where id = '30000000-0000-0000-0000-000000000001';
  select count(*) into v_items from public.order_items where order_id = v_order_id;
  select count(*) into v_order_count from public.orders;

  if v_phone <> '07712345678' then
    raise exception 'Customer phone was not persisted: %', v_phone;
  end if;
  if v_total <> 2500 then
    raise exception 'Expected total 2500 IQD, received %', v_total;
  end if;
  if v_stock <> 4 then
    raise exception 'Expected stock 4 after one successful order, received %', v_stock;
  end if;
  if v_items <> 1 then
    raise exception 'Expected one order item, received %', v_items;
  end if;
  if v_order_count <> 1 then
    raise exception 'Rejected orders must not be inserted; found % orders', v_order_count;
  end if;
end;
$$;

-- The privileged RPC must be unavailable to browser roles.
do $$
begin
  if has_function_privilege(
    'anon',
    'public.place_store_order(uuid,jsonb,text,text,text,text,bigint,double precision,double precision)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute place_store_order';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.place_store_order(uuid,jsonb,text,text,text,text,bigint,double precision,double precision)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must not execute place_store_order';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.place_store_order(uuid,jsonb,text,text,text,text,bigint,double precision,double precision)',
    'EXECUTE'
  ) then
    raise exception 'service_role must execute place_store_order';
  end if;
end;
$$;

\echo 'M18 PostgreSQL service-zone and checkout-phone integration tests passed.'
