# SHAKH STORE Wallet Top-up and Cashout Setup

This feature requires the matching application deployment and database migrations. Do not enable it in production until the live schema has been reconciled with the repository migration history and the accounting checks below have passed.

## 1. Vercel environment variables

Set these for the intended Vercel environment:

- `NEXT_PUBLIC_SUPABASE_URL`: the project URL from Supabase Project Settings → API.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the publishable/anon key from Supabase Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY`: the service-role secret from Supabase Project Settings → API.

Important:
- `SUPABASE_SERVICE_ROLE_KEY` must remain server-only. Never prefix it with `NEXT_PUBLIC_`.
- Do not commit real keys to Git.
- Redeploy after adding or changing environment variables.

## 2. Database migration and production safety

The feature branch contains these additive migrations:

1. `0012_wallet_topups_fastpay_fib.sql` — private receipt-backed top-up requests and Super Admin review.
2. `0013_captain_commission_80_20.sql` — captain delivery-fee share default: 80% captain / 20% platform.
3. `0014_cashout_payout_destination_and_completion.sql` — FastPay/FIB destination and explicit paid status.
4. `0015_cashout_external_asset_accounting.sql` — intermediate accounting correction; superseded for the manual-payout workflow by M16.
5. `0016_manual_cashout_settlement.sql` — separates approval from physical payout and posts the internal 75/25 settlement only after Super Admin confirms the manual transfer.

These migrations depend on the existing wallet, cashout, storage, and commission schema. Do not apply them in isolation or assume the production migration history is complete. The production project has previously shown existing application tables while its migration history endpoint returned no applied migrations. Reconcile the live schema, functions, constraints, storage policies, and migration history before applying anything.

Before a production change:
- Take and verify a restorable database backup.
- Compare the exact live schema with all prerequisite migrations.
- Treat every IQD wallet/account balance as an internal bookkeeping unit only; it is not evidence of money held in FastPay/FIB or a bank account.
- Review historical top-up and cashout ledger entries against actual FastPay/FIB receipts and statements. M16 does not rewrite historical transactions. Legacy approved cashouts with an existing ledger transaction are marked paid without posting a second settlement.
- Test on a separate staging project with realistic top-up, cashout, rejection, and retry scenarios.
- Prepare a tested rollback/recovery plan.

Do not edit historical migrations. All corrections in this feature are additive.

### Migration runner compatibility gate

The repository currently uses four-digit migration prefixes (`0001`–`0016`) rather than the timestamped `<timestamp>_<name>.sql` format documented for the Supabase CLI. It also contains two files with the same `0004` prefix (`0004_in_app_notifications.sql` and `0004_store_profiles_and_onboarding.sql`). The repository does not currently include `supabase/config.toml`, and the GitHub CI workflow runs application lint/typecheck/build but does not run Supabase migration commands.

This means a green application CI and a READY Vercel Preview do **not** prove the SQL migration chain can be applied through the Supabase CLI. Before any migration rollout:

- Establish a migration baseline from the exact live production schema; do not infer it from the empty migration-history list.
- Define a one-time migration-history conversion plan with unique, ordered timestamp identifiers while preserving every SQL change and dependency. Do not rename or reorder files ad hoc.
- Run the complete migration chain on a separate staging project and verify `supabase migration list` plus schema/function/constraint diffs before considering production.
- Use an explicitly selected staging target for CLI commands. Current Supabase CLI v3 defaults database commands to the local stack; hosted changes require explicit remote targeting and confirmation.

References: [Supabase migration file format and history](https://supabase.com/docs/reference/cli/supabase-migration-list), [Supabase CLI v3 migration guide](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3).

## 3. Super Admin authorization

The APIs check the trusted `auth.users.raw_app_meta_data` claim `role = super_admin`. They deliberately do not trust `user_metadata`, because users can generally edit their own user metadata.

Grant the role only after identifying and verifying the intended Auth user UUID. Do not grant this role to ordinary users. The administrator should sign out and sign in again after the claim changes so the refreshed session contains the updated app metadata.

## 4. Wallet top-ups

- FastPay receiving number: `07736999576`
- FIB receiving number: `07504796924`
- 1 IQD approved payment = 1 IQD wallet credit.
- A user submits an amount and a private receipt.
- No wallet credit occurs until Super Admin verifies the actual received payment and approves the request.
- Receipts must remain in the private `wallet-topup-receipts` Storage bucket; do not make this bucket public.

## 5. Cashout workflow

- A pending request reserves the full requested amount against the user's available wallet balance.
- The split is 75% to the requester and 25% to SHAKH.
- The requester supplies their own FastPay/FIB payout destination.
- Super Admin reviews and approves or rejects the request.
- Approval changes the request to `approved` only. It does not debit the user's wallet, create a ledger transaction, or send money.
- Pending requests and approved requests that do not yet have a ledger settlement reserve the full requested amount from the user's available wallet balance. Legacy approved requests that already have a ledger transaction are not reserved again. M16 makes both generic server-side wallet transfers and referral-reward settlements subtract these reservations before allowing another debit. Those debit RPCs use deterministic account lock order and re-check the idempotency key after acquiring locks so concurrent retries return the first committed transaction.
- Super Admin manually sends the 75% payout to the user's supplied FastPay/FIB number outside SHAKH.
- Only after confirming the external transfer does Super Admin select `mark paid`. M16 then atomically debits the user's wallet, credits the 25% platform share, and records the 75% payout in an internal payout-clearing account.
- The payout-clearing account is strictly an internal accounting counterpart. Its balance is not a bank balance, cash-on-hand figure, or proof that a transfer occurred.
- A rejected request releases the reservation and does not debit the wallet.
- No bank API, automatic transfer, or external payment execution is performed by SHAKH.

## 6. Captain delivery commission

The approved delivery-fee split is 80% captain / 20% platform. The 80% default applies to new accruals; historical commission rows retain their stored rate.

## 7. Production verification checklist

Before enabling these features, verify:

- [ ] Correct production project and schema are identified.
- [ ] Database backup has been restored successfully in a recovery test.
- [ ] Migration history is reconciled with the actual live schema.
- [ ] All new migrations have passed staging tests in order.
- [ ] All internal IQD balances are clearly labelled as bookkeeping balances, never as bank balances.
- [ ] Manual payout is physically confirmed outside SHAKH before the admin marks a cashout paid.
- [ ] M16 prevents approval from debiting the wallet and settles exactly once at mark-paid.
- [ ] `npm run check:wallet-migration` passes as part of CI before build.
- [ ] Approved-but-unpaid requests remain reserved and cannot be requested a second time.
- [ ] Generic wallet transfers and referral-reward settlements cannot spend funds reserved by a pending or unsettled approved cashout.
- [ ] Private receipt bucket and access policies are verified.
- [ ] Intended administrator has trusted `app_metadata.role = super_admin`.
- [ ] Ordinary authenticated user receives HTTP 403 from admin APIs.
- [ ] Signed-out request receives HTTP 401.
- [ ] Top-up receipt review credits exactly once; reject credits nothing.
- [ ] Cashout rejection releases the reservation without debiting the wallet.
- [ ] Cashout approval leaves user/platform/payout-clearing balances and ledger entries unchanged.
- [ ] Mark-paid is available only after approval and a verified external manual payout; it posts the 75/25 settlement exactly once.
- [ ] Legacy approved requests with an existing ledger transaction are marked paid without duplicate ledger posting.
- [ ] Physical FastPay/FIB transfer is confirmed before marking paid.
- [ ] Captain commission accrual uses 80/20 for new eligible deliveries.
