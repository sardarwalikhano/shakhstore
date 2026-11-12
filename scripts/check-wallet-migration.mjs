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
  ["duplicate database keys return HTTP 409", topupApi.includes('errorCode === "23505"') && topupApi.includes("status: 409")],
];

let failures = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
  if (!passed) failures += 1;
}

console.log(`\nWallet migration invariants: ${checks.length - failures}/${checks.length} passed.`);
if (failures > 0) process.exitCode = 1;
