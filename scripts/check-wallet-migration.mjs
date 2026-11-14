import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/0016_manual_cashout_settlement.sql",
);
const sql = readFileSync(migrationPath, "utf8");
const topupMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261112183000_wallet_topup_duplicate_protection.sql",
);
const topupSql = readFileSync(topupMigrationPath, "utf8");
const topupApiPath = resolve(process.cwd(), "src/app/api/wallet/topups/route.ts");
const topupApi = readFileSync(topupApiPath, "utf8");
const topupPagePath = resolve(process.cwd(), "src/app/dashboard/wallet/top-up/page.tsx");
const topupPage = readFileSync(topupPagePath, "utf8");
const dashboardAuthPath = resolve(process.cwd(), "src/lib/server/dashboard-auth.ts");
const dashboardAuth = readFileSync(dashboardAuthPath, "utf8");
const dashboardLayoutPath = resolve(process.cwd(), "src/app/dashboard/layout.tsx");
const dashboardLayout = readFileSync(dashboardLayoutPath, "utf8");
const adminLayoutPath = resolve(process.cwd(), "src/app/dashboard/admin/layout.tsx");
const adminLayout = readFileSync(adminLayoutPath, "utf8");
const topupsAdminLayoutPath = resolve(process.cwd(), "src/app/dashboard/admin/wallet-topups/layout.tsx");
const topupsAdminLayout = readFileSync(topupsAdminLayoutPath, "utf8");
const usersAdminLayoutPath = resolve(process.cwd(), "src/app/dashboard/admin/users/layout.tsx");
const usersAdminLayout = readFileSync(usersAdminLayoutPath, "utf8");
const cashoutsAdminLayoutPath = resolve(process.cwd(), "src/app/dashboard/admin/cashouts/layout.tsx");
const cashoutsAdminLayout = readFileSync(cashoutsAdminLayoutPath, "utf8");
const dashboardPagePath = resolve(process.cwd(), "src/app/dashboard/page.tsx");
const dashboardPage = readFileSync(dashboardPagePath, "utf8");
const commissionAdminApi = readFileSync(resolve(process.cwd(), "src/app/api/admin/captain-commission/route.ts"), "utf8");
const deliveriesAdminApi = readFileSync(resolve(process.cwd(), "src/app/api/admin/deliveries/route.ts"), "utf8");
const storesAdminApi = readFileSync(resolve(process.cwd(), "src/app/api/admin/stores/route.ts"), "utf8");
const usersAdminApi = readFileSync(resolve(process.cwd(), "src/app/api/admin/users/route.ts"), "utf8");
const cashoutsAdminApi = readFileSync(resolve(process.cwd(), "src/app/api/admin/cashouts/route.ts"), "utf8");
const topupsAdminApi = readFileSync(resolve(process.cwd(), "src/app/api/admin/wallet-topups/route.ts"), "utf8");
const captainLayout = readFileSync(resolve(process.cwd(), "src/app/dashboard/captain/layout.tsx"), "utf8");
const merchantLayout = readFileSync(resolve(process.cwd(), "src/app/dashboard/merchant/layout.tsx"), "utf8");
const productsLayout = readFileSync(resolve(process.cwd(), "src/app/dashboard/products/layout.tsx"), "utf8");
const storeLayout = readFileSync(resolve(process.cwd(), "src/app/dashboard/store/layout.tsx"), "utf8");
const captainDeliveriesApi = readFileSync(resolve(process.cwd(), "src/app/api/captain/deliveries/route.ts"), "utf8");
const captainEarningsApi = readFileSync(resolve(process.cwd(), "src/app/api/captain/earnings/route.ts"), "utf8");
const merchantOrdersApi = readFileSync(resolve(process.cwd(), "src/app/api/merchant/orders/route.ts"), "utf8");
const storesApi = readFileSync(resolve(process.cwd(), "src/app/api/stores/route.ts"), "utf8");
const middleware = readFileSync(resolve(process.cwd(), "src/middleware.ts"), "utf8");
const ordersApi = readFileSync(resolve(process.cwd(), "src/app/api/orders/route.ts"), "utf8");
const cancelOrderApi = readFileSync(resolve(process.cwd(), "src/app/api/orders/cancel/route.ts"), "utf8");
const notificationsApi = readFileSync(resolve(process.cwd(), "src/app/api/notifications/route.ts"), "utf8");
const cashoutsApi = readFileSync(resolve(process.cwd(), "src/app/api/wallet/cashouts/route.ts"), "utf8");
const captainDeliveriesApiSource = readFileSync(resolve(process.cwd(), "src/app/api/captain/deliveries/route.ts"), "utf8");
const productCategories = readFileSync(resolve(process.cwd(), "src/lib/product-categories.ts"), "utf8");
const productsApi = readFileSync(resolve(process.cwd(), "src/app/api/products/route.ts"), "utf8");
const productByIdApi = readFileSync(resolve(process.cwd(), "src/app/api/products/[id]/route.ts"), "utf8");
const productsPage = readFileSync(resolve(process.cwd(), "src/app/dashboard/products/page.tsx"), "utf8");
const marketPage = readFileSync(resolve(process.cwd(), "src/app/market/page.tsx"), "utf8");
const serviceZone = readFileSync(resolve(process.cwd(), "src/lib/service-zone.ts"), "utf8");
const serviceZoneMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261114071730_store_service_zones_and_checkout_phone.sql"), "utf8");
const orderApi = readFileSync(resolve(process.cwd(), "src/app/api/orders/route.ts"), "utf8");
const adminStoresPage = readFileSync(resolve(process.cwd(), "src/app/dashboard/admin/stores/page.tsx"), "utf8");
const adminStoresApi = readFileSync(resolve(process.cwd(), "src/app/api/admin/stores/route.ts"), "utf8");
const merchantStorePage = readFileSync(resolve(process.cwd(), "src/app/dashboard/store/page.tsx"), "utf8");
const serviceZoneIntegration = readFileSync(resolve(process.cwd(), "scripts/test-order-service-zone-migration.sql"), "utf8");
const productApi = productsApi;
const productItemApi = productByIdApi;
const serviceZoneHelper = serviceZone;
const orderZoneApi = orderApi;
const storeZoneAdminApi = adminStoresApi;
const storeZoneAdminPage = adminStoresPage;
const orderZoneIntegration = serviceZoneIntegration;
const MERCHANT_ROLES = ["restaurant","supermarket","produce_vendor","meat_seafood_vendor"];
const TYPES = ["restaurant","supermarket","produce_vendor","meat_seafood_vendor"];







function functionBody(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const definition = new RegExp(
    `create(?: or replace)? function public\\.${escaped}\\(`,
    "i",
  );
  const match = definition.exec(sql);
  if (!match || match.index === undefined) {
    throw new Error(`Missing function definition: public.${name}`);
  }
  const endMarker = String.fromCharCode(10, 36, 36, 59);
  const end = sql.indexOf(endMarker, match.index);
  if (end < 0) {
    throw new Error(`Unterminated function definition: public.${name}`);
  }
  return sql.slice(match.index, end + endMarker.length);
}

const transfer = functionBody("post_wallet_transfer");
const reward = functionBody("settle_cash_referral_reward");
const request = functionBody("request_wallet_cashout");
const review = functionBody("review_wallet_cashout");
const paid = functionBody("mark_wallet_cashout_paid");

const checks = [
  ["wallet transfer validates positive amount", /p_amount_iqd is null or p_amount_iqd <= 0/i.test(transfer)],
  ["wallet transfer enforces cashout reservation", transfer.includes("Insufficient available wallet balance after cashout reservations")],
  ["referral reward validates positive amount", /p_total_iqd is null or p_total_iqd <= 0/i.test(reward)],
  ["referral reward enforces cashout reservation", reward.includes("Insufficient available wallet balance after cashout reservations")],
  ["cashout request reserves pending and unsettled approved requests", request.includes("status = 'pending'") && request.includes("status = 'approved' and wallet_transaction_id is null")],
  ["all debit paths lock accounts deterministically", [transfer, reward].every((body) => /order by id\s+for update/i.test(body))],
  ["all debit paths recheck idempotency after locks", [transfer, reward].every((body) => {
    const lock = body.search(/order by id\s+for update/i);
    const recheck = body.lastIndexOf("select id into v_existing_id");
    return lock >= 0 && recheck > lock;
  })],
  ["approval changes workflow state without ledger settlement", review.includes("set status = 'approved'") && review.includes("wallet_transaction_id = null") && !/update public\.wallet_accounts|insert into public\.wallet_(?:transactions|entries)/i.test(review)],
  ["mark-paid posts settlement exactly once", paid.includes("Cashout settlement already exists") && paid.includes("'cashout:' || p_request_id::text")],
  ["legacy settled cashouts are not posted twice", paid.includes("if v_request.wallet_transaction_id is not null then")],
  ["legacy void RPC is dropped before UUID-returning replacement", sql.indexOf("drop function if exists public.mark_wallet_cashout_paid(uuid, uuid);") < sql.indexOf("create function public.mark_wallet_cashout_paid(")],
  ["legacy approved-has-transaction constraint is removed", sql.includes("drop constraint if exists cashout_approved_has_transaction;")],
  ["restricted RPCs are explicitly service-role-only", ["post_wallet_transfer", "settle_cash_referral_reward", "review_wallet_cashout", "mark_wallet_cashout_paid"].every((name) => new RegExp(`grant execute on function public\\.${name}\\([^;]+to service_role;`, "i").test(sql))],
  ["payout clearing is not treated as bank balance", /Never interpret this balance as bank funds|not a bank balance/i.test(sql)],
  ["top-up migration stores SHA-256 receipt hashes", /add column if not exists receipt_sha256 text/i.test(topupSql)],
  ["top-up migration stores normalized payment references", /add column if not exists sender_reference_normalized text/i.test(topupSql)],
  ["normalized payment references have a bounded length", topupSql.includes("char_length(sender_reference_normalized) between 3 and 120")],
  ["receipt hashes have a partial unique index", topupSql.includes("create unique index if not exists wallet_topup_receipt_sha256_uidx") && topupSql.includes("where receipt_sha256 is not null")],
  ["provider-scoped normalized references have a unique index", topupSql.includes("create unique index if not exists wallet_topup_payment_reference_uidx") && topupSql.includes("payment_method, sender_reference_normalized")],
  ["pending requests require integrity metadata", topupSql.includes("status <> 'pending'") && topupSql.includes("receipt_sha256 is not null") && topupSql.includes("sender_reference_normalized is not null")],
  ["top-up approval refuses legacy rows without integrity metadata", topupSql.includes("v_request.receipt_sha256 is null") && topupSql.includes("v_request.sender_reference_normalized is null")],
  ["top-up API computes a SHA-256 digest", topupApi.includes('createHash("sha256")')],
  ["top-up API requires and normalizes payment reference", topupApi.includes("normalizedReference = senderReference.replace") && topupApi.includes("sender_reference_normalized: normalizedReference")],
  ["top-up API bounds raw payment references", topupApi.includes("senderReference.length > 120")],
  ["duplicate database keys return HTTP 409", topupApi.includes('errorCode === "23505"') && topupApi.includes("status: 409")],
  ["top-up UI requires external transaction reference", topupPage.includes('id="topup-reference"') && topupPage.includes("minLength={3}") && topupPage.includes('required dir="ltr"')],
  ["top-up history displays submitted payment reference", topupPage.includes("item.sender_reference") && topupPage.includes("Reference:")],
  ["dashboard guard verifies the current Supabase user server-side", dashboardAuth.includes("supabase.auth.getUser()") && dashboardAuth.includes('redirect("/login")')],
  ["missing Supabase configuration uses the supported login error code", dashboardAuth.includes('redirect("/login?error=config")')],
  ["all dashboard routes use a force-dynamic server guard", dashboardLayout.includes('dynamic = "force-dynamic"') && dashboardLayout.includes("await requireDashboardUser()")],
  ["admin dashboard pages are restricted to trusted admin roles", adminLayout.includes('requireDashboardUser(["admin", "super_admin"])')],
  ["admin route layout is force-dynamic", adminLayout.includes('dynamic = "force-dynamic"')],
  ["top-up review page is restricted to super_admin", topupsAdminLayout.includes('requireDashboardUser(["super_admin"])')],
  ["cashout management page is restricted to super_admin", cashoutsAdminLayout.includes('requireDashboardUser(["super_admin"])')],
  ["user role management page is restricted to super_admin", usersAdminLayout.includes('requireDashboardUser(["super_admin"])')],
  ["captain commission API permits only trusted admin roles", commissionAdminApi.includes('user.app_metadata?.role') && commissionAdminApi.includes('role !== "admin" && role !== "super_admin"')],
  ["delivery assignment API permits only trusted admin roles", deliveriesAdminApi.includes('user.app_metadata?.role!=="super_admin"&&user.app_metadata?.role!=="admin"')],
  ["store review API permits only trusted admin roles", storesAdminApi.includes('user.app_metadata?.role!=="super_admin"&&user.app_metadata?.role!=="admin"')],
  ["user role administration API requires super_admin", usersAdminApi.includes('user.app_metadata?.role !== "super_admin"')],
  ["cashout API requires super_admin", cashoutsAdminApi.includes('user.app_metadata?.role !== "super_admin"')],
  ["top-up review API requires super_admin", topupsAdminApi.includes('user.app_metadata?.role !== "super_admin"')],
  ["captain dashboard pages require the captain role", captainLayout.includes('requireDashboardUser(["captain"])')],
  ["merchant dashboard pages allow only merchant and admin roles", ["restaurant","supermarket","produce_vendor","meat_seafood_vendor","admin","super_admin"].every((role) => merchantLayout.includes('"' + role + '"'))],
  ["product management pages exclude customer accounts", ["restaurant","supermarket","produce_vendor","meat_seafood_vendor","admin","super_admin"].every((role) => productsLayout.includes('"' + role + '"'))],
  ["store onboarding pages allow only merchant roles", ["restaurant","supermarket","produce_vendor","meat_seafood_vendor"].every((role) => storeLayout.includes('"' + role + '"')) && !storeLayout.includes('"customer"') && !storeLayout.includes('"admin"')],
  ["captain delivery API verifies trusted captain role", captainDeliveriesApi.includes('user.app_metadata?.role!=="captain"')],
  ["captain earnings API verifies trusted captain role", captainEarningsApi.includes('user.app_metadata?.role !== "captain"')],
  ["merchant orders API checks trusted merchant or admin role", merchantOrdersApi.includes("MERCHANT_ROLES.includes(role)") && merchantOrdersApi.includes('role!=="admin"&&role!=="super_admin"')],
  ["store API binds submitted store type to the trusted merchant role", storesApi.includes('TYPES.includes(role as typeof TYPES[number])') && storesApi.includes("storeType!==role")],
  ["store onboarding API returns the trusted role for its form", storesApi.includes("store:data,role:ctx.role")],
  ["store onboarding UI shows one fixed store type from the trusted role", merchantStorePage.includes("setUserRole(role)") && merchantStorePage.includes("types.find(t=>t.value===userRole)") && merchantStorePage.includes("ناتوانیت بەشی دوکانێکی تر هەڵبژێریت")],
  ["store onboarding UI does not expose a merchant type dropdown", !merchantStorePage.includes('<select className={input} value={form.storeType}')],
  ["merchant product edits and deletes re-check category ownership", productByIdApi.includes("current.category!==merchantCategory") && productByIdApi.includes('.eq("category",merchantCategory)') && productByIdApi.includes('.eq("category",requiredCategory)')],

  ["API mutation middleware blocks cross-site write requests", middleware.includes('new Set(["GET", "HEAD", "OPTIONS"])') && middleware.includes('fetchSite === "cross-site"') && middleware.includes("Cross-origin API mutation is not allowed")],
  ["API mutation middleware validates Origin and Referer", middleware.includes('request.headers.get("origin")') && middleware.includes('request.headers.get("referer")')],
  ["customer order history is scoped to the authenticated user", ordersApi.includes('.eq("customer_id", c.user.id)')],
  ["only customers can place orders", ordersApi.includes('if (c.role !== "customer")')],
  ["order cancellation checks customer ownership before RPC", cancelOrderApi.includes('.eq("customer_id", c.user.id)') && cancelOrderApi.includes('role !== "customer"')],
  ["notification reads and updates are scoped to the authenticated user", (notificationsApi.match(/\.eq\("user_id", auth\.user\.id\)/g) ?? []).length >= 2],
  ["cashout history is scoped to the authenticated user's wallet", cashoutsApi.includes('.eq("user_id", c.user.id)')],
  ["top-up history and new requests use the authenticated user ID", topupApi.includes('.eq("user_id", c.user.id)') && topupApi.includes("user_id: c.user.id")],
  ["captain delivery reads and updates are scoped to the assigned captain", captainDeliveriesApiSource.includes('.eq("captain_id",c.user.id)')],
  ["merchant order queries and updates enforce store ownership", merchantOrdersApi.includes('query=query.in("store_id",storeIds)') && merchantOrdersApi.includes('.in("store_id",permittedStoreIds)')],
  ["restaurant role maps only to food category", productCategories.includes('restaurant: "food"')],
  ["supermarket role maps only to grocery category", productCategories.includes('supermarket: "grocery"')],
  ["produce vendor role maps only to produce category", productCategories.includes('produce_vendor: "produce"')],
  ["meat and seafood vendor role maps only to meat_seafood category", productCategories.includes('meat_seafood_vendor: "meat_seafood"')],
  ["merchant product list is filtered by trusted role category", productApi.includes('q=q.eq("category",roleCategory)')],
  ["merchant product creation rejects another category", productApi.includes("requiredMerchantCategory&&category!==requiredMerchantCategory")],
  ["merchant product updates reject another category", productItemApi.includes("requiredCategory&&v.category!==requiredCategory")],
  ["merchant product UI hides other category options", productsPage.includes("{isAdmin ?") && productsPage.includes("productCategoryForRole(userRole)")],
  ["M18 adds store centre and delivery radius columns", serviceZoneMigration.includes("service_center_lat") && serviceZoneMigration.includes("service_center_lng") && serviceZoneMigration.includes("service_radius_km")],
  ["M18 zone shape constraint rejects partial configuration", serviceZoneMigration.includes("service_center_lat is not null") && serviceZoneMigration.includes("service_center_lng is not null") && serviceZoneMigration.includes("service_radius_km is not null")],
  ["M18 limits service radius to 100 kilometres", serviceZoneMigration.includes("service_radius_km <= 100")],
  ["M18 requires a customer phone at database level", serviceZoneMigration.includes("Customer phone is required or invalid") && serviceZoneMigration.includes("p_customer_phone is null")],
  ["M18 requires valid delivery coordinates at database level", serviceZoneMigration.includes("Delivery location is required or invalid") && serviceZoneMigration.includes("p_delivery_latitude is null")],
  ["M18 checks destination against store radius in SQL", serviceZoneMigration.includes("Delivery location is outside service zone") && serviceZoneMigration.includes("v_distance_km > v_store.service_radius_km")],
  ["M18 order RPC remains service-role-only", serviceZoneMigration.includes("from public, anon, authenticated") && /to service_role;/.test(serviceZoneMigration)],
  ["service-zone helper validates coordinates and radius", serviceZoneHelper.includes("function isValidGeoPoint") && serviceZoneHelper.includes("radiusKm > 100")],
  ["service-zone helper uses Haversine distance", serviceZoneHelper.includes("6371.0088") && serviceZoneHelper.includes("Math.asin(Math.sqrt")],
  ["customer checkout requires mobile number", marketPage.includes('id="delivery-phone"') && marketPage.includes("required minLength={7}")],
  ["customer checkout requires GPS location", marketPage.includes("captureDeliveryLocation") && marketPage.includes("!deliveryCoordinates")],
  ["customer checkout sends phone and delivery coordinates", marketPage.includes("customer_phone:phone.trim()") && marketPage.includes("delivery_latitude:deliveryCoordinates.latitude") && marketPage.includes("delivery_longitude:deliveryCoordinates.longitude")],
  ["order API validates phone and coordinates before placing order", orderZoneApi.includes("phoneDigits.length < 7") && orderZoneApi.includes("isValidGeoPoint(destination)")],
  ["order API returns the requested apology when outside service zone", orderZoneApi.includes("ببورە، بۆ ئەم ناوچەیە خزمەتگوزاریی گەیاندن بەردەست نییە.") && orderZoneApi.includes("status: 422")],
  ["order API fails closed when a store zone is not configured", orderZoneApi.includes("ئەم دوکانە هێشتا ناوچەی گەیاندنی خۆی دیاری نەکردووە.") && orderZoneApi.includes("status: 503")],
  ["admin API validates service-zone configuration and approved store status", storeZoneAdminApi.includes("Only approved stores can have a delivery zone configured") && storeZoneAdminApi.includes("serviceCenterLat")],
  ["admin store page provides GPS centre and radius controls", storeZoneAdminPage.includes("navigator.geolocation.getCurrentPosition") && storeZoneAdminPage.includes("saveServiceZone") && storeZoneAdminPage.includes("serviceRadiusKm:radius")],
  ["PostgreSQL integration covers inside and outside service-zone cases", orderZoneIntegration.includes("inside_zone_order_id") && orderZoneIntegration.includes("Expected outside-zone rejection")],
  ["PostgreSQL integration covers missing phone and zone", orderZoneIntegration.includes("Expected missing-phone rejection") && orderZoneIntegration.includes("Expected missing-zone rejection")],
  ["PostgreSQL integration verifies RPC grants and no failed-order stock loss", orderZoneIntegration.includes("anon must not execute") && orderZoneIntegration.includes("authenticated must not execute") && orderZoneIntegration.includes("Expected stock 8")],
  ["restaurant merchant role maps only to food category", productCategories.includes('restaurant: "food"')],
  ["supermarket merchant role maps only to grocery category", productCategories.includes('supermarket: "grocery"')],
  ["produce merchant role maps only to produce category", productCategories.includes('produce_vendor: "produce"')],
  ["meat and seafood merchant role maps only to meat_seafood category", productCategories.includes('meat_seafood_vendor: "meat_seafood"')],
  ["merchant catalog list is filtered by the role-specific category", productsApi.includes('q=q.eq("category",roleCategory)')],
  ["product creation rejects categories outside the merchant role", productsApi.includes("requiredMerchantCategory&&category!==requiredMerchantCategory")],
  ["merchant product edit rejects legacy products from another category", productByIdApi.includes("current.category!==merchantCategory")],
  ["merchant product update writes are constrained by the role-specific category", productByIdApi.includes('.eq("category",merchantCategory)')],
  ["merchant product deletion is constrained by the role-specific category", productByIdApi.includes('.eq("category",requiredCategory)')],
  ["merchant product page hides other categories", productsPage.includes("{isAdmin ?") && productsPage.includes("productCategoryForRole(userRole)") && productsPage.includes("پۆلێنی دیکە بۆت نیشان نادرێت")],
  ["checkout explicitly requires a mobile telephone number", marketPage.includes('type="tel"') && marketPage.includes('id="delivery-phone"') && marketPage.includes("ژمارەی مۆبایل *")],
  ["checkout validates phone format and sends it to order API", marketPage.includes("phoneDigits.length<7") && marketPage.includes("customer_phone:phone.trim()")],
  ["order API rejects absent or invalid customer phone", orderApi.includes("phoneDigits.length < 7") && orderApi.includes("phoneDigits.length > 15")],
  ["order API passes the authenticated checkout phone to the RPC", orderApi.includes("p_customer_phone: phone")],
  ["M18 database RPC requires and persists customer phone", serviceZoneMigration.includes("Customer phone is required or invalid") && serviceZoneMigration.includes("trim(p_customer_phone)")],
  ["M18 database RPC requires valid delivery coordinates", serviceZoneMigration.includes("Delivery location is required or invalid") && serviceZoneMigration.includes("p_delivery_latitude not between -90 and 90")],
  ["delivery-zone calculation uses a validated great-circle distance", serviceZone.includes("6371.0088") && serviceZone.includes("isWithinServiceRadius") && serviceZone.includes("isValidGeoPoint")],
  ["checkout obtains current delivery coordinates with browser geolocation", marketPage.includes("navigator.geolocation.getCurrentPosition") && marketPage.includes("delivery_latitude:deliveryCoordinates.latitude")],
  ["order API refuses delivery outside the store service radius", orderApi.includes("isWithinServiceRadius(destination, serviceCenter, serviceRadiusKm)") && orderApi.includes("status: 422")],
  ["outside-zone response tells the customer delivery is unavailable", orderApi.includes("ببورە، بۆ ئەم ناوچەیە خزمەتگوزاریی گەیاندن بەردەست نییە.")],
  ["M18 database RPC repeats service-zone validation atomically", serviceZoneMigration.includes("Delivery location is outside service zone") && serviceZoneMigration.includes("for share")],
  ["service-zone database constraint rejects partial zone configuration", ["service_center_lat is not null","service_center_lng is not null","service_radius_km is not null"].every((s) => serviceZoneMigration.includes(s))],
  ["Super Admin store screen can configure service-zone centre and radius", adminStoresPage.includes("saveServiceZone") && adminStoresPage.includes("serviceRadiusKm") && adminStoresPage.includes("captureZoneCenter")],
  ["admin service-zone API only updates approved stores", adminStoresApi.includes("Only approved stores can have a delivery zone configured") && adminStoresApi.includes('role!=="super_admin"&&user.app_metadata?.role!=="admin"')],
  ["M18 PostgreSQL fixture covers phone, zone, stock and RPC grants", serviceZoneIntegration.includes("Customer phone is required or invalid") && serviceZoneIntegration.includes("Delivery location is outside service zone") && serviceZoneIntegration.includes("service_role must execute the new order RPC")],




  ["cashout management link is shown only in the super-admin card group", dashboardPage.includes('...(role==="super_admin"?[{title:"بەڕێوەبردنی Cashout"') && !dashboardPage.includes('...(admin?[{title:"بەڕێوەبردنی Cashout"')],
];

let failures = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
  if (!passed) failures += 1;
}

console.log(`\nWallet, catalog and checkout invariants: ${checks.length - failures}/${checks.length} passed.`);
if (failures > 0) process.exitCode = 1;
