import assert from "node:assert/strict";
import test from "node:test";

import { delegationMessage, dnsRecordDisplayValue, isLockedDnsRecord, validateDnsRecordDraft } from "../lib/amar-dns";

test("Amar DNS record formatting preserves typed fields", () => {
  assert.equal(dnsRecordDisplayValue({ record_type: "MX", content: "mail.example.com", priority: 10, weight: null, port: null }), "10 mail.example.com");
  assert.equal(dnsRecordDisplayValue({ record_type: "SRV", content: "sip.example.com", priority: 5, weight: 10, port: 5060 }), "5 10 5060 sip.example.com");
});

test("delegation and system-record helpers are merchant readable", () => {
  assert.equal(delegationMessage("partial"), "Only some Amar nameservers are delegated");
  assert.equal(delegationMessage("active"), "Amar DNS is authoritative");
  assert.equal(isLockedDnsRecord({ managed_by: "amar_system" }), true);
  assert.equal(isLockedDnsRecord({ managed_by: "merchant" }), false);
});

test("record draft validation catches apex CNAME and unsafe TTL", () => {
  assert.deepEqual(validateDnsRecordDraft({ record_type: "CNAME", name: "@", content: "target.example.com", ttl: 30 }), [
    "TTL must be between 60 and 86400 seconds",
    "Use Amar's managed apex routing instead of an apex CNAME",
  ]);
  assert.deepEqual(validateDnsRecordDraft({ record_type: "MX", name: "@", content: "mail.example.com", ttl: 3600, priority: null }), ["MX priority is required"]);
});
