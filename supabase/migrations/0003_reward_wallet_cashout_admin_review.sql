-- SHAKH STORE / M09: Reward-wallet cashout with Super Admin review.
-- Additive correction: cashout is debited from the reward owner's wallet,
-- never from the post owner's wallet. Existing migrations remain untouched.

begin;

-- The old routine modelled the cashout against the post owner's wallet.
-- Remove it so the application cannot accidentally call the wrong financial flow.
drop function if exists public.settle_cash_referral_reward(uuid, uuid, bigint, text, text);

-- Keep one platform account and add one external payout account for balanced ledger entries.
alter table public.wallet_accounts
  drop constraint if exists wallet_owner_shape;

alter table public.wallet_accounts
  add constraint wallet_owner_shape check (
    (owner_type = 'user' and owner_id is not null) or
    (owner_type in ('platform', 'external') and owner_id is null)
  );

create unique index if not exists wallet_accounts_external_owner_uq
  on public.wallet_accounts(currency)
  where owner_type = 'external';

create table if not exists public.wallet_cashout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  requested_amount_iqd bigint not null check (requested_amount_iqd > 0),
  cash_amount_iqd bigint not null check (cash_amount_iqd > 0),
  platform_fee_iqd bigint not null check (platform_fee_iqd >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  user_note text,
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cashout_split_balances check (
    requested_amount_iqd = cash_amount_iqd + platform_fee_iqd
  ),
  constraint cashout_review_shape check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null
      and wallet_transaction_id is null)
    or
    (status in ('approved', 'rejected') and reviewed_by is not null
      and reviewed_at is not null)
  ),
  constraint cashout_approved_has_transaction check (
    status <> 'approved' or wallet_transaction_id is not null
  )
);

create index if not exists wallet_cashout_user_created_idx
  on public.wallet_cashout_requests(user_id, created_at desc);

create index if not exists wallet_cashout_pending_created_idx
  on public.wallet_cashout_requests(created_at)
  where status = 'pending';

drop trigger if exists wallet_cashout_requests_set_updated_at
  on public.wallet_cashout_requests;
create trigger wallet_cashout_requests_set_updated_at
before update on public.wallet_cashout_requests
for each row execute function public.set_updated_at();

alter table public.wallet_cashout_requests enable row level security;

drop policy if exists wallet_cashout_select_own on public.wallet_cashout_requests;
create policy wallet_cashout_select_own
on public.wallet_cashout_requests
for select to authenticated
using (user_id = (select auth.uid()));

revoke all on public.wallet_cashout_requests from anon, authenticated;
grant select on public.wallet_cashout_requests to authenticated;

-- Customer requests cashout. Pending requests reserve the requested amount
-- logically, preventing the same reward balance being requested more than once.
create or replace function public.request_wallet_cashout(
  p_amount_iqd bigint,
  p_user_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
  v_balance bigint;
  v_pending bigint;
  v_cash bigint;
  v_fee bigint;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_amount_iqd is null or p_amount_iqd < 4 then
    raise exception 'Cashout amount must be at least 4 IQD';
  end if;

  select id, balance_minor
    into v_account_id, v_balance
  from public.wallet_accounts
  where owner_type = 'user' and owner_id = v_user_id and currency = 'IQD'
  for update;

  if v_account_id is null then
    raise exception 'Reward wallet not found';
  end if;

  select coalesce(sum(requested_amount_iqd), 0)
    into v_pending
  from public.wallet_cashout_requests
  where user_id = v_user_id and status = 'pending';

  if p_amount_iqd > v_balance - v_pending then
    raise exception 'Insufficient available reward balance';
  end if;

  v_cash := floor(p_amount_iqd * 0.75)::bigint;
  v_fee := p_amount_iqd - v_cash;

  insert into public.wallet_cashout_requests(
    user_id, requested_amount_iqd, cash_amount_iqd, platform_fee_iqd, user_note
  ) values (
    v_user_id, p_amount_iqd, v_cash, v_fee, nullif(trim(p_user_note), '')
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- Super Admin backend (service_role only) approves or rejects a request.
-- Approval atomically debits the reward owner's wallet and records 75% cash
-- payout plus 25% SHAKH fee in a balanced, immutable ledger transaction.
create or replace function public.review_wallet_cashout(
  p_request_id uuid,
  p_admin_user_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.wallet_cashout_requests%rowtype;
  v_user_account_id uuid;
  v_platform_account_id uuid;
  v_external_account_id uuid;
  v_transaction_id uuid;
  v_existing_id uuid;
begin
  if p_admin_user_id is null then
    raise exception 'Super Admin identity is required';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject';
  end if;

  select * into v_request
  from public.wallet_cashout_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Cashout request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Cashout request has already been reviewed';
  end if;

  if p_decision = 'reject' then
    update public.wallet_cashout_requests
    set status = 'rejected',
        admin_note = nullif(trim(p_admin_note), ''),
        reviewed_by = p_admin_user_id,
        reviewed_at = now()
    where id = p_request_id;
    return null;
  end if;

  insert into public.wallet_accounts(owner_type, owner_id)
  values ('platform', null)
  on conflict (currency) where owner_type = 'platform' do nothing;

  insert into public.wallet_accounts(owner_type, owner_id)
  values ('external', null)
  on conflict (currency) where owner_type = 'external' do nothing;

  select id into v_user_account_id
  from public.wallet_accounts
  where owner_type = 'user' and owner_id = v_request.user_id and currency = 'IQD'
  for update;

  select id into v_platform_account_id
  from public.wallet_accounts
  where owner_type = 'platform' and currency = 'IQD'
  for update;

  select id into v_external_account_id
  from public.wallet_accounts
  where owner_type = 'external' and currency = 'IQD'
  for update;

  if v_user_account_id is null then
    raise exception 'Reward wallet not found';
  end if;

  if (select balance_minor from public.wallet_accounts where id = v_user_account_id)
     < v_request.requested_amount_iqd then
    raise exception 'Insufficient reward wallet balance at approval time';
  end if;

  insert into public.wallet_transactions(
    idempotency_key, transaction_type, reference_id, description
  ) values (
    'cashout:' || p_request_id::text,
    'reward_cashout',
    p_request_id::text,
    'Reward cashout: 75% customer payout / 25% SHAKH fee'
  )
  on conflict (idempotency_key) do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    select id into v_existing_id
    from public.wallet_transactions
    where idempotency_key = 'cashout:' || p_request_id::text;
    raise exception 'Cashout transaction already exists: %', v_existing_id;
  end if;

  update public.wallet_accounts
  set balance_minor = balance_minor - v_request.requested_amount_iqd
  where id = v_user_account_id;

  update public.wallet_accounts
  set balance_minor = balance_minor + v_request.platform_fee_iqd
  where id = v_platform_account_id;

  update public.wallet_accounts
  set balance_minor = balance_minor + v_request.cash_amount_iqd
  where id = v_external_account_id;

  insert into public.wallet_entries(transaction_id, account_id, entry_type, amount_minor)
  values
    (v_transaction_id, v_user_account_id, 'debit', v_request.requested_amount_iqd),
    (v_transaction_id, v_platform_account_id, 'credit', v_request.platform_fee_iqd),
    (v_transaction_id, v_external_account_id, 'credit', v_request.cash_amount_iqd);

  update public.wallet_cashout_requests
  set status = 'approved',
      admin_note = nullif(trim(p_admin_note), ''),
      reviewed_by = p_admin_user_id,
      reviewed_at = now(),
      wallet_transaction_id = v_transaction_id
  where id = p_request_id;

  return v_transaction_id;
end;
$$;

revoke all on function public.request_wallet_cashout(bigint, text)
  from public, anon;
grant execute on function public.request_wallet_cashout(bigint, text)
  to authenticated;

revoke all on function public.review_wallet_cashout(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_wallet_cashout(uuid, uuid, text, text)
  to service_role;

comment on table public.wallet_cashout_requests is
  'Customer cashout requests. Approval debits the requesting reward wallet, pays 75% and allocates 25% to SHAKH.';
comment on function public.request_wallet_cashout(bigint, text) is
  'Authenticated customer submits a cashout request; pending amount is reserved against available balance.';
comment on function public.review_wallet_cashout(uuid, uuid, text, text) is
  'Service-role-only Super Admin review; approve/reject, with atomic 75/25 ledger settlement.';

commit;
