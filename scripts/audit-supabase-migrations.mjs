import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve(process.cwd(), "supabase/migrations");
const strict = process.argv.includes("--strict");

if (!existsSync(directory)) {
  console.error("BLOCKED: supabase/migrations directory does not exist.");
  process.exit(2);
}

const files = readdirSync(directory)
  .filter((name) => name.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

const timestamped = [];
const legacy = [];
const unrecognized = [];

for (const file of files) {
  const match = /^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/i.exec(file);
  if (match) {
    timestamped.push({ file, version: match[1] });
    continue;
  }

  const legacyMatch = /^(\d+)_/.exec(file);
  if (legacyMatch) {
    legacy.push({ file, version: legacyMatch[1] });
  } else {
    unrecognized.push(file);
  }
}

const versions = new Map();
for (const entry of [...timestamped, ...legacy]) {
  const group = versions.get(entry.version) ?? [];
  group.push(entry.file);
  versions.set(entry.version, group);
}
const duplicates = [...versions.entries()]
  .filter(([, names]) => names.length > 1)
  .sort(([a], [b]) => a.localeCompare(b));

console.log("SHAKH STORE Supabase migration inventory");
console.log(`SQL files: ${files.length}`);
console.log(`CLI timestamped files: ${timestamped.length}`);
console.log(`Legacy/non-timestamped numbered files: ${legacy.length}`);
console.log(`Unrecognized SQL files: ${unrecognized.length}`);

if (duplicates.length > 0) {
  console.log("\nDuplicate migration versions:");
  for (const [version, names] of duplicates) {
    console.log(`  ${version}: ${names.join(", ")}`);
  }
}

if (legacy.length > 0) {
  console.log("\nLegacy migration filenames requiring reconciliation:");
  for (const { file } of legacy) console.log(`  ${file}`);
}

if (unrecognized.length > 0) {
  console.log("\nUnrecognized migration filenames:");
  for (const file of unrecognized) console.log(`  ${file}`);
}

const blocked = legacy.length > 0 || unrecognized.length > 0 || duplicates.length > 0;
if (blocked) {
  console.log("\nBLOCKED: do not run supabase db push or repair migration history from this inventory.");
  console.log("Reconcile the exact live schema, create and test a baseline on an isolated staging database,");
  console.log("then establish a unique timestamped migration sequence without rewriting production history.");
} else {
  console.log("\nPASS: filenames have unique Supabase CLI timestamps.");
}

if (blocked && strict) {
  console.error("\nStrict mode failed because migration reconciliation is incomplete.");
  process.exitCode = 1;
}
