import assert from "node:assert/strict";
import test from "node:test";

import { normalizeStoreSlug } from "../lib/onboarding";


test("store slug normalization matches onboarding URL expectations", () => {
  assert.equal(normalizeStoreSlug("  Amar Fashion BD  "), "amar-fashion-bd");
  assert.equal(normalizeStoreSlug("Café & Home"), "cafe-home");
  assert.equal(normalizeStoreSlug("--Already--Clean--"), "already-clean");
});

test("store slug normalization caps future subdomain labels", () => {
  assert.equal(normalizeStoreSlug("a".repeat(100)).length, 63);
});
