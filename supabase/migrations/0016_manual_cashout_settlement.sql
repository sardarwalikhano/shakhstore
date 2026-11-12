-- SHAKH STORE / M16: Separate cashout approval from manual payout settlement.
-- IQD balances are internal platform ledger units, not bank balances.
-- Super Admin must send FastPay/FIB funds outside the platform before mark-paid.
-- This migration is additive; historical migrations and posted transactions remain untouched.

begin;

-- Add a dedicated internal clearing account for manually completed payouts.
-- This account is an accounting counterpart only; it is NOT a bank balance.
alter table public.wallet_accounts
  drop constraint if exists wallet_accounts_owner_type_check;
alter table public.wallet_accounts
  add constraint wallet_accounts_owner_type_check
  check (owner_type in ('user', 'platform', 'external', 'payout_clearing'));

alter table public.wallet_accounts
  drop constraint if exists wallet_owner_shape;
alter table public.wallet_accounts
  add constraint wallet_owner_shape check (
    (owner_type = 'user' and owner_id is not null) or
    (owner_type in ('platform', 'external', 'payout_clearing') and owner_id is null)
  );

create unique index if not exists wallet_accounts_payout_clearing_uq
  on public.wallet_accounts(currency)
  where owner_type = 'payout_clearing';

-- Approved-but-unpaid requests continue reserving their full amount.
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
  v_reserved bigint;
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

  select id, balance_minor into v_account_id, v_balance
  from public.wallet_accounts
  where owner_type = 'user' and owner_id = v_user_id and currency = 'IQD'
  for update;

  if v_account_id is null then
    raise exception 'Reward wallet not found';
  end if;

  select coalesce(sum(requested_amount_iqd), 0)
    into v_reserved
  from public.wallet_cashout_requests
  where user_id = v_user_id and status in ('pending', 'approved');

  if p_amount_iqd > v_balance - v_reserved then
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

-- Approval changes workflow state only. No wallet or ledger balances change here.
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
begin
  if p_admin_user_id is null then
    raise exception 'Super Admin identity is required';
  end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then
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

  update public.wallet_cashout_requests
  set status = 'approved',
      admin_note = nullif(trim(p_admin_note), ''),
      reviewed_by = p_admin_user_id,
      reviewed_at = now(),
      wallet_transaction_id = null,
      paid_at = null,
      paid_by = null
  where id = p_request_id;

  return null;
end;
$$;

-- Call only after Super Admin has physically sent the payout outside SHAKH.
-- This is the sole point that debits the user's wallet and posts the 75/25 split.
create or replace function public.mark_wallet_cashout_paid(
  p_request_id uuid,
  p_admin_user_id uuid
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
  v_clearing_account_id uuid;
  v_transaction_id uuid;
  v_existing_id uuid;
begin
  if p_admin_user_id is null then
    raise exception 'Super Admin identity is required';
  end if;

  select * into v_request
  from public.wallet_cashout_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Cashout request not found';
  end if;
  if v_request.status <> 'approved' then
    raise exception 'Only an approved cashout can be marked paid';
  end if;
  if v_request.payout_method not in ('fastpay', 'fib')
     or nullif(trim(v_request.payout_phone), '') is null then
    raise exception 'A verified manual payout destination is required';
  end if;

  select id into v_existing_id
  from public.wallet_transactions
  where idempotency_key = 'cashout:' || p_request_id::text;

  if v_existing_id is not null then
    raise exception 'Cashout settlement already exists';
  end if;

  insert into public.wallet_accounts(owner_type, owner_id)
  values ('user', v_request.user_id)
  on conflict (owner_id, currency) where owner_type = 'user' do nothing;

  insert into public.wallet_accounts(owner_type, owner_id)
  values ('platform', null)
  on conflict (currency) where owner_type = 'platform' do nothing;

  insert into public.wallet_accounts(owner_type, owner_id)
  values ('payout_clearing', null)
  on conflict (currency) where owner_type = 'payout_clearing' do nothing;

  select id into v_user_account_id
  from public.wallet_accounts
  where owner_type = 'user' and owner_id = v_request.user_id and currency = 'IQD'
  for update;

  select id into v_platform_account_id
  from public.wallet_accounts
  where owner_type = 'platform' and currency = 'IQD'
  for update;

  select id into v_clearing_account_id
  from public.wallet_accounts
  where owner_type = 'payout_clearing' and currency = 'IQD'
  for update;

  if v_user_account_id is null or v_platform_account_id is null
     or v_clearing_account_id is null then
    raise exception 'Required internal ledger account is missing';
  end if;

  if (select balance_minor from public.wallet_accounts where id = v_user_account_id)
     < v_request.requested_amount_iqd then
    raise exception 'Insufficient wallet balance for payout settlement';
  end if;

  insert into public.wallet_transactions(
    idempotency_key, transaction_type, reference_id, description
  ) values (
    'cashout:' || p_request_id::text,
    'reward_cashout',
    p_request_id::text,
    'Manual cashout settlement: 75% external payout / 25% SHAKH platform'
  )
  on conflict (idempotency_key) do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    raise exception 'Cashout settlement already exists';
  end if;

  update public.wallet_accounts
  set balance_minor = balance_minor - v_request.requested_amount_iqd
  where id = v_user_account_id;

  update public.wallet_accounts
  set balance_minor = balance_minor + v_request.platform_fee_iqd
  where id = v_platform_account_id;

  -- Internal clearing entry only. Never interpret this balance as bank funds.
  update public.wallet_accounts
  set balance_minor = balance_minor + v_request.cash_amount_iqd
  where id = v_clearing_account_id;

  insert into public.wallet_entries(transaction_id, account_id, entry_type, amount_minor)
  values
    (v_transaction_id, v_user_account_id, 'debit', v_request.requested_amount_iqd),
    (v_transaction_id, v_platform_account_id, 'credit', v_request.platform_fee_iqd),
    (v_transaction_id, v_clearing_account_id, 'credit', v_request.cash_amount_iqd);

  update public.wallet_cashout_requests
  set status = 'paid',
      reviewed_by = coalesce(reviewed_by, p_admin_user_id),
      reviewed_at = coalesce(reviewed_at, now()),
      wallet_transaction_id = v_transaction_id,
      paid_at = now(),
      paid_by = p_admin_user_id
  where id = p_request_id;

  return v_transaction_id;
end;
$$;

-- Approved is a reservation, not a financial settlement.
alter table public.wallet_cashout_requests
  drop constraint if exists cashout_review_shape;
alter table public.wallet_cashout_requests
  add constraint cashout_review_shape check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null
      and wallet_transaction_id is null and paid_at is null and paid_by is null)
    or
    (status = 'approved' and reviewed_by is not null and reviewed_at is not null
      and wallet_transaction_id is null and paid_at is null and paid_by is null)
    or
    (status = 'paid' and reviewed_by is not null and reviewed_at is not null
      and wallet_transaction_id is not null and paid_at is not null and paid_by is not null)
    or
    (status = 'rejected' and reviewed_by is not null and reviewed_at is not null
      and wallet_transaction_id is null and paid_at is null and paid_by is null)
  );

revoke all on function public.request_wallet_cashout(bigint, text)
  from public, anon;
grant execute on function public.request_wallet_cashout(bigint, text)
  to authenticated;

revoke all on function public.review_wallet_cashout(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_wallet_cashout(uuid, uuid, text, text)
  to service_role;

revoke all on function public.mark_wallet_cashout_paid(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.mark_wallet_cashout_paid(uuid, uuid)
  to service_role;

comment on table public.wallet_accounts is
  'Internal IQD ledger accounts only. Account balances are platform bookkeeping units, not bank balances.';
comment on function public.review_wallet_cashout(uuid, uuid, text, text) is
  'Service-role-only workflow review. Approval reserves the request; it does not debit a wallet or send money.';
comment on function public.mark_wallet_cashout_paid(uuid, uuid) is
  'Service-role-only manual payout completion. Call only after Super Admin sends funds outside the platform; posts the internal 75/25 ledger settlement exactly once.';
comment on column public.wallet_cashout_requests.wallet_transaction_id is
  'Internal ledger settlement id; remains null until the manual external payout is confirmed and marked paid.';

commit;
