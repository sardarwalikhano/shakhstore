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

## Current scope and remaining integration

This phase establishes the in-app notification inbox and PWA delivery foundation. Business-event producers (order status changes, referral reward accrual, and cashout review) still need to call a trusted server-side notification writer. Browser push subscription registration and VAPID-based delivery are not enabled yet; do not treat the service-worker push handler alone as an end-to-end push service.

## Verification

- Signed-out request to `GET /api/notifications` returns 401.
- Signed-in user sees only their own notifications.
- User cannot insert or delete notifications directly.
- User can update only `read_at` for their own rows.
- `PATCH` cannot update another user's notification.
- Notification page uses `no-store` fetch and is excluded from service-worker caching.
- Public home page can fall back to the cached shell or offline page.
- Push notification clicks are constrained to same-origin destinations.
