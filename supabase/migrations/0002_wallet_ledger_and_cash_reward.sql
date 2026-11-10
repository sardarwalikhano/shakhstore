-- SHAKH STORE / M01-M08 financial foundation
-- Append-only migration. Integer IQD amounts; no seeded/demo records.
-- All wallet mutations are server-side, atomic and idempotent.

begin;

create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('user', 'platform')),
  owner_id uuid null references auth.users(id) on delete restrict,
  currency text not null default 'IQD' check (currency = 'IQD'),
  balance_minor bigint not null default 0 check (balance_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_owner_shape check (
    (owner_type = 'user' and owner_id is not null) or
    (owner_type = 'platform' and owner_id is null)
  )
);

create unique index if not exists wallet_accounts_user_owner_uq
  on public.wallet_accounts(owner_id, currency)
  where owner_type = 'user';

create unique index if not exists wallet_accounts_platform_owner_uq
  on public.wallet_accounts(currency)
  where owner_type = 'platform';

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  transaction_type text not null,
  reference_id text,
  description text not null,
  currency text not null default 'IQD' check (currency = 'IQD'),
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.wallet_transactions(id) on delete restrict,
  account_id uuid not null references public.wallet_accounts(id) on delete restrict,
  entry_type text not null check (entry_type in ('debit', 'credit')),
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now()
);

create index if not exists wallet_entries_transaction_idx
  on public.wallet_entries(transaction_id);

create index if not exists wallet_entries_account_created_idx
  on public.wallet_entries(account_id, created_at desc);

drop trigger if exists wallet_accounts_set_updated_at on public.wallet_accounts;
create trigger wallet_accounts_set_updated_at
before update on public.wallet_accounts
for each row execute function public.set_updated_at();

alter table public.wallet_accounts enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_entries enable row level security;

-- Authenticated users can inspect only their own wallet account.
drop policy if exists wallet_accounts_select_own on public.wallet_accounts;
create policy wallet_accounts_select_own
on public.wallet_accounts for select to authenticated
using (owner_type = 'user' and owner_id = (select auth.uid()));

-- Users can inspect ledger rows belonging to their own wallet, never mutate them.
drop policy if exists wallet_entries_select_own on public.wallet_entries;
create policy wallet_entries_select_own
on public.wallet_entries for select to authenticated
using (
  exists (
    select 1 from public.wallet_accounts a
    where a.id = wallet_entries.account_id
      and a.owner_type = 'user'
      and a.owner_id = (select auth.uid())
  )
);

drop policy if exists wallet_transactions_select_own on public.wallet_transactions;
create policy wallet_transactions_select_own
on public.wallet_transactions for select to authenticated
using (
  exists (
    select 1
    from public.wallet_entries e
    join public.wallet_accounts a on a.id = e.account_id
    where e.transaction_id = wallet_transactions.id
      and a.owner_type = 'user'
      and a.owner_id = (select auth.uid())
  )
);

revoke all on public.wallet_accounts from anon, authenticated;
revoke all on public.wallet_transactions from anon, authenticated;
revoke all on public.wallet_entries from anon, authenticated;
grant select on public.wallet_accounts to authenticated;
grant select on public.wallet_transactions to authenticated;
grant select on public.wallet_entries to authenticated;

-- A controlled wallet credit/debit operation. Only service_role may execute.
create or replace function public.post_wallet_transfer(
  p_from_user uuid,
  p_to_user uuid,
  p_amount_iqd bigint,
  p_idempotency_key text,
  p_transaction_type text,
  p_reference_id text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from_id uuid;
  v_to_id uuid;
  v_transaction_id uuid;
  v_existing_id uuid;
begin
  if p_from_user is null or p_to_user is null or p_from_user = p_to_user then
    raise exception 'Invalid wallet owners';
  end if;
  if p_amount_iqd <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'A valid idempotency key is required';
  end if;

  select id into v_existing_id
  from public.wallet_transactions
  where idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into public.wallet_accounts(owner_type, owner_id)
  values ('user', p_from_user)
  on conflict (owner_id, currency) where owner_type = 'user' do nothing;

  insert into public.wallet_accounts(owner_type, owner_id)
  values ('user', p_to_user)
  on conflict (owner_id, currency) where owner_type = 'user' do nothing;

  select id into v_from_id
  from public.wallet_accounts
  where owner_type = 'user' and owner_id = p_from_user and currency = 'IQD'
  for update;

  select id into v_to_id
  from public.wallet_accounts
  where owner_type = 'user' and owner_id = p_to_user and currency = 'IQD'
  for update;

  if (select balance_minor from public.wallet_accounts where id = v_from_id) < p_amount_iqd then
    raise exception 'Insufficient wallet balance';
  end if;

  insert into public.wallet_transactions(
    idempotency_key, transaction_type, reference_id, description
  ) values (
    p_idempotency_key, p_transaction_type, p_reference_id, p_description
  )
  returning id into v_transaction_id;

  update public.wallet_accounts
  set balance_minor = balance_minor - p_amount_iqd
  where id = v_from_id;

  update public.wallet_accounts
  set balance_minor = balance_minor + p_amount_iqd
  where id = v_to_id;

  insert into public.wallet_entries(transaction_id, account_id, entry_type, amount_minor)
  values
    (v_transaction_id, v_from_id, 'debit', p_amount_iqd),
    (v_transaction_id, v_to_id, 'credit', p_amount_iqd);

  return v_transaction_id;
end;
$$;

-- Cash reward split: debit the post owner's wallet by 100%, credit referrer 75%,
-- and platform 25%. Integer remainder is assigned to the platform account.
create or replace function public.settle_cash_referral_reward(
  p_post_owner_user_id uuid,
  p_referrer_user_id uuid,
  p_total_iqd bigint,
  p_idempotency_key text,
  p_reference_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_account_id uuid;
  v_referrer_account_id uuid;
  v_platform_account_id uuid;
  v_transaction_id uuid;
  v_referrer_share bigint;
  v_platform_share bigint;
  v_existing_id uuid;
begin
  if p_post_owner_user_id is null or p_referrer_user_id is null
     or p_post_owner_user_id = p_referrer_user_id then
    raise exception 'Invalid reward participants';
  end if;
  if p_total_iqd <= 0 then
    raise exception 'Reward amount must be positive';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'A valid idempotency key is required';
  end if;

  select id into v_existing_id
  from public.wallet_transactions
  where idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  v_referrer_share := floor(p_total_iqd * 0.75)::bigint;
  v_platform_share := p_total_iqd - v_referrer_share;

  insert into public.wallet_accounts(owner_type, owner_id)
  values ('user', p_post_owner_user_id)
  on conflict (owner_id, currency) where owner_type = 'user' do nothing;

  insert into public.wallet_accounts(owner_type, owner_id)
  values ('user', p_referrer_user_id)
  on conflict (owner_id, currency) where owner_type = 'user' do nothing;

  insert into public.wallet_accounts(owner_type, owner_id)
  values ('platform', null)
  on conflict (currency) where owner_type = 'platform' do nothing;

  select id into v_owner_account_id
  from public.wallet_accounts
  where owner_type = 'user' and owner_id = p_post_owner_user_id and currency = 'IQD'
  for update;

  select id into v_referrer_account_id
  from public.wallet_accounts
  where owner_type = 'user' and owner_id = p_referrer_user_id and currency = 'IQD'
  for update;

  select id into v_platform_account_id
  from public.wallet_accounts
  where owner_type = 'platform' and currency = 'IQD'
  for update;

  if (select balance_minor from public.wallet_accounts where id = v_owner_account_id) < p_total_iqd then
    raise exception 'Insufficient post-owner wallet balance';
  end if;

  insert into public.wallet_transactions(
    idempotency_key, transaction_type, reference_id, description
  ) values (
    p_idempotency_key,
    'cash_referral_reward',
    p_reference_id,
    'Cash reward split: 75% referrer / 25% platform'
  )
  returning id into v_transaction_id;

  update public.wallet_accounts
  set balance_minor = balance_minor - p_total_iqd
  where id = v_owner_account_id;

  update public.wallet_accounts
  set balance_minor = balance_minor + v_referrer_share
  where id = v_referrer_account_id;

  update public.wallet_accounts
  set balance_minor = balance_minor + v_platform_share
  where id = v_platform_account_id;

  insert into public.wallet_entries(transaction_id, account_id, entry_type, amount_minor)
  values
    (v_transaction_id, v_owner_account_id, 'debit', p_total_iqd),
    (v_transaction_id, v_referrer_account_id, 'credit', v_referrer_share),
    (v_transaction_id, v_platform_account_id, 'credit', v_platform_share);

  return v_transaction_id;
end;
$$;

revoke all on function public.post_wallet_transfer(uuid, uuid, bigint, text, text, text, text) from public, anon, authenticated;
revoke all on function public.settle_cash_referral_reward(uuid, uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.post_wallet_transfer(uuid, uuid, bigint, text, text, text, text) to service_role;
grant execute on function public.settle_cash_referral_reward(uuid, uuid, bigint, text, text) to service_role;

comment on table public.wallet_accounts is
  'IQD wallet balances. Mutations are restricted to audited server-side functions.';
comment on table public.wallet_transactions is
  'Idempotent financial transaction headers.';
comment on table public.wallet_entries is
  'Immutable debit/credit ledger entries for wallet transactions.';
comment on function public.settle_cash_referral_reward(uuid, uuid, bigint, text, text) is
  'Debits 100% from the post owner, credits 75% to referrer and 25% to platform.';

commit;
