-- SHAKH STORE / M07: database-controlled per-store delivery fees.
-- Additive migration; run after 0008_captain_delivery_workflow.sql.
-- Checkout ignores any delivery fee supplied by the browser. The fee is read
-- from the approved store and snapshotted onto the order by this trigger.

begin;

alter table public.stores
  add column if not exists delivery_fee_iqd bigint not null default 0;

alter table public.stores
  drop constraint if exists stores_delivery_fee_iqd_check;

alter table public.stores
  add constraint stores_delivery_fee_iqd_check
  check (delivery_fee_iqd >= 0 and delivery_fee_iqd <= 100000000);

create or replace function public.apply_store_delivery_fee()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_delivery_fee bigint;
begin
  select s.delivery_fee_iqd
    into v_delivery_fee
    from public.stores s
    where s.id = new.store_id
      and s.status = 'approved';

  if not found then
    raise exception 'Store is unavailable';
  end if;

  new.delivery_fee_iqd := v_delivery_fee;
  new.total_iqd := new.subtotal_iqd + v_delivery_fee;
  return new;
end;
$$;

drop trigger if exists orders_apply_store_delivery_fee on public.orders;
create trigger orders_apply_store_delivery_fee
before insert on public.orders
for each row execute function public.apply_store_delivery_fee();

comment on column public.stores.delivery_fee_iqd is
  'Delivery fee in IQD, configured by an administrator and applied by the database at checkout.';
comment on function public.apply_store_delivery_fee() is
  'Overrides client/API supplied delivery fees with the approved store fee before an order is inserted.';

commit;
