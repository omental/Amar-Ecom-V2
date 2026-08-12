import assert from "node:assert/strict";
import test from "node:test";

import { availableDynamicSources, evaluateCondition, resolveDynamicValue, sourceSupportsType, type DynamicResolutionContext, type DynamicSourceReference } from "../lib/storefront-dynamic";
import type { StoreProduct } from "../lib/storefront";

const product = { id: "p1", name: "Black Oxford", slug: "black-oxford", sku: "OX-1", price: "2400", sale_price: "1999", gallery: [], colors: [], sizes: [], support_notes: [], stock_status: "in_stock", is_demo_reference: false, is_active: true, is_public: true, variants: [], custom_fields: { "custom.material": "Cotton", "custom.designer": { model_key: "designer", entry_handle: "jane" } } } satisfies StoreProduct;
const context: DynamicResolutionContext = { store: { name: "Amar", currency: "BDT" }, product, contentEntries: { "designer:jane": { model_key: "designer", handle: "jane", values: { name: "Jane", portrait: "/jane.jpg" } } } };
const source = (path: string[], valueType: DynamicSourceReference["valueType"] = "string"): DynamicSourceReference => ({ root: "product", path, valueType });

test("resolves registered resource fields and safe fallbacks", () => {
  assert.equal(resolveDynamicValue({ kind: "dynamic", source: source(["name"]) }, context), "Black Oxford");
  assert.equal(resolveDynamicValue({ kind: "dynamic", source: source(["missing"]), fallback: "Fallback" }, context), "Fallback");
  assert.equal(resolveDynamicValue({ kind: "static", value: "Static" }, context), "Static");
});

test("resolves custom fields and nested content-entry references", () => {
  assert.equal(resolveDynamicValue({ kind: "dynamic", source: source(["custom_fields", "custom.material"]) }, context), "Cotton");
  assert.equal(resolveDynamicValue({ kind: "dynamic", source: source(["custom_fields", "custom.designer", "portrait"], "image") }, context), "/jane.jpg");
});

test("rejects unregistered and prototype paths", () => {
  assert.equal(resolveDynamicValue({ kind: "dynamic", source: source(["cost_price"]), fallback: "private" }, context), "private");
  assert.equal(resolveDynamicValue({ kind: "dynamic", source: source(["__proto__"]) }, context), undefined);
});

test("source compatibility and resource filtering are typed", () => {
  assert.equal(sourceSupportsType(source(["image"], "image"), ["image"]), true);
  assert.equal(sourceSupportsType(source(["price"], "money"), ["image"]), false);
  assert.ok(availableDynamicSources("product", ["string"]).some((item) => item.key === "product.title"));
  assert.equal(availableDynamicSources("not_found", ["string"]).some((item) => item.root === "product"), false);
});

test("conditions use structured comparisons without expressions", () => {
  assert.equal(evaluateCondition({ operator: "and", conditions: [{ source: source(["name"]), comparison: "contains", value: "Oxford" }, { source: source(["sale_price"], "money"), comparison: "less_than", value: 2000 }] }, context), true);
  assert.equal(evaluateCondition({ operator: "or", conditions: [{ source: source(["name"]), comparison: "equals", value: "Other" }] }, context), false);
});
