-- SHAKH STORE / M15: Correct external cash-asset accounting for cashouts.
-- Additive correction: preserve historical ledger rows and existing migrations.
-- External clearing is an asset account: debit increases it, credit decreases it.
begin;

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
  v_external_balance bigint;
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

  select id, balance_minor into v_external_account_id, v_external_balance
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
  if v_external_account_id is null
     or v_external_balance < v_request.cash_amount_iqd then
    raise exception 'Insufficient recorded FastPay/FIB cash balance for payout';
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

  -- Cash leaves the external FastPay/FIB asset account: a credit reduces assets.
  update public.wallet_accounts
  set balance_minor = balance_minor - v_request.cash_amount_iqd
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

revoke all on function public.review_wallet_cashout(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_wallet_cashout(uuid, uuid, text, text)
  to service_role;

comment on function public.review_wallet_cashout(uuid, uuid, text, text) is
  'Service-role-only cashout review. Debits user wallet, credits platform fee, and credits/reduces the external FastPay/FIB cash asset by the 75% payout.';

commit;
