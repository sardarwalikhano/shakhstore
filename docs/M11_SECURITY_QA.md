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

- The project previously pinned `react` and `react-dom` to `19.1.7`. These were upgraded to `19.1.10` to address the React Server Components advisory GHSA-xqc2-xf4c-x3h3; the advisory lists 19.1.10 as patched for the 19.1 line.
- Next.js remains on `15.5.29`. The Next.js project release lists 15.5.29 as containing its November 3, 2026 security fixes; do not downgrade below this patch release.
- The previous Vercel install reported 8 dependency advisories (7 moderate, 1 high), before the React upgrade. A new install/audit result is required to know the remaining count. Do not use `npm audit fix --force` blindly.

## Build-time verification

- Production Vercel build through commit `ab1561667971c915250a0843f708dfe2313a88fa` completed with state `READY`.
- M11 code and dependency changes committed after that deployment require their own production build verification.
- Previous lint output contained three `@next/next/no-img-element` warnings in the product and marketplace pages.

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
