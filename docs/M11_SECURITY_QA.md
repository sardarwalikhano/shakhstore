# SHAKH STORE — M11 Security & QA

## Implemented hardening

- Disable the framework identification header (`X-Powered-By`).
- Add HSTS, MIME-sniffing protection, frame denial, strict-origin referrer policy, DNS prefetch control, and a restrictive Permissions Policy.
- Preserve camera and geolocation permissions for the same origin; disable microphone access at the browser policy layer.
- Apply `Cache-Control: private, no-store, max-age=0` to API responses so authenticated and role-dependent payloads are not stored by shared caches.
- Public health responses no longer reveal whether the privileged Supabase service-role key is configured.
- Merchant product updates re-apply owner and store filters in the database UPDATE predicate rather than relying only on a preceding authorization read.
- Merchant order-status updates re-apply the set of owned store IDs in the UPDATE predicate and continue to enforce the expected previous order status.
- Existing server-side role checks, row-level security, service-role isolation, wallet RPCs, and append-only migrations remain unchanged.

## Dependency security review

- `react` and `react-dom` are pinned to `19.1.10`, the patched 19.1 release for React Server Components advisory GHSA-xqc2-xf4c-x3h3.
- Next.js remains pinned to `15.5.29`; avoid a major Next.js upgrade without a separate compatibility test.
- The PostCSS advisory chain is addressed by an explicit `postcss: 8.5.23` override. The affected PostCSS advisories list 8.5.23 as patched.
- The minimatch globparts amplification advisory is addressed by pinning `minimatch: 11.0.1` only beneath `@typescript-eslint/typescript-estree`; the rest of the dependency graph is not globally overridden.
- The latest GitHub Actions audit on commit `9d9ab18086152ee7657585fe401baf408d80450c` reported **0 vulnerabilities** (0 low, 0 moderate, 0 high, 0 critical). It used the declared package overrides and did not run a forced major update.
- Do not use `npm audit fix --force`; major framework upgrades require explicit compatibility testing.

## Build-time verification

- GitHub Actions run `43074976824` completed successfully for commit `9d9ab18086152ee7657585fe401baf408d80450c`.
- ESLint completed without the previous `@next/next/no-img-element` warnings after product and marketplace images were migrated to `next/image`.
- TypeScript completed successfully.
- Next.js production build compiled successfully and generated all 22 static pages.
- Vercel's latest confirmed READY production deployment remains commit `72856104ab5ea80e7958fd91009ff3bae31922f0`. Vercel reports `build-rate-limit` for newer commits, so the latest dependency overrides and image component changes are CI-verified but not yet confirmed live on the Vercel production deployment.


## Automated CI

The repository now includes `.github/workflows/ci.yml`. On pushes to `main` and pull requests targeting `main`, GitHub Actions installs dependencies, reports the npm audit severity summary, runs ESLint, runs TypeScript, and creates a production build using placeholder-only Supabase environment values. No production secrets are placed in the workflow.

## Required production QA

- Verify HTTPS redirects and HSTS on the canonical domain and all production subdomains.
- Confirm API responses include `Cache-Control: private, no-store, max-age=0`.
- Confirm `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and the configured referrer/permissions policies.
- As a merchant, attempt to update a product belonging to another store; expect 403 or 409 and no database change.
- As a merchant, attempt to advance an order for a store not owned by the account; expect 403 and no database change.
- As a customer, verify order/notification APIs return only the authenticated user's own records.
- As an unauthenticated user, verify private APIs return 401; as a non-admin, verify admin APIs return 403.
- Confirm wallet balances and ledger entries cannot be changed through direct client requests.
- Exercise checkout, merchant order transitions, captain delivery, cashout review, and notification insertion in a staging Supabase project.
- Confirm migrations are present in the intended Supabase project before enabling dependent features.

## Known gaps

- Referral reward settlement still has no verified current API event producer; notification integration must wait for a reviewed, idempotent reward-settlement workflow.
- Browser push subscription registration and VAPID delivery are not implemented.
- Supabase migration application status and live end-to-end business tests are not verifiable from source control or Vercel build logs alone.
- A Content Security Policy is intentionally not enabled yet. It needs an asset, Supabase, OAuth, and inline-script inventory first to avoid breaking sign-in or media loading.
