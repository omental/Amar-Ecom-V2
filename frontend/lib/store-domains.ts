export type DNSInstruction = {
  purpose: "ownership" | "routing";
  record_type: string;
  host: string;
  fqdn: string;
  value: string;
};

export type StoreDomain = {
  id: string;
  hostname: string;
  domain_type: "platform_subdomain" | "custom";
  status: "pending" | "active" | "disabled" | "error";
  is_primary: boolean;
  redirect_to_primary: boolean;
  verification_status: string;
  routing_status: string;
  ssl_status: string;
  verified_at: string | null;
  verification_token_expires_at: string | null;
  last_verification_attempt_at: string | null;
  last_routing_checked_at: string | null;
  verification_failure_reason: string | null;
  certificate_expires_at: string | null;
  dns_records: DNSInstruction[];
  can_make_primary: boolean;
  can_remove: boolean;
  storefront_url: string;
};

export type DomainWizardStep = "domain" | "ownership" | "routing" | "ssl" | "connected";

export function domainWizardStep(domain: StoreDomain | null): DomainWizardStep {
  if (!domain) return "domain";
  if (domain.verification_status !== "verified") return "ownership";
  if (domain.routing_status !== "valid") return "routing";
  if (domain.ssl_status !== "active") return "ssl";
  return "connected";
}

export function domainStatusLabel(value: string) {
  const labels: Record<string, string> = {
    not_required: "Amar verified",
    valid: "Correct",
    invalid: "Needs attention",
    provisioning: "Provisioning",
    renewal_due: "Renewal due",
  };
  return labels[value] || value.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase());
}

export function routingRecordSummary(records: DNSInstruction[]) {
  return records.filter((record) => record.purpose === "routing").map((record) => `${record.record_type} ${record.host} → ${record.value}`);
}
