/**
 * Unit tests for pure JIT logic — no DB required.
 * Run with:  npx ts-node src/__tests__/unit.test.ts
 */
import assert from "assert";
import { roundQty, computeRequirementAlertStatus } from "../lib/jit";

let passed = 0;
let failed = 0;

function test(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅  ${label}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌  ${label}\n       ${e.message}`);
    failed++;
  }
}

// ─── roundQty ─────────────────────────────────────────────────────────────────
console.log("\n📐  roundQty — IEEE-754 artifact removal");
test("0.1 + 0.2  →  0.3",            () => assert.strictEqual(roundQty(0.1 + 0.2), 0.3));
test("0.19999999999999999  →  0.2",   () => assert.strictEqual(roundQty(0.19999999999999999), 0.2));
test("0.6000000000000001  →  0.6",    () => assert.strictEqual(roundQty(0.6000000000000001), 0.6));
test("60.00000001  →  60",            () => assert.strictEqual(roundQty(60.00000001), 60));
test("120.0000001  →  120",           () => assert.strictEqual(roundQty(120.0000001), 120));
test("0  →  0",                       () => assert.strictEqual(roundQty(0), 0));
test("clean integer 240  →  240",     () => assert.strictEqual(roundQty(240), 240));
test("0.5  stays 0.5",                () => assert.strictEqual(roundQty(0.5), 0.5));

// ─── computeRequirementAlertStatus ───────────────────────────────────────────
console.log("\n🚨  computeRequirementAlertStatus — JIT alert tiers");

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

// CRITICAL cases
test("null order  →  CRITICAL",
  () => assert.strictEqual(computeRequirementAlertStatus(null, days(30)), "CRITICAL"));

test("CANCELLED order  →  CRITICAL",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "CANCELLED", estimatedArrivalDate: days(20) }, days(30)),
    "CRITICAL"
  ));

test("IN_TRANSIT but no arrival date  →  CRITICAL",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "IN_TRANSIT", estimatedArrivalDate: null }, days(30)),
    "CRITICAL"
  ));

test("order arrives AFTER production date  →  CRITICAL",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "IN_TRANSIT", estimatedArrivalDate: days(35) }, days(30)),
    "CRITICAL"
  ));

// RED cases
test("arrives 3 days before production  →  RED",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "IN_TRANSIT", estimatedArrivalDate: days(10) }, days(13)),
    "RED"
  ));

test("arrives exactly 0 days before (same day)  →  RED",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "IN_TRANSIT", estimatedArrivalDate: days(10) }, days(10)),
    "RED"
  ));

test("arrives 6 days before  →  RED (below 7-day threshold)",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "IN_TRANSIT", estimatedArrivalDate: days(14) }, days(20)),
    "RED"
  ));

// YELLOW cases
test("arrives exactly 7 days before  →  YELLOW (boundary)",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "IN_TRANSIT", estimatedArrivalDate: days(13) }, days(20)),
    "YELLOW"
  ));

test("arrives 14 days before  →  YELLOW",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "IN_TRANSIT", estimatedArrivalDate: days(7) }, days(21)),
    "YELLOW"
  ));

test("PENDING with 10-day buffer  →  YELLOW",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "PENDING", estimatedArrivalDate: days(5) }, days(15)),
    "YELLOW"
  ));

// Cleared cases (null = no alert)
test("RECEIVED_COMPLETE  →  null (alert cleared)",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "RECEIVED_COMPLETE", estimatedArrivalDate: days(5) }, days(20)),
    null
  ));

test("RECEIVED_PARTIAL  →  null (alert cleared)",
  () => assert.strictEqual(
    computeRequirementAlertStatus({ status: "RECEIVED_PARTIAL", estimatedArrivalDate: days(5) }, days(20)),
    null
  ));

// ─── Preview modal badge mapping (actionStatus → display label) ───────────────
// The generate-orders modal uses actionStatus (already in the API response)
// to drive badge display. This avoids any simulation and works with any
// supplier lead time.
console.log("\n🗓️  Preview modal — actionStatus badge mapping");

import { calculateRequirementStatus } from "../lib/jit";

function previewBadge(
  productionDaysFromNow: number,
  daysToOrder: number,
  missingQty = 5,
  incomingQty = 0,
  bestDelivery: Date | null = null,
  safetyBuffer = 1
): "CRÍTICO" | "URGENTE" | "CON MARGEN" | null {
  // Frontend logic: CRÍTICO only if plan already overdue
  if (productionDaysFromNow < 0) return "CRÍTICO";
  const status = calculateRequirementStatus(
    missingQty, incomingQty, days(productionDaysFromNow), bestDelivery, daysToOrder, safetyBuffer
  );
  if (status === "ORDER_NOW") return "URGENTE";
  if (status === "ORDER_SOON") return "CON MARGEN";
  return null; // OK or COVERED — not in PEDIR list
}

test("August plan (84d), 7-day lead time  →  CON MARGEN",
  () => assert.strictEqual(previewBadge(84, 7), "CON MARGEN"));

test("August plan (84d), 90-day lead time  →  URGENTE (supplier takes longer than window)",
  () => assert.strictEqual(previewBadge(84, 90), "URGENTE"));

test("Plan in 14d, 7-day lead time  →  CON MARGEN (exactly at threshold: 14 > 7+1)",
  () => assert.strictEqual(previewBadge(14, 7), "CON MARGEN"));

test("Plan in 9d, 7-day lead time  →  CON MARGEN (9 > 7+1)",
  () => assert.strictEqual(previewBadge(9, 7), "CON MARGEN"));

test("Plan in 7d, 7-day lead time  →  URGENTE (7 ≤ 7+1)",
  () => assert.strictEqual(previewBadge(7, 7), "URGENTE"));

test("Plan in 3d, 7-day lead time  →  URGENTE",
  () => assert.strictEqual(previewBadge(3, 7), "URGENTE"));

test("Plan already past (-1d)  →  CRÍTICO (overdue)",
  () => assert.strictEqual(previewBadge(-1, 7), "CRÍTICO"));

test("Plan in 30d, 3-day lead time  →  CON MARGEN",
  () => assert.strictEqual(previewBadge(30, 3), "CON MARGEN"));

// ─── Summary ──────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${"─".repeat(50)}`);
console.log(`${total} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
