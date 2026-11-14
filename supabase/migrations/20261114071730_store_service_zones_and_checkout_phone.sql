-- M18: store delivery service zones and required checkout contact/location validation.
-- Additive schema change. Apply only after Production schema/history reconciliation
-- and a successful isolated staging replay.

begin;

alter table public.stores
  add column if not exists service_center_lat double precision,
  add column if not exists service_center_lng double precision,
  add column if not exists service_radius_km numeric(7,2);

alter table public.stores
  drop constraint if exists stores_service_zone_complete_check;

alter table public.stores
  add constraint stores_service_zone_complete_check
  check (
    (
      service_center_lat is null
      and service_center_lng is null
      and service_radius_km is null
    )
    or
    (
      service_center_lat between -90 and 90
      and service_center_lng between -180 and 180
      and service_radius_km > 0
      and service_radius_km <= 100
    )
  );

comment on column public.stores.service_center_lat is
  'Latitude of the merchant delivery-zone centre, configured by a trusted admin.';
comment on column public.stores.service_center_lng is
  'Longitude of the merchant delivery-zone centre, configured by a trusted admin.';
comment on column public.stores.service_radius_km is
  'Circular delivery service radius in kilometres (0, 100], configured by a trusted admin.';

-- Replace the old service-role-only RPC with a version that requires a contact
-- phone and destination coordinates. Existing orders remain unchanged.
drop function if exists public.place_store_order(uuid,jsonb,text,text,text,text,bigint);

create function public.place_store_order(
  p_customer_id uuid,
  p_items jsonb,
  p_delivery_address text,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_note text default null,
  p_delivery_fee_iqd bigint default 0,
  p_delivery_latitude double precision default null,
  p_delivery_longitude double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_store public.stores%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_subtotal bigint := 0;
  v_total bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_count integer := 0;
  v_haversine double precision;
  v_distance_km double precision;
begin
  if p_customer_id is null then
    raise exception 'Customer is required';
  end if;

  if p_customer_phone is null
     or char_length(trim(p_customer_phone)) not between 7 and 24
     or trim(p_customer_phone) !~ '^[0-9+() -]+$'
     or char_length(regexp_replace(trim(p_customer_phone), '[^0-9]', '', 'g')) not between 7 and 15 then
    raise exception 'Customer phone is required or invalid';
  end if;

  if p_delivery_latitude is null or p_delivery_longitude is null
     or p_delivery_latitude not between -90 and 90
     or p_delivery_longitude not between -180 and 180 then
    raise exception 'Delivery location is required or invalid';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Order must contain between 1 and 50 items';
  end if;

  if p_delivery_address is null or char_length(trim(p_delivery_address)) not between 5 and 1000 then
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
    if v_qty < 1 or v_qty > 10000 then
      raise exception 'Invalid quantity';
    end if;

    select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid and is_active = true
      for update;

    if not found then
      raise exception 'Product is unavailable';
    end if;

    if v_store_id is null then
      v_store_id := v_product.store_id;
    elsif v_store_id is distinct from v_product.store_id then
      raise exception 'An order can contain products from one store only';
    end if;

    if v_product.store_id is null then
      raise exception 'Platform products are not orderable yet';
    end if;

    if v_product.stock_quantity < v_qty then
      raise exception 'Insufficient stock for %', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_product.price_iqd * v_qty);
    v_count := v_count + 1;
  end loop;

  if v_count <> jsonb_array_length(p_items) then
    raise exception 'Invalid order items';
  end if;

  -- A SHARE lock prevents the configured service zone changing between
  -- validation and insertion of this order.
  select * into v_store
    from public.stores
    where id = v_store_id and status = 'approved'
    for share;

  if not found then
    raise exception 'Store is unavailable';
  end if;

  if v_store.service_center_lat is null
     or v_store.service_center_lng is null
     or v_store.service_radius_km is null then
    raise exception 'Store delivery zone is not configured';
  end if;

  v_haversine :=
      power(sin(radians(p_delivery_latitude - v_store.service_center_lat) / 2), 2)
    + cos(radians(v_store.service_center_lat))
      * cos(radians(p_delivery_latitude))
      * power(sin(radians(p_delivery_longitude - v_store.service_center_lng) / 2), 2);

  v_distance_km := 6371.0088 * 2
    * asin(sqrt(least(1::double precision, greatest(0::double precision, v_haversine))));

  if v_distance_km > v_store.service_radius_km::double precision then
    raise exception 'Delivery location is outside service zone';
  end if;

  if v_subtotal <= 0 or v_subtotal > 9000000000000 then
    raise exception 'Order total is invalid';
  end if;

  v_total := v_subtotal + p_delivery_fee_iqd;
  v_order_number := 'SHK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  insert into public.orders(
    order_number, customer_id, store_id, subtotal_iqd, delivery_fee_iqd, total_iqd,
    customer_name, customer_phone, delivery_address, customer_note
  ) values (
    v_order_number, p_customer_id, v_store_id, v_subtotal, p_delivery_fee_iqd, v_total,
    nullif(trim(p_customer_name),''), trim(p_customer_phone),
    trim(p_delivery_address), nullif(trim(p_customer_note),'')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
      for update;

    v_qty := (v_item->>'quantity')::integer;
    update public.products
      set stock_quantity = stock_quantity - v_qty
      where id = v_product.id;

    insert into public.order_items(order_id, product_id, product_name, unit_price_iqd, quantity)
      values (v_order_id, v_product.id, v_product.name, v_product.price_iqd, v_qty);
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.place_store_order(
  uuid,jsonb,text,text,text,text,bigint,double precision,double precision
) from public, anon, authenticated;

grant execute on function public.place_store_order(
  uuid,jsonb,text,text,text,text,bigint,double precision,double precision
) to service_role;

comment on function public.place_store_order(
  uuid,jsonb,text,text,text,text,bigint,double precision,double precision
) is
  'Atomically validates a single-store cart, required customer phone, delivery service radius, IQD prices and product stock.';

commit;
