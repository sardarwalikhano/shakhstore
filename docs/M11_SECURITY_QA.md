# SHAKH STORE — M11 Security & QA

## Implemented hardening

- Disable the framework identification header (`X-Powered-By`).
- Add HSTS, MIME-sniffing protection, frame denial, strict-origin referrer policy, DNS prefetch control, and a restrictive Permissions Policy.
- Preserve camera and geolocation permissions for the same origin; disable microphone access at the browser policy layer.
- Apply `Cache-Control: private, no-store, max-age=0` to API responses so authenticated and role-dependent payloads are not stored by shared caches.
- Add a `src/middleware.ts` guard for all API mutations (`POST`, `PUT`, `PATCH`, `DELETE`). It rejects cross-site Fetch Metadata and validates `Origin` or `Referer` against the request origin. When browser metadata is absent, mutations fail closed unless Fetch Metadata explicitly says `same-origin`. Safe methods (`GET`, `HEAD`, `OPTIONS`) are unaffected.
- Public health responses no longer reveal whether the privileged Supabase service-role key is configured.
- Merchant product updates re-apply owner and store filters in the database UPDATE predicate rather than relying only on a preceding authorization read.
- Merchant order-status updates re-apply the set of owned store IDs in the UPDATE predicate and continue to enforce the expected previous order status.
- Customer cancellation is implemented through additive migration `0011_customer_order_cancellation.sql` and `POST /api/orders/cancel`. The database function locks the owned order row, permits cancellation only while `pending`, restores the aggregated product quantities, and changes status to `cancelled` in the same transaction. A failed inventory restoration rolls back the entire cancellation. The customer orders page exposes the action only for pending orders.
- Existing server-side role checks, row-level security, service-role isolation, wallet RPCs, and append-only migrations remain unchanged.

## Dependency security review

- `react` and `react-dom` are pinned to `19.1.10`, the patched 19.1 release for React Server Components advisory GHSA-xqc2-xf4c-x3h3.
- Next.js remains pinned to `15.5.29`; avoid a major Next.js upgrade without a separate compatibility test.
- The PostCSS advisory chain is addressed by an explicit `postcss: 8.5.23` override. The affected PostCSS advisories list 8.5.23 as patched.
- The minimatch globparts amplification advisory is addressed by pinning `minimatch: 11.0.1` only beneath `@typescript-eslint/typescript-estree`; the rest of the dependency graph is not globally overridden.
- The latest verified GitHub Actions audit reported **0 vulnerabilities** (0 low, 0 moderate, 0 high, 0 critical). It used the declared package overrides and did not run a forced major update.
- Do not use `npm audit fix --force`; major framework upgrades require explicit compatibility testing.

## Build-time verification

- Commit `480203d55f05707800e2d429eb6ecfc4bad99e7d` passed GitHub Actions run `43083174727`: zero npm audit findings, ESLint, TypeScript, and Next.js production build with 22/22 static pages.
- Vercel deployment `dpl_ETgQM4PdsMtYmaVwrvGyayuLvNLi` reached `READY` for production commit `480203d55f05707800e2d429eb6ecfc4bad99e7d`. The deployment aliases include `daim-post.online` and `www.daim-post.online`.
- Customer cancellation in migration `0011` requires the new migration to be applied to the intended Supabase project before the new UI action can succeed. It is not considered deployed at the database layer until verified there.

## Automated CI

The repository includes `.github/workflows/ci.yml`. On pushes to `main` and pull requests targeting `main`, GitHub Actions installs dependencies, reports the npm audit severity summary, runs ESLint, runs TypeScript, and creates a production build using placeholder-only Supabase environment values. No production secrets are placed in the workflow.

## Required production QA

- Verify HTTPS redirects and HSTS on the canonical domain and all production subdomains.
- Confirm API responses include `Cache-Control: private, no-store, max-age=0`.
- Confirm `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and the configured referrer/permissions policies.
- From a different site, attempt API `POST`, `PATCH`, and `DELETE` requests; expect 403. Verify same-origin app mutations still succeed.
- As a merchant, attempt to update a product belonging to another store; expect 403 or 409 and no database change.
- As a merchant, attempt to advance an order for a store not owned by the account; expect 403 and no database change.
- As a customer, verify order/notification APIs return only the authenticated user's own records.
- As a customer, cancel a pending order and verify the order becomes `cancelled` and every product's stock is restored exactly once. Attempt cancellation again and expect 409 with no additional stock restoration.
- Race customer cancellation against merchant confirmation; exactly one transition must win, and stock must be restored only when cancellation wins.
- Verify cancellation is rejected for confirmed, preparing, ready, assigned, out-for-delivery, and delivered orders.
- As an unauthenticated user, verify private APIs return 401; as a non-admin, verify admin APIs return 403.
- Confirm wallet balances and ledger entries cannot be changed through direct client requests.
- Exercise checkout, merchant order transitions, captain delivery, cashout review, and notification insertion in a staging Supabase project.
- Confirm migrations are present in the intended Supabase project before enabling dependent features.

## Known gaps

- Migration `0011_customer_order_cancellation.sql` has been added to source control; its application state in the intended Supabase project is not verified.
- Referral reward settlement still has no verified current API event producer; notification integration must wait for a reviewed, idempotent reward-settlement workflow.
- Browser push subscription registration and VAPID delivery are not implemented.
- Supabase migration application status and live end-to-end business tests are not verifiable from source control or Vercel build logs alone.
- A Content Security Policy is intentionally not enabled yet. It needs an asset, Supabase, OAuth, and inline-script inventory first to avoid breaking sign-in or media loading.
