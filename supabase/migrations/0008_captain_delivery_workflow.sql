-- SHAKH STORE / M06: captain assignment and delivery lifecycle.
-- Additive migration; do not modify earlier migration files.
begin;

alter table public.orders
  add column if not exists captain_id uuid references auth.users(id) on delete restrict,
  add column if not exists assigned_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','confirmed','preparing','ready','assigned','out_for_delivery','delivered','cancelled'));

create index if not exists orders_captain_status_created_idx
  on public.orders(captain_id,status,created_at desc)
  where captain_id is not null;

drop policy if exists orders_captain_read on public.orders;
create policy orders_captain_read on public.orders
for select to authenticated using (captain_id = (select auth.uid()));

drop policy if exists order_items_captain_read on public.order_items;
create policy order_items_captain_read on public.order_items
for select to authenticated using (
  exists (select 1 from public.orders o
    where o.id = order_items.order_id and o.captain_id = (select auth.uid()))
);

comment on column public.orders.captain_id is 'Assigned delivery captain; assignment is performed by trusted admin API.';
comment on column public.orders.assigned_at is 'Timestamp when a captain was assigned to the order.';
commit;
