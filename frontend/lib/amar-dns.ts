export type DnsRecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "CAA" | "SRV" | "ALIAS";

export type DnsRecord = {
  id: string;
  record_type: DnsRecordType;
  name: string;
  content: string;
  ttl: number;
  priority: number | null;
  weight: number | null;
  port: number | null;
  disabled: boolean;
  managed_by: "merchant" | "amar_system";
  purpose: string | null;
  sync_status: "pending" | "synced" | "error";
  provider_error: string | null;
};

export type DnsZone = {
  id: string;
  store_domain_id: string;
  zone_name: string;
  status: string;
  provider: string;
  nameservers: string[];
  soa_serial: number;
  delegation_status: string;
  dnssec_status: string;
  dnssec_ds_records: Array<Record<string, string | number>>;
  sync_status: string;
  provider_error: string | null;
  last_synced_at: string | null;
  last_delegation_checked_at: string | null;
  activated_at: string | null;
  records: DnsRecord[];
  revisions: Array<{ id: string; revision_number: number; reason: string; created_at: string }>;
  health: {
    delegation: string;
    store_routing: string;
    dnssec: string;
    ssl: string;
    mail_records_present: boolean;
    caa_records_present: boolean;
  };
  editable: boolean;
};

export const DNS_RECORD_TYPES: DnsRecordType[] = ["A", "AAAA", "CNAME", "TXT", "MX", "CAA"];

export function dnsRecordDisplayValue(record: Pick<DnsRecord, "record_type" | "content" | "priority" | "weight" | "port">) {
  if (record.record_type === "MX") return `${record.priority ?? 0} ${record.content}`;
  if (record.record_type === "SRV") return `${record.priority ?? 0} ${record.weight ?? 0} ${record.port ?? 0} ${record.content}`;
  return record.content;
}

export function delegationMessage(status: string) {
  const labels: Record<string, string> = {
    pending: "Waiting for nameserver changes",
    partial: "Only some Amar nameservers are delegated",
    active: "Amar DNS is authoritative",
    incorrect: "Registrar nameservers do not match Amar",
    error: "Nameservers could not be checked",
  };
  return labels[status] || status.replace(/_/g, " ");
}

export function isLockedDnsRecord(record: Pick<DnsRecord, "managed_by">) {
  return record.managed_by === "amar_system";
}

export function validateDnsRecordDraft(record: { record_type: DnsRecordType; name: string; content: string; ttl: number; priority?: number | null }) {
  const errors: string[] = [];
  if (!record.name.trim()) errors.push("Record name is required");
  if (!record.content.trim()) errors.push("Record value is required");
  if (!Number.isInteger(record.ttl) || record.ttl < 60 || record.ttl > 86400) errors.push("TTL must be between 60 and 86400 seconds");
  if (record.record_type === "MX" && (record.priority === null || record.priority === undefined)) errors.push("MX priority is required");
  if (record.record_type === "CNAME" && record.name.trim() === "@") errors.push("Use Amar's managed apex routing instead of an apex CNAME");
  return errors;
}
