# SHAKH STORE M10 — Notifications & PWA

## Delivered in this phase

- Private in-app notification table with per-user row-level security.
- Authenticated API:
  - `GET /api/notifications` — latest 100 notifications for the signed-in user.
  - `PATCH /api/notifications` — mark one notification read or mark all of the current user's notifications read.
- Sorani RTL inbox at `/notifications`.
- Service worker push-event and notification-click handlers.
- Offline fallback page at `/offline.html`.
- Service-worker cache policy narrowed to the public home shell and static Next.js assets. API, auth, dashboard, and notification routes are excluded from caching to avoid storing private pages on shared devices.

## Database migration

Apply after the already completed migrations 0001, 0002, and 0003:

4. `supabase/migrations/0004_in_app_notifications.sql`

The table is private by RLS. Authenticated users can select only their own notifications and update only the `read_at` column. Direct client insert/delete is not granted. Trusted server processes (service role) must create notification rows.

## Order lifecycle integration

Trusted server-side notification delivery is now connected to these order events:

- Customer places an order: the owning store receives an in-app notification.
- Merchant changes an order to confirmed, preparing, or ready: the customer is notified.
- Admin assigns a captain: the captain and customer are notified.
- Captain changes delivery to out-for-delivery or delivered: the customer is notified.

The shared writer is `src/lib/server/notifications.ts`. It uses the Supabase service-role key only on the server, validates recipients and titles, limits body length, and logs insertion failures. Notification delivery is deliberately non-fatal: a successful order operation remains successful if notification insertion fails. Notification data contains order identifiers and status only; customer contact details are not copied into notification payloads.

Cashout review is now connected after the atomic `review_wallet_cashout` RPC succeeds: the reward-wallet owner receives an approval or rejection notice. Approval notices distinguish the ledger approval from the separate real-world payout operation; the 75% external payout is not represented as completed by the notification. Referral reward accrual is not yet wired: the current app API routes do not expose a reward-settlement event producer, and the legacy settlement function was removed by the cashout migration. Browser push subscription registration and VAPID-based delivery are also not enabled; the service-worker push handler alone is not an end-to-end push service.

## Verification

- Signed-out request to `GET /api/notifications` returns 401.
- Signed-in user sees only their own notifications.
- User cannot insert or delete notifications directly.
- User can update only `read_at` for their own rows.
- `PATCH` cannot update another user's notification.
- Notification page uses `no-store` fetch and is excluded from service-worker caching.
- Public home page can fall back to the cached shell or offline page.
- Push notification clicks are constrained to same-origin destinations.
