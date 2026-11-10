# SHAKH STORE Cashout Management Setup

This feature is deployed in the Next.js application, but it will not operate until the production environment and Supabase migration are configured.

## 1. Vercel environment variables

Set these for the **Production** environment in the Vercel project:

- `NEXT_PUBLIC_SUPABASE_URL`: the project URL from Supabase Project Settings → API.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the publishable/anon key from Supabase Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY`: the service-role secret from Supabase Project Settings → API.

Important:
- `SUPABASE_SERVICE_ROLE_KEY` must remain server-only. Never prefix it with `NEXT_PUBLIC_`.
- Do not commit real keys to Git.
- Redeploy after adding or changing environment variables.

## 2. Apply database migrations

Apply the migrations in order to the intended Supabase project:

1. `supabase/migrations/0001_project_foundation.sql`
2. `supabase/migrations/0002_wallet_ledger_and_cash_reward.sql`
3. `supabase/migrations/0003_reward_wallet_cashout_admin_review.sql`

Do not apply migration 0003 alone if migrations 0001 and 0002 have not already been applied. Review the target project and take a database backup before applying migrations to production.

## 3. Grant the Super Admin role

The API checks the trusted `auth.users.raw_app_meta_data` claim `role = super_admin`. It deliberately does not trust `user_metadata`, because users can generally edit their own user metadata.

In Supabase SQL Editor, first identify the exact Auth user UUID for the intended administrator. Then run this statement with that verified UUID:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'super_admin')
where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
```

Verify the result by querying only the selected user's id and raw_app_meta_data. Do not grant this role to ordinary users. The administrator should sign out and sign in again after the claim is changed so the refreshed session contains the updated app metadata.

## 4. Cashout API

- `GET /api/admin/cashouts`: returns the latest 100 requests, newest first.
- `POST /api/admin/cashouts`: accepts `requestId`, `decision` (`approve` or `reject`), and an optional note.
- Dashboard: `/dashboard/admin/cashouts`.

Every request is authenticated on the server and checked against `app_metadata.role`. The service-role client is created only inside the route handler and must never be sent to the browser.

## 5. Financial behavior

A pending request reserves its full requested amount against the user's available wallet balance. Rejection releases that reservation. Approval debits the full requested amount and records the 75% payout and 25% SHAKH fee in the ledger atomically. Actual transfer of the 75% cash amount to the user's bank, cash agent, or other payment channel remains an operational payout step and must be reconciled separately.

## 6. Production verification checklist

Before enabling customer cashouts, verify:

- [ ] Production Supabase URL and anon key are configured.
- [ ] Server-only service-role key is configured and non-empty.
- [ ] All migrations are applied to the correct Supabase project.
- [ ] The intended administrator has the trusted `app_metadata.role = super_admin` claim.
- [ ] An ordinary authenticated user receives HTTP 403 from the admin API.
- [ ] A signed-out request receives HTTP 401.
- [ ] A pending cashout can be approved exactly once.
- [ ] A rejected cashout releases the reservation without debiting the wallet.
- [ ] Ledger entries balance for approval (debit = 75% credit + 25% credit).
- [ ] The real-world 75% payout is completed and reconciled outside the ledger approval step.
