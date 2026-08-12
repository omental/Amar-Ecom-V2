import assert from "node:assert/strict";
import test from "node:test";

import { entitlementLimit, formatLimit, hasEntitlement, trialLabel, usagePercent, type CommercialSummary } from "../lib/commercial";

const summary: CommercialSummary = {
  store_id: "store-a",
  plan: { id: "plan", key: "growth", version: 1, name: "Growth", description: null, status: "active", sort_order: 1, is_public: true, monthly_price_display: null, annual_price_display: null, trial_days: 14, entitlements: {} },
  status: "trialing",
  trial: { started_at: "2026-08-01T00:00:00Z", ends_at: "2026-08-15T00:00:00Z", days_remaining: 3 },
  entitlements: { advanced_builder: true, product_limit: 500, theme_count_limit: null },
  usage: { product_limit: { feature: "product_limit", usage: 120, limit: 500, remaining: 380, over_limit: false } },
};

test("entitlement helpers do not compare plan names", () => {
  assert.equal(hasEntitlement(summary, "advanced_builder"), true);
  assert.equal(hasEntitlement({ ...summary, status: "expired" }, "advanced_builder"), false);
  assert.equal(entitlementLimit(summary, "product_limit"), 500);
  assert.equal(entitlementLimit(summary, "theme_count_limit"), null);
});

test("unlimited and usage values have stable presentation", () => {
  assert.equal(formatLimit(null), "Unlimited");
  assert.equal(usagePercent(summary.usage.product_limit), 24);
  assert.equal(usagePercent({ ...summary.usage.product_limit, usage: 9, limit: 5, over_limit: true }), 100);
});

test("trial state is backend-derived and displayed without client date math", () => {
  assert.equal(trialLabel(summary), "3 days left in your trial");
  assert.equal(trialLabel({ ...summary, status: "expired" }), "Trial expired");
});
