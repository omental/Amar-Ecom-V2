import assert from "node:assert/strict";
import test from "node:test";

import {
  getCanonicalStorefrontUrl,
  getHostedStorefrontUrl,
  getStorefrontCartNamespace,
  normalizeStorefrontHostname,
} from "../lib/storefront-domain";


test("storefront hostname normalization is strict", () => {
  assert.equal(normalizeStorefrontHostname("FASHION.AMAR-ECOM.COM."), "fashion.amar-ecom.com");
  assert.equal(normalizeStorefrontHostname("fashion.localhost:3000"), "fashion.localhost");
  assert.throws(() => normalizeStorefrontHostname("https://fashion.amar-ecom.com"));
  assert.throws(() => normalizeStorefrontHostname("fashion..amar-ecom.com"));
});

test("hosted URLs and canonical resource URLs are centralized", () => {
  assert.equal(getHostedStorefrontUrl("fashion-house"), "http://fashion-house.localhost:3000");
  assert.equal(getCanonicalStorefrontUrl("fashion.localhost:3000", "/products/black-shirt"), "http://fashion.localhost/products/black-shirt");
});

test("cart namespaces vary by hosted Store", () => {
  assert.notEqual(getStorefrontCartNamespace("store-a.localhost:3000"), getStorefrontCartNamespace("store-b.localhost:3000"));
  assert.equal(getStorefrontCartNamespace("STORE-A.LOCALHOST:3000"), "amar_storefront_cart:store-a.localhost:3000");
});
