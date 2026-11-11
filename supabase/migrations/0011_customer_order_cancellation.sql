-- SHAKH STORE / M05: atomic customer cancellation and stock restoration.
-- Additive migration. Apply after 0010_captain_commission_accrual.sql.
-- Customers may cancel only pending orders; inventory restoration and the
-- status transition execute in one transaction under a row lock.

begin;

create or replace function public.cancel_customer_order(
  p_order_id uuid,
  p_customer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_item_count integer := 0;
begin
  if p_order_id is null or p_customer_id is null then
    raise exception 'Invalid cancellation request';
  end if;

  -- Serialize cancellation against merchant confirmation and other writes.
  select *
    into v_order
    from public.orders
    where id = p_order_id
    for update;

  if not found or v_order.customer_id is distinct from p_customer_id then
    raise exception 'Order not found';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Only pending orders can be cancelled';
  end if;

  -- Restore the aggregate quantity for each product. Any missing product or
  -- integer overflow aborts the entire transaction, including the order update.
  for v_item in
    select oi.product_id, sum(oi.quantity)::bigint as quantity
      from public.order_items oi
      where oi.order_id = p_order_id
      group by oi.product_id
      order by oi.product_id
  loop
    if v_item.quantity <= 0 or v_item.quantity > 2147483647 then
      raise exception 'Invalid inventory restoration quantity';
    end if;

    update public.products
      set stock_quantity = stock_quantity + v_item.quantity::integer
      where id = v_item.product_id
        and stock_quantity <= 2147483647 - v_item.quantity::integer;

    if not found then
      raise exception 'Unable to restore product inventory';
    end if;

    v_item_count := v_item_count + 1;
  end loop;

  if v_item_count = 0 then
    raise exception 'Order has no restorable items';
  end if;

  update public.orders
    set status = 'cancelled'
    where id = p_order_id
      and customer_id = p_customer_id
      and status = 'pending';

  if not found then
    raise exception 'Order changed while cancellation was in progress';
  end if;

  return v_order.id;
end;
$$;

revoke all on function public.cancel_customer_order(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_customer_order(uuid,uuid)
  to service_role;

comment on function public.cancel_customer_order(uuid,uuid) is
  'Atomically cancels a customer-owned pending order and restores its product quantities exactly once.';

commit;
