# SHAKH STORE — Dashboard and API Role Access Matrix

This matrix records the intended trusted-role policy implemented in the Feature Branch. Authorization uses Supabase `app_metadata.role`; user-editable `user_metadata` is not an authorization source.

## Dashboard route matrix

| Route | Allowed roles | Enforcement |
|---|---|---|
| `/dashboard/**` | Any authenticated role | `src/app/dashboard/layout.tsx` |
| `/dashboard/admin/**` | `admin`, `super_admin` | `src/app/dashboard/admin/layout.tsx` |
| `/dashboard/admin/users` | `super_admin` only | Nested `users/layout.tsx` |
| `/dashboard/admin/wallet-topups` | `super_admin` only | Nested `wallet-topups/layout.tsx` |
| `/dashboard/admin/cashouts` | `super_admin` only | Nested `cashouts/layout.tsx` |
| `/dashboard/captain/**` | `captain` only | `src/app/dashboard/captain/layout.tsx` |
| `/dashboard/merchant/**` | Merchant roles, `admin`, `super_admin` | `src/app/dashboard/merchant/layout.tsx` |
| `/dashboard/products` | Merchant roles, `admin`, `super_admin` | `src/app/dashboard/products/layout.tsx` |
| `/dashboard/store` | Merchant roles only | `src/app/dashboard/store/layout.tsx` |
| `/dashboard/wallet/**` | Any authenticated role | Parent Dashboard guard |

Merchant roles: `restaurant`, `supermarket`, `produce_vendor`, `meat_seafood_vendor`.

## Merchant product-category isolation

| Trusted merchant role | Visible and writable product category |
|---|---|
| `restaurant` | `food` |
| `supermarket` | `grocery` |
| `produce_vendor` | `produce` |
| `meat_seafood_vendor` | `meat_seafood` |

Merchant product listing queries are filtered to the role's category and the authenticated user's approved store. Product creation rejects any different category. Product edits and deletes also verify the existing category and repeat category/owner/store predicates on the write. Other merchant categories are not offered in the merchant form; Admin and Super Admin retain cross-category controls.


A role-specific layout is a user-interface and route-access layer. It does not replace authorization inside API handlers; every privileged API must independently verify the current Supabase user and trusted role.

## API authorization matrix

| API family | Allowed roles | Server-side check |
|---|---|---|
| `/api/admin/captain-commission` | `admin`, `super_admin` | Trusted app metadata |
| `/api/admin/deliveries` | `admin`, `super_admin` | Trusted app metadata |
| `/api/admin/stores` | `admin`, `super_admin` | Trusted app metadata |
| `/api/admin/users` | `super_admin` only | Trusted app metadata |
| `/api/admin/wallet-topups` | `super_admin` only | Trusted app metadata |
| `/api/admin/cashouts` | `super_admin` only | Trusted app metadata |
| `/api/captain/deliveries` | `captain` only | Trusted app metadata and row ownership |
| `/api/captain/earnings` | `captain` only | Trusted app metadata and captain ID |
| `/api/merchant/orders` | Merchant roles, `admin`, `super_admin` | Trusted app metadata and store ownership |
| `/api/stores` GET | Authenticated user; returns only the caller's store | User ID ownership filter |
| `/api/stores` POST | Merchant roles only | Role and `store_type === role` check |
| `/api/products` and product-image upload | Merchant roles, `admin`, `super_admin` for writes | Trusted role and store ownership for merchants |

## Security invariants

1. Server Components and nested layouts call `supabase.auth.getUser()` before rendering protected routes.
2. Missing Supabase server configuration fails closed to the Login page; it never falls back to trusting client-supplied role values.
3. Admin APIs independently return 401 for unauthenticated requests and 403 for authenticated but unauthorized roles.
4. Sensitive Super Admin pages have both a parent Admin guard and a stricter nested Super Admin guard.
5. Merchant write APIs must bind ownership to the authenticated user and an approved store; receiving a merchant role alone is not sufficient.
6. Captain delivery queries and updates must constrain records to the authenticated captain ID.
7. Static CI invariants cover the key layout/API role checks. These checks complement, but do not replace, signed-in role-matrix integration tests against isolated staging Supabase Auth users.

## Validation status and limitations

- Current-head CI must pass before these changes are considered validated.
- Anonymous Preview smoke tests can prove protected pages do not render for signed-out visitors. They cannot prove every signed-in role branch without test users and an isolated Supabase environment.
- Preview Wallet APIs currently fail closed because an isolated Preview Supabase URL and anon key have not been configured.
- Production remains unchanged. No role metadata, Auth users, RLS policies, or database grants were modified by this dashboard-route work.
