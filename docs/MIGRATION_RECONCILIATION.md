# SHAKH STORE — Supabase Migration Reconciliation Plan

**Status: BLOCKED — do not run `supabase db push`, `supabase migration repair`, or apply any migration to Production.**

This document records the migration compatibility problem and the controlled path to resolve it. It is deliberately a plan, not an instruction to mutate the live database.

## Current repository inventory

The `supabase/migrations` directory currently contains 18 SQL files:

- 17 legacy files use four-digit version prefixes (`0001` through `0016`).
- Version `0004` is duplicated by both `0004_in_app_notifications.sql` and `0004_store_profiles_and_onboarding.sql`.
- M17 is currently the only CLI-style timestamped migration: `20261112183000_wallet_topup_duplicate_protection.sql`.
- `supabase/config.toml` is absent from the repository at the time of this review.

Supabase CLI migration files use the form `<timestamp>_<name>.sql`. Migration history is recorded separately in `supabase_migrations.schema_migrations`, and CLI comparison is based on migration timestamps. See the [Supabase CLI migration reference](https://supabase.com/docs/reference/cli/supabase-migration-new) and [database migration guide](https://supabase.com/docs/guides/deployment/database-migrations).

## Current Production evidence

The Production project is a live database, not an empty installation.

- Supabase migration-history listing returned no rows even though the application schema and wallet tables already exist.
- The Production schema includes the legacy wallet, cashout, orders, stores and commission tables.
- `wallet_topup_requests` and the private `wallet-topup-receipts` bucket were absent at the last read-only inspection.
- Production cashout rows/columns did not yet include the M14 payout-destination and paid-completion fields.
- Existing captain commission configuration retained the prior 20% platform setting.
- These facts mean the SQL files must not simply be replayed against Production, and the local filename problem cannot be fixed by renaming old files alone.

The facts above are a point-in-time read-only snapshot. Re-query the project before planning any future schema operation.

## Non-destructive inventory command

Run:

```bash
npm run audit:supabase-migrations
```

The command only reads filenames. It prints duplicate versions and legacy filenames and exits successfully in informational mode so regular application CI can still validate application code. To use it as a release gate:

```bash
node scripts/audit-supabase-migrations.mjs --strict
```

Strict mode exits nonzero while the current migration directory remains unreconciled. It does not connect to Supabase, inspect secrets, execute SQL, rename files, or write migration history.

## Required reconciliation sequence

1. **Freeze the historical files.** Do not rename, delete, reorder, or edit `0001`–`0016` merely to make the CLI accept them. Preserve the existing branch history.
2. **Capture the exact Production schema.** Take a verified backup and a separate schema-only snapshot covering tables, columns, constraints, indexes, policies, functions, triggers, extensions, grants and Storage metadata. Do not include customer secrets or unnecessary personal data in artifacts.
3. **Compare the snapshot with source SQL.** Build an object-by-object matrix showing whether each historical migration's effect already exists in Production, is partially present, or is absent. Resolve the duplicate `0004` order by inspecting dependencies; do not infer the order from filenames.
4. **Create a baseline for a separate staging database.** The baseline must describe the actual starting schema, not replay a guessed sequence over existing production objects. Keep it distinct from the historical files and document exactly which production snapshot it represents.
5. **Generate new timestamped migrations using the installed Supabase CLI.** For any future schema change, use `supabase migration new <descriptive_name>` and inspect the CLI-generated filename. Do not hand-invent timestamps.
6. **Port only verified outstanding deltas.** If M12–M16 effects are not already in the baseline, create reviewed timestamped migrations in dependency order. Do not duplicate a schema change that is already present in the baseline. Keep M17 after the M12 top-up table migration.
7. **Replay and validate on isolated staging.** Test the complete baseline and migration sequence from an empty staging database, then exercise Auth, RLS, Storage, wallet concurrency, double-entry ledger reconciliation, duplicate top-ups, manual cashouts and legacy-row handling.
8. **Reconcile migration history only after schema equivalence is proven.** A history-repair operation changes bookkeeping, not schema. It must not be used to disguise an unknown or partial Production schema. Review the exact timestamps and proposed repair set before any such operation.
9. **Verify restore and release gates.** Restore the Production backup into a recovery environment, verify historical financial totals and wallet ledgers, compare schema diffs, and require explicit release authorization before a Production change.

## Release blockers

- [ ] Verified restorable backup and recovery test
- [ ] Full schema-only Production snapshot
- [ ] Historical migration-to-schema matrix, including the two `0004` files
- [ ] A unique timestamped migration sequence
- [ ] Isolated staging database and successful clean replay
- [ ] Auth, RLS, Storage and API integration tests on staging
- [ ] Top-up duplicate/concurrency and cashout reservation/settlement tests
- [ ] Historical wallet/commission reconciliation
- [ ] Production advisor review after staging changes
- [ ] Explicit authorization for a Production migration window

**Safety invariant:** until every blocker above is closed, keep PR #1 Draft, do not merge, do not deploy a schema-dependent wallet feature to Production, and do not execute Production DDL or migration-history repair.
