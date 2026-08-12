import assert from "node:assert/strict";
import test from "node:test";

import { annualSavings, billingStatusMessage, formatMoney, type BillingSummary, type PlanPrice } from "../lib/billing";

const price = (cycle: "monthly" | "annual", amount: string): PlanPrice => ({ id: cycle, plan_id: "plan", plan_key: "growth", plan_name: "Growth", key: `growth-${cycle}`, billing_cycle: cycle, currency: "BDT", amount });

test("billing helpers use price data rather than hardcoded savings", () => {
  assert.equal(annualSavings(price("monthly", "100"), price("annual", "1000")), 200);
  assert.match(formatMoney("2900", "BDT"), /2,900/);
});

test("billing status communicates grace and cancellation", () => {
  const summary: BillingSummary = { billing_account_id: "a", commercial_status: "active", subscription: { id: "s", plan_key: "growth", plan_version: 1, price_key: "p", billing_cycle: "monthly", status: "past_due", currency: "BDT", unit_amount: "2900", current_period_start: null, current_period_end: "2026-09-01T00:00:00Z", grace_ends_at: "2026-09-08T00:00:00Z", cancel_at_period_end: false, pending_price_id: null } };
  assert.match(billingStatusMessage(summary), /past due/i);
  assert.match(billingStatusMessage({ ...summary, subscription: { ...summary.subscription!, status: "active", cancel_at_period_end: true } }), /remains active/i);
});
