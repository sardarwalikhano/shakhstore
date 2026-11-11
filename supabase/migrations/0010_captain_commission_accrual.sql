-- SHAKH STORE / M08: configurable captain delivery commission accrual.
-- Additive migration; run after 0009_store_delivery_fees_server_controlled.sql.
-- Accrued commissions are NOT wallet credits and are not marked as paid.
-- Wallet settlement will require a separate, audited admin action.

begin;

create table if not exists public.captain_commission_settings (
  id smallint primary key default 1 check (id = 1),
  commission_rate_bps integer not null default 2000
    check (commission_rate_bps between 0 and 10000),
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

insert into public.captain_commission_settings(id, commission_rate_bps)
values (1, 2000)
on conflict (id) do nothing;

alter table public.captain_commission_settings enable row level security;
revoke all on public.captain_commission_settings from anon, authenticated;

create table if not exists public.captain_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  captain_id uuid not null references auth.users(id) on delete restrict,
  delivery_fee_iqd bigint not null check (delivery_fee_iqd >= 0),
  commission_rate_bps integer not null
    check (commission_rate_bps between 0 and 10000),
  commission_iqd bigint not null check (commission_iqd >= 0),
  platform_share_iqd bigint not null check (platform_share_iqd >= 0),
  status text not null default 'accrued'
    check (status in ('accrued', 'paid', 'voided')),
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete restrict,
  completed_at timestamptz not null default now(),
  settled_at timestamptz,
  settled_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint captain_commission_split_balances
    check (delivery_fee_iqd = commission_iqd + platform_share_iqd),
  constraint captain_commission_settlement_shape check (
    (status = 'accrued' and wallet_transaction_id is null and settled_at is null and settled_by is null)
    or
    (status = 'paid' and wallet_transaction_id is not null and settled_at is not null and settled_by is not null)
    or
    (status = 'voided' and settled_at is not null and settled_by is not null)
  )
);

create index if not exists captain_commissions_captain_completed_idx
  on public.captain_commissions(captain_id, completed_at desc);
create index if not exists captain_commissions_status_completed_idx
  on public.captain_commissions(status, completed_at desc);

alter table public.captain_commissions enable row level security;
drop policy if exists captain_commissions_select_own on public.captain_commissions;
create policy captain_commissions_select_own
on public.captain_commissions for select to authenticated
using (captain_id = (select auth.uid()));
revoke all on public.captain_commissions from anon, authenticated;
grant select on public.captain_commissions to authenticated;

create or replace function public.accrue_captain_delivery_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate_bps integer;
  v_delivery_fee bigint;
  v_commission bigint;
begin
  if new.status = 'delivered'
     and old.status is distinct from new.status
     and new.captain_id is not null then

    select commission_rate_bps
      into v_rate_bps
      from public.captain_commission_settings
      where id = 1;

    if v_rate_bps is null then
      raise exception 'Captain commission settings are missing';
    end if;

    v_delivery_fee := greatest(coalesce(new.delivery_fee_iqd, 0), 0);
    v_commission := floor((v_delivery_fee::numeric * v_rate_bps) / 10000)::bigint;

    insert into public.captain_commissions(
      order_id, captain_id, delivery_fee_iqd, commission_rate_bps,
      commission_iqd, platform_share_iqd, completed_at
    ) values (
      new.id, new.captain_id, v_delivery_fee, v_rate_bps,
      v_commission, v_delivery_fee - v_commission, now()
    )
    on conflict (order_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_accrue_captain_commission on public.orders;
create trigger orders_accrue_captain_commission
after update of status on public.orders
for each row execute function public.accrue_captain_delivery_commission();

revoke all on function public.accrue_captain_delivery_commission()
  from public, anon, authenticated;

comment on table public.captain_commission_settings is
  'Single active captain commission rate in basis points; default 2000 = 20%.';
comment on table public.captain_commissions is
  'Immutable per-order captain commission accruals. Accrued is payable but is not a wallet credit.';
comment on function public.accrue_captain_delivery_commission() is
  'When an assigned captain marks an order delivered, snapshots the configured commission and platform share once.';

commit;
