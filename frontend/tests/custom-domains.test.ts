import assert from "node:assert/strict";
import test from "node:test";

import { domainStatusLabel, domainWizardStep, routingRecordSummary, type StoreDomain } from "../lib/store-domains";

const pending: StoreDomain = {
  id: "domain-1",
  hostname: "example.com",
  domain_type: "custom",
  status: "pending",
  is_primary: false,
  redirect_to_primary: false,
  verification_status: "pending",
  routing_status: "pending",
  ssl_status: "pending",
  verified_at: null,
  verification_token_expires_at: null,
  last_verification_attempt_at: null,
  last_routing_checked_at: null,
  verification_failure_reason: null,
  certificate_expires_at: null,
  dns_records: [
    { purpose: "ownership", record_type: "TXT", host: "_amar-verification", fqdn: "_amar-verification.example.com", value: "amar-verification=token" },
    { purpose: "routing", record_type: "ALIAS/ANAME", host: "@", fqdn: "example.com", value: "domains.amar-ecom.com" },
  ],
  can_make_primary: false,
  can_remove: true,
  storefront_url: "https://example.com",
};

test("domain wizard advances from ownership through TLS", () => {
  assert.equal(domainWizardStep(null), "domain");
  assert.equal(domainWizardStep(pending), "ownership");
  assert.equal(domainWizardStep({ ...pending, verification_status: "verified" }), "routing");
  assert.equal(domainWizardStep({ ...pending, verification_status: "verified", routing_status: "valid" }), "ssl");
  assert.equal(domainWizardStep({ ...pending, verification_status: "verified", routing_status: "valid", ssl_status: "active", status: "active" }), "connected");
});

test("DNS formatting exposes only routing records in summaries", () => {
  assert.deepEqual(routingRecordSummary(pending.dns_records), ["ALIAS/ANAME @ → domains.amar-ecom.com"]);
});

test("domain health labels are merchant-readable", () => {
  assert.equal(domainStatusLabel("not_required"), "Amar verified");
  assert.equal(domainStatusLabel("renewal_due"), "Renewal due");
  assert.equal(domainStatusLabel("active"), "Active");
});
