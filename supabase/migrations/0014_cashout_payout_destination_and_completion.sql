-- SHAKH STORE / M14: Cashout payout destination and explicit payout completion.
-- Additive migration. Existing financial split remains 75% requester / 25% platform.
begin;

alter table public.wallet_cashout_requests
  add column if not exists payout_method text,
  add column if not exists payout_phone text,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid references auth.users(id) on delete restrict;

alter table public.wallet_cashout_requests
  drop constraint if exists wallet_cashout_requests_status_check;
alter table public.wallet_cashout_requests
  add constraint wallet_cashout_requests_status_check
  check (status in ('pending', 'approved', 'paid', 'rejected'));

alter table public.wallet_cashout_requests
  drop constraint if exists cashout_review_shape;
alter table public.wallet_cashout_requests
  add constraint cashout_review_shape check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null
      and wallet_transaction_id is null and paid_at is null and paid_by is null)
    or
    (status = 'approved' and reviewed_by is not null and reviewed_at is not null
      and wallet_transaction_id is not null and paid_at is null and paid_by is null)
    or
    (status = 'paid' and reviewed_by is not null and reviewed_at is not null
      and wallet_transaction_id is not null and paid_at is not null and paid_by is not null)
    or
    (status = 'rejected' and reviewed_by is not null and reviewed_at is not null
      and paid_at is null and paid_by is null)
  );

alter table public.wallet_cashout_requests
  add constraint cashout_payout_destination_shape check (
    (payout_method is null and payout_phone is null)
    or
    (payout_method in ('fastpay', 'fib') and payout_phone is not null
      and length(trim(payout_phone)) between 7 and 24)
  );

-- Preserve the existing request calculation and pending-wallet reservation,
-- but require a verified payout destination for all new requests.
create or replace function public.request_wallet_cashout_with_destination(
  p_amount_iqd bigint,
  p_payout_method text,
  p_payout_phone text,
  p_user_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_phone text := nullif(trim(p_payout_phone), '');
begin
  if p_payout_method not in ('fastpay', 'fib') then
    raise exception 'Payout method must be FastPay or FIB';
  end if;
  if v_phone is null or length(v_phone) < 7 or length(v_phone) > 24
     or v_phone !~ '^[0-9+() -]+$' then
    raise exception 'A valid FastPay/FIB payout phone number is required';
  end if;

  v_request_id := public.request_wallet_cashout(p_amount_iqd, p_user_note);

  update public.wallet_cashout_requests
  set payout_method = p_payout_method,
      payout_phone = v_phone
  where id = v_request_id and user_id = auth.uid();

  if not found then
    raise exception 'Unable to attach payout destination';
  end if;
  return v_request_id;
end;
$$;

revoke all on function public.request_wallet_cashout(bigint, text)
  from public, anon, authenticated;
revoke all on function public.request_wallet_cashout_with_destination(bigint, text, text, text)
  from public, anon;
grant execute on function public.request_wallet_cashout_with_destination(bigint, text, text, text)
  to authenticated;

create or replace function public.mark_wallet_cashout_paid(
  p_request_id uuid,
  p_admin_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_admin_user_id is null then
    raise exception 'Super Admin identity is required';
  end if;
  update public.wallet_cashout_requests
  set status = 'paid', paid_at = now(), paid_by = p_admin_user_id
  where id = p_request_id and status = 'approved';
  if not found then
    raise exception 'Only an approved cashout can be marked paid';
  end if;
end;
$$;

revoke all on function public.mark_wallet_cashout_paid(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.mark_wallet_cashout_paid(uuid, uuid)
  to service_role;

comment on column public.wallet_cashout_requests.payout_method is
  'Requester-selected payout channel: FastPay or FIB.';
comment on column public.wallet_cashout_requests.payout_phone is
  'Requester-owned FastPay/FIB destination number; private payout data.';
comment on function public.mark_wallet_cashout_paid(uuid, uuid) is
  'Super Admin records physical payout completion after sending the approved cashout amount.';
commit;
