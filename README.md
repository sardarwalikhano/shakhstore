# SHAKH STORE

Kurdish RTL marketplace and delivery platform for restaurants, supermarkets, groceries, and meat vendors.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase PostgreSQL and Auth
- Vercel deployment
- Resend transactional email
- PWA

## Development

1. Install Node.js 20.9+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill the public Supabase URL and anon/publishable key.
4. Run `npm run dev`.

## Database migrations

Migrations are append-only. Never edit a migration that has been applied to a shared or production database. Add a new timestamped migration for every schema change.

Apply and verify migrations in a non-production environment first. Take and verify a restorable backup before production changes.

## Financial invariants

- Delivery fee: 80% captain net / 20% platform commission. Example: 1,000 IQD fee -> captain receives 800 IQD; platform receives 200 IQD.
- Merchant commission: merchant-specific agreed rate; debit merchant wallet and credit platform wallet atomically.
- Cash referral reward: debit the post owner's wallet by the full reward pool; credit 75% to the referrer and 25% to the platform. Example: 10,000 IQD -> referrer 7,500 IQD; platform 2,500 IQD.
- Every financial transfer must be atomic, idempotent, ledger-backed, and auditable.
- Rewards are settled only after the referred order is delivered and eligible.
- No client may directly update wallet balances or ledger entries.

## Delivery phases

M00 foundation; M01 identity and roles; M02 shared UI; M03 merchant onboarding; M04 products and posts; M05 marketplace; M06 orders; M07 captain delivery; M08 wallets and ledger; M09 commissions and referral rewards; M10 notifications and PWA; M11 security, QA, and production readiness.

No mock, demo, or seeded business records are included.
