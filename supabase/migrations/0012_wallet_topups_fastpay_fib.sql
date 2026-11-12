-- SHAKH STORE / M12: Manual wallet top-up via FastPay / FIB.
-- Additive migration. Existing wallet and cashout migrations remain unchanged.
begin;

create table if not exists public.wallet_topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  payment_method text not null check (payment_method in ('fastpay', 'fib')),
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

create index if not exists wallet_topup_user_created_idx
  on public.wallet_topup_requests(user_id, created_at desc);
create index if not exists wallet_topup_pending_created_idx
  on public.wallet_topup_requests(created_at) where status = 'pending';

alter table public.wallet_topup_requests enable row level security;
drop policy if exists wallet_topup_select_own on public.wallet_topup_requests;
create policy wallet_topup_select_own on public.wallet_topup_requests
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.wallet_topup_requests from anon, authenticated;
grant select on public.wallet_topup_requests to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('wallet-topup-receipts', 'wallet-topup-receipts', false, 5242880,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.review_wallet_topup(
  p_request_id uuid,
  p_admin_user_id uuid,
  p_decision text,
  p_admin_note text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.wallet_topup_requests%rowtype;
  v_account_id uuid;
  v_external_account_id uuid;
  v_transaction_id uuid;
begin
  if p_admin_user_id is null then raise exception 'Admin identity required'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Invalid decision'; end if;

  select * into v_request from public.wallet_topup_requests
    where id = p_request_id for update;
  if not found then raise exception 'Top-up request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'Request already reviewed'; end if;

  if p_decision = 'reject' then
    update public.wallet_topup_requests
      set status='rejected', admin_note=nullif(trim(p_admin_note),''),
          reviewed_by=p_admin_user_id, reviewed_at=now()
      where id=p_request_id;
    return null;
  end if;

  insert into public.wallet_accounts(owner_type, owner_id)
    values ('user', v_request.user_id)
    on conflict (owner_id, currency) where owner_type='user' do nothing;

  insert into public.wallet_accounts(owner_type, owner_id)
    values ('external', null)
    on conflict (currency) where owner_type='external' do nothing;

  select id into v_account_id from public.wallet_accounts
    where owner_type='user' and owner_id=v_request.user_id and currency='IQD'
    for update;

  select id into v_external_account_id from public.wallet_accounts
    where owner_type='external' and currency='IQD'
    for update;

  insert into public.wallet_transactions(idempotency_key, transaction_type, reference_id, description)
    values ('topup:' || p_request_id::text, 'wallet_topup', p_request_id::text,
      'Wallet top-up via ' || upper(v_request.payment_method))
    returning id into v_transaction_id;

  -- External clearing is debited and the customer wallet is credited.
  -- This is a balanced double-entry transfer; external-account balance semantics
  -- must be reconciled with the legacy cashout routine before production rollout.
  update public.wallet_accounts set balance_minor=balance_minor + v_request.amount_iqd
    where id=v_external_account_id;

  update public.wallet_accounts set balance_minor=balance_minor + v_request.amount_iqd
    where id=v_account_id;

  insert into public.wallet_entries(transaction_id, account_id, entry_type, amount_minor)
    values
      (v_transaction_id, v_external_account_id, 'debit', v_request.amount_iqd),
      (v_transaction_id, v_account_id, 'credit', v_request.amount_iqd);

  update public.wallet_topup_requests
    set status='approved', admin_note=nullif(trim(p_admin_note),''),
        reviewed_by=p_admin_user_id, reviewed_at=now(),
        wallet_transaction_id=v_transaction_id
    where id=p_request_id;

  return v_transaction_id;
end;
$$;

revoke all on function public.review_wallet_topup(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_wallet_topup(uuid, uuid, text, text) to service_role;

comment on table public.wallet_topup_requests is
  'Manual IQD wallet top-ups. Funds are credited only after Super Admin receipt review.';
commit;
