\set ON_ERROR_STOP on

-- Minimal PostgreSQL 17 fixture for the M17 migration. This is an isolated CI
-- database, not a Supabase project and never uses Production credentials.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key
);
create function auth.uid() returns uuid
language sql stable
as $$ select null::uuid $$;

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  transaction_type text not null,
  reference_id text,
  description text,
  created_at timestamptz not null default now()
);

create table public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('user','platform','external','payout_clearing')),
  owner_id uuid,
  currency text not null default 'IQD' check (currency = 'IQD'),
  balance_minor bigint not null default 0 check (balance_minor >= 0),
  constraint wallet_accounts_owner_shape check (
    (owner_type = 'user' and owner_id is not null)
    or (owner_type in ('platform','external','payout_clearing') and owner_id is null)
  )
);
create unique index wallet_accounts_user_owner_uq
  on public.wallet_accounts(owner_id, currency) where owner_type = 'user';
create unique index wallet_accounts_external_owner_uq
  on public.wallet_accounts(currency) where owner_type = 'external';

create table public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.wallet_transactions(id) on delete restrict,
  account_id uuid not null references public.wallet_accounts(id) on delete restrict,
  entry_type text not null check (entry_type in ('debit','credit')),
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now()
);

create table public.wallet_topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  payment_method text not null check (payment_method in ('fastpay','fib')),
  amount_iqd bigint not null check (amount_iqd > 0 and amount_iqd <= 100000000),
  receipt_path text not null,
  sender_reference text,
  user_note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint wallet_topup_review_shape check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and wallet_transaction_id is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and wallet_transaction_id is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and wallet_transaction_id is not null)
  )
);

alter table public.wallet_topup_requests enable row level security;
create policy wallet_topup_select_own on public.wallet_topup_requests
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.wallet_topup_requests from anon, authenticated;
grant select on public.wallet_topup_requests to authenticated;

insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000009');

-- A pre-M17 pending request exists before the integrity columns are added.
insert into public.wallet_topup_requests(
  id, user_id, payment_method, amount_iqd, receipt_path
) values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'fastpay', 1000, 'legacy/receipt.pdf'
);

\i supabase/migrations/20261112183000_wallet_topup_duplicate_protection.sql

-- A fresh pending request must carry both integrity values.
do $$
begin
  begin
    insert into public.wallet_topup_requests(
      user_id, payment_method, amount_iqd, receipt_path
    ) values (
      '00000000-0000-0000-0000-000000000002',
      'fastpay', 1000, 'missing-integrity/receipt.pdf'
    );
    raise exception 'Expected pending top-up without integrity data to fail';
  exception when check_violation then
    null;
  end;
end;
$$;

-- The same receipt digest cannot be submitted under another request ID.
insert into public.wallet_topup_requests(
  id, user_id, payment_method, amount_iqd, receipt_path,
  sender_reference, receipt_sha256, sender_reference_normalized
) values (
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'fastpay', 2500, 'receipts/one.pdf',
  'Ref 100', repeat('a', 64), 'REF100'
);

do $$
begin
  begin
    insert into public.wallet_topup_requests(
      user_id, payment_method, amount_iqd, receipt_path,
      sender_reference, receipt_sha256, sender_reference_normalized
    ) values (
      '00000000-0000-0000-0000-000000000003',
      'fastpay', 2500, 'receipts/duplicate-hash.pdf',
      'Ref 101', repeat('a', 64), 'REF101'
    );
    raise exception 'Expected duplicate receipt SHA-256 to fail';
  exception when unique_violation then
    null;
  end;
end;
$$;

-- A differently encoded receipt cannot reuse the same normalized provider ref.
do $$
begin
  begin
    insert into public.wallet_topup_requests(
      user_id, payment_method, amount_iqd, receipt_path,
      sender_reference, receipt_sha256, sender_reference_normalized
    ) values (
      '00000000-0000-0000-0000-000000000003',
      'fastpay', 2500, 'receipts/duplicate-reference.pdf',
      ' r e f 100 ', repeat('b', 64), 'REF100'
    );
    raise exception 'Expected duplicate provider payment reference to fail';
  exception when unique_violation then
    null;
  end;
end;
$$;

-- The same reference string on a different provider is not a provider-level
-- duplicate, provided that the actual receipt bytes are different.
insert into public.wallet_topup_requests(
  id, user_id, payment_method, amount_iqd, receipt_path,
  sender_reference, receipt_sha256, sender_reference_normalized
) values (
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003',
  'fib', 2500, 'receipts/fib.pdf',
  'Ref 100', repeat('c', 64), 'REF100'
);

-- Legacy pending rows cannot be approved after M17, but can be rejected.
do $$
begin
  begin
    perform public.review_wallet_topup(
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000009',
      'approve',
      null
    );
    raise exception 'Expected legacy top-up approval to fail';
  exception when raise_exception then
    if sqlerrm not like '%lacks receipt integrity data%' then
      raise;
    end if;
  end;
end;
$$;

select public.review_wallet_topup(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000009',
  'reject',
  'Legacy request requires a new receipt and reference'
);

-- A valid receipt/reference request is credited exactly once.
select public.review_wallet_topup(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000009',
  'approve',
  'Verified in CI fixture'
);

do $$
declare
  v_balance bigint;
  v_entry_count integer;
  v_tx_count integer;
  v_status text;
begin
  select balance_minor into v_balance
  from public.wallet_accounts
  where owner_type = 'user'
    and owner_id = '00000000-0000-0000-0000-000000000002'
    and currency = 'IQD';

  select count(*) into v_entry_count
  from public.wallet_entries e
  join public.wallet_transactions t on t.id = e.transaction_id
  where t.idempotency_key = 'topup:10000000-0000-0000-0000-000000000002';

  select count(*) into v_tx_count
  from public.wallet_transactions
  where idempotency_key = 'topup:10000000-0000-0000-0000-000000000002';

  select status into v_status
  from public.wallet_topup_requests
  where id = '10000000-0000-0000-0000-000000000002';

  if v_balance <> 2500 then
    raise exception 'Expected approved top-up wallet balance 2500, received %', v_balance;
  end if;
  if v_entry_count <> 2 or v_tx_count <> 1 then
    raise exception 'Expected one double-entry top-up transaction, got % entries and % headers', v_entry_count, v_tx_count;
  end if;
  if v_status <> 'approved' then
    raise exception 'Expected approved status, got %', v_status;
  end if;
end;
$$;

-- A valid but already reviewed request cannot be approved a second time.
do $$
begin
  begin
    perform public.review_wallet_topup(
      '10000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000009',
      'approve',
      null
    );
    raise exception 'Expected second top-up review to fail';
  exception when raise_exception then
    if sqlerrm <> 'Request already reviewed' then
      raise;
    end if;
  end;
end;
$$;

-- Verify the privileged review RPC is not executable by public clients.
do $$
begin
  if has_function_privilege('anon', 'public.review_wallet_topup(uuid,uuid,text,text)', 'EXECUTE') then
    raise exception 'anon must not execute review_wallet_topup';
  end if;
  if has_function_privilege('authenticated', 'public.review_wallet_topup(uuid,uuid,text,text)', 'EXECUTE') then
    raise exception 'authenticated must not execute review_wallet_topup';
  end if;
  if not has_function_privilege('service_role', 'public.review_wallet_topup(uuid,uuid,text,text)', 'EXECUTE') then
    raise exception 'service_role must execute review_wallet_topup';
  end if;
end;
$$;

\echo 'M17 PostgreSQL integration tests passed.'
