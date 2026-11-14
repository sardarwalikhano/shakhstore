# Product Categories and Delivery Service Zones

## Merchant product categories

Merchant product categories are determined by the trusted Supabase `app_metadata.role`:

| Store role | Product category key | Meaning |
|---|---|---|
| `restaurant` | `food` | خواردن |
| `supermarket` | `grocery` | کەلوپەل |
| `produce_vendor` | `produce` | سەوزە و میوە |
| `meat_seafood_vendor` | `meat_seafood` | گۆشت و ماسی |

Merchants see only their mapped category in Product Management and only their own mapped-category products in the merchant product list. The API also rejects a category mismatch on create and update, so changing the browser request cannot bypass this rule. Admin and Super Admin retain access to all catalogue categories.

## Store delivery service zone

M18 adds these columns to `public.stores`:

- `service_center_lat`: service-zone centre latitude.
- `service_center_lng`: service-zone centre longitude.
- `service_radius_km`: radius in kilometres.

The configured service zone is a circle centred on the store, with an allowed radius from 0.1 to 100 km. All three fields must be set together or all must be NULL. A store without a configured zone cannot accept new orders.

An Admin or Super Admin opens **Dashboard → Admin → Stores**, selects an approved store, and configures the centre and radius. The GPS button records the current browser device's location; use it only while physically at the store. Otherwise enter the store's coordinates manually. The radius is saved separately and shown on the store row.

## Customer checkout

Checkout requires:
- Delivery address.
- Valid mobile telephone number (7–15 digits; optional leading plus, spaces, parentheses or hyphens).
- Delivery GPS coordinates captured at the intended delivery destination.

The browser and API check the service radius. The PostgreSQL `place_store_order` function repeats the check while the store row is locked, so a client-side bypass or a last-moment zone change cannot create an out-of-zone order. An out-of-zone checkout returns HTTP 422 and the message:

> ببورە، بۆ ئەم ناوچەیە خزمەتگوزاریی گەیاندن بەردەست نییە.

A valid mobile number is stored in `orders.customer_phone` so the store/captain workflow can contact the customer. Exact delivery GPS coordinates are used for validation and are not persisted by this migration.

## Validation and rollout

- `scripts/test-order-service-zone-migration.sql` tests an in-zone order, an out-of-zone rejection, missing mobile number, unconfigured zone, RPC privileges, saved phone, stock decrement and no side effects from rejected orders against an isolated PostgreSQL 17 fixture.
- `scripts/check-wallet-migration.mjs` contains static invariants for category restrictions, checkout inputs, admin service-zone configuration and server/database zone checks.
- These tests do not constitute a live Supabase Auth/RLS/Storage staging test.
- Apply M18 only after Production schema/history reconciliation and a clean isolated staging replay. Do not apply it to Production while the duplicate legacy `0004` and migration-history drift remain unresolved.
