-- SHAKH STORE / M17: database-enforced duplicate top-up protection.
-- Uses a Supabase CLI-compatible timestamped filename. Historical migrations
-- remain untouched; legacy pending requests without integrity fields cannot
-- be approved and must be rejected/re-submitted.
begin;

alter table public.wallet_topup_requests
  add column if not exists receipt_sha256 text,
  add column if not exists sender_reference_normalized text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.wallet_topup_requests'::regclass
      and conname = 'wallet_topup_integrity_shape'
  ) then
    alter table public.wallet_topup_requests
      add constraint wallet_topup_integrity_shape
      check (
        (receipt_sha256 is null or receipt_sha256 ~ '^[0-9a-f]{64}$')
        and (
          sender_reference_normalized is null
          or (
            sender_reference is not null
            and sender_reference_normalized =
              upper(regexp_replace(btrim(sender_reference), '[[:space:]]+', '', 'g'))
          )
        )
        and (
          status <> 'pending'
          or (
            receipt_sha256 is not null
            and sender_reference_normalized is not null
          )
        )
      ) not valid;
  end if;
end;
$$;

-- These partial unique indexes are the concurrency-safe control. Application
-- checks alone are insufficient because parallel requests can race.
create unique index if not exists wallet_topup_receipt_sha256_uidx
  on public.wallet_topup_requests(receipt_sha256)
  where receipt_sha256 is not null;

create unique index if not exists wallet_topup_payment_reference_uidx
  on public.wallet_topup_requests(payment_method, sender_reference_normalized)
  where sender_reference_normalized is not null;

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
  if p_decision is null or p_decision not in ('approve','reject') then
    raise exception 'Invalid decision';
  end if;

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

  if v_request.receipt_sha256 is null
     or v_request.sender_reference_normalized is null then
    raise exception 'Top-up request lacks receipt integrity data; reject and ask the user to submit a new request';
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

  -- External receipt clearing is an internal bookkeeping account, not a
  -- representation or verification of a live FastPay/FIB bank balance.
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

revoke all on function public.review_wallet_topup(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_wallet_topup(uuid, uuid, text, text)
  to service_role;

comment on column public.wallet_topup_requests.receipt_sha256 is
  'SHA-256 digest of the uploaded receipt bytes; unique across all top-up requests.';
comment on column public.wallet_topup_requests.sender_reference_normalized is
  'Uppercase payment reference with whitespace removed; unique per payment provider.';
comment on function public.review_wallet_topup(uuid, uuid, text, text) is
  'Service-role-only top-up review. Approval requires receipt hash and unique normalized external payment reference.';

commit;
