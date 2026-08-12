"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Download, ExternalLink, Globe2, Loader2, LockKeyhole, Pencil, Plus, RefreshCw, Server, ShieldCheck, Trash2, Upload } from "lucide-react";

import { useEntitlements } from "@/components/dashboard/entitlement-provider";
import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { api, getErrorMessage } from "@/lib/api";
import { DNS_RECORD_TYPES, delegationMessage, dnsRecordDisplayValue, isLockedDnsRecord, validateDnsRecordDraft, type DnsRecordType, type DnsZone } from "@/lib/amar-dns";
import { domainStatusLabel, domainWizardStep, type StoreDomain } from "@/lib/store-domains";

export default function StoreDomainsPage() {
  const { can, loading: entitlementsLoading } = useEntitlements();
  const [domains, setDomains] = useState<StoreDomain[]>([]);
  const [hostname, setHostname] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setDomains(await api.get<StoreDomain[]>("/admin/storefront/domains"));
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.get<StoreDomain[]>("/admin/storefront/domains").then(
      (value) => { if (active) setDomains(value); },
      (cause) => { if (active) setError(getErrorMessage(cause)); },
    );
    return () => { active = false; };
  }, []);

  async function action(domain: StoreDomain, suffix: string, method: "post" | "delete" = "post") {
    setBusy(`${domain.id}:${suffix}`);
    setError("");
    try {
      if (method === "delete") await api.delete(`/admin/storefront/domains/${domain.id}`);
      else await api.post(`/admin/storefront/domains/${domain.id}/${suffix}`);
      await load();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy("");
    }
  }

  async function connect() {
    if (!hostname.trim()) return;
    setBusy("connect");
    setError("");
    try {
      await api.post<StoreDomain>("/admin/storefront/domains", { hostname });
      setHostname("");
      setConnecting(false);
      await load();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy("");
    }
  }

  const customDomains = domains.filter((domain) => domain.domain_type === "custom");

  return (
    <div className="space-y-6">
      <OnlineStoreTabs />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--color-accent)]">Online Store</p>
          <h1 className="mt-1 text-3xl font-semibold text-[var(--color-txt-pri)]">Domains</h1>
          <p className="mt-2 text-sm text-[var(--color-txt-sec)]">Connect an existing domain without changing your storefront architecture.</p>
        </div>
        {!entitlementsLoading && can("custom_domain") ? (
          <button onClick={() => setConnecting((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Connect Domain</button>
        ) : (
          <a href="/dashboard/plan" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"><LockKeyhole className="h-4 w-4" /> Compare plans</a>
        )}
      </header>

      {connecting ? (
        <section className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-6 shadow-[var(--shadow-subtle)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">Step 1 · Domain</p>
          <h2 className="mt-2 text-xl font-semibold">Enter a domain you already own</h2>
          <p className="mt-1 text-sm text-[var(--color-txt-sec)]">Enter only the hostname, such as example.com or www.example.com. Amar will provide DNS instructions next.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="example.com" className="min-w-0 flex-1 rounded-xl border bg-transparent px-4 py-3 outline-none focus:border-[var(--color-accent)]" />
            <button disabled={busy === "connect" || !hostname.trim()} onClick={() => void connect()} className="rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "connect" ? "Connecting…" : "Continue"}</button>
          </div>
        </section>
      ) : null}

      {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {domains.map((domain) => (
        <DomainCard key={domain.id} domain={domain} busy={busy.startsWith(domain.id)} canUseAmarDns={!entitlementsLoading && can("amar_dns")} onAction={action} />
      ))}

      {!error && domains.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-[var(--color-txt-sec)]">Loading your domains…</div> : null}
      {!entitlementsLoading && !can("custom_domain") && customDomains.length > 0 ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Your existing custom domain remains online after a downgrade. Connecting additional domains is locked until access is restored.</p> : null}
    </div>
  );
}

function DomainCard({ domain, busy, canUseAmarDns, onAction }: { domain: StoreDomain; busy: boolean; canUseAmarDns: boolean; onAction: (domain: StoreDomain, suffix: string, method?: "post" | "delete") => Promise<void> }) {
  const custom = domain.domain_type === "custom";
  const step = domainWizardStep(custom ? domain : null);
  const [showDns, setShowDns] = useState(false);
  return (
    <section className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-6 shadow-[var(--shadow-subtle)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Globe2 className="h-6 w-6" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{domain.hostname}</h2>{domain.is_primary ? <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">Primary</span> : null}</div>
            <p className="mt-1 text-sm text-[var(--color-txt-sec)]">{custom ? `Custom domain · ${domainStatusLabel(step)}` : "Amar Hosted · permanent Store identity"}{domain.redirect_to_primary ? " · Redirects to primary" : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigator.clipboard.writeText(domain.storefront_url)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><Copy className="h-4 w-4" /> Copy URL</button>
          {custom && (domain.verification_status !== "verified" || domain.routing_status !== "valid") ? <ActionButton busy={busy} onClick={() => onAction(domain, "check")} icon={<RefreshCw className="h-4 w-4" />} label="Check DNS" /> : null}
          {custom && domain.ssl_status === "failed" ? <ActionButton busy={busy} onClick={() => onAction(domain, "retry-ssl")} icon={<RefreshCw className="h-4 w-4" />} label="Retry SSL" /> : null}
          {custom && domain.verification_status === "verified" ? <button onClick={() => setShowDns((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><Server className="h-4 w-4" /> {showDns ? "Hide DNS" : "DNS"}</button> : null}
          {domain.can_make_primary ? <ActionButton busy={busy} onClick={() => onAction(domain, "make-primary")} icon={<ShieldCheck className="h-4 w-4" />} label="Make Primary" /> : null}
          {domain.can_remove ? <ActionButton busy={busy} onClick={() => onAction(domain, "", "delete")} icon={<Trash2 className="h-4 w-4" />} label="Remove" /> : null}
          {domain.status === "active" ? <a href={domain.storefront_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Open <ExternalLink className="h-4 w-4" /></a> : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Status icon={<CheckCircle2 className="h-4 w-4" />} label="Domain" value={domain.status} />
        <Status icon={<ShieldCheck className="h-4 w-4" />} label="Ownership" value={domain.verification_status} />
        <Status icon={<Globe2 className="h-4 w-4" />} label="Routing" value={domain.routing_status} />
        <Status icon={<ShieldCheck className="h-4 w-4" />} label="SSL" value={domain.ssl_status} />
      </div>

      {custom && domain.dns_records.length > 0 && domain.status !== "active" ? (
        <div className="mt-6 border-t border-[var(--color-brd)] pt-6">
          <h3 className="font-semibold">DNS records</h3>
          <p className="mt-1 text-sm text-[var(--color-txt-sec)]">Add these records at your DNS provider. Changes may take time depending on your provider and TTL.</p>
          <div className="mt-4 space-y-3">{domain.dns_records.map((record, index) => <DNSRecord key={`${record.purpose}-${record.record_type}-${index}`} record={record} />)}</div>
          {domain.verification_failure_reason ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{domain.verification_failure_reason}</p> : null}
        </div>
      ) : null}
      {showDns ? <AmarDnsPanel domain={domain} entitled={canUseAmarDns} /> : null}
    </section>
  );
}

function AmarDnsPanel({ domain, entitled }: { domain: StoreDomain; entitled: boolean }) {
  const [zone, setZone] = useState<DnsZone | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [record, setRecord] = useState<{ record_type: DnsRecordType; name: string; content: string; ttl: number; priority: number | null }>({ record_type: "A", name: "", content: "", ttl: 3600, priority: null });
  const [zoneFile, setZoneFile] = useState("");
  const [importPreview, setImportPreview] = useState<{ records: unknown[]; warnings: string[]; unsupported: string[] } | null>(null);

  const load = useCallback(async () => {
    try {
      setZone(await api.get<DnsZone | null>(`/admin/storefront/domains/${domain.id}/dns`));
      setError("");
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoaded(true);
    }
  }, [domain.id]);

  useEffect(() => {
    let active = true;
    api.get<DnsZone | null>(`/admin/storefront/domains/${domain.id}/dns`).then(
      (value) => { if (active) { setZone(value); setLoaded(true); } },
      (cause) => { if (active) { setError(getErrorMessage(cause)); setLoaded(true); } },
    );
    return () => { active = false; };
  }, [domain.id]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      await action();
      await load();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy("");
    }
  }

  async function createZone() {
    await run("create-zone", () => api.post(`/admin/storefront/domains/${domain.id}/dns`, {}));
  }

  async function addRecord() {
    if (!zone) return;
    const errors = validateDnsRecordDraft(record);
    if (errors.length) { setError(errors.join(". ")); return; }
    await run("add-record", () => api.post(`/admin/storefront/dns/zones/${zone.id}/records`, record));
    setRecord({ record_type: "A", name: "", content: "", ttl: 3600, priority: null });
  }

  async function previewImport() {
    if (!zone) return;
    setBusy("preview-import");
    try {
      setImportPreview(await api.post(`/admin/storefront/dns/zones/${zone.id}/import/preview`, { zone_file: zoneFile }));
      setError("");
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(""); }
  }

  async function downloadZone() {
    if (!zone) return;
    const blob = await api.download(`/admin/storefront/dns/zones/${zone.id}/export`);
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${zone.zone_name}.zone`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function editRecord(item: DnsZone["records"][number]) {
    if (!zone) return;
    const content = window.prompt(`Update ${item.record_type} ${item.name}`, item.content);
    if (content === null || content.trim() === item.content) return;
    await run(`edit:${item.id}`, () => api.patch(`/admin/storefront/dns/zones/${zone.id}/records/${item.id}`, { content }));
  }

  async function removeRecord(item: DnsZone["records"][number]) {
    if (!zone) return;
    const risk = item.record_type === "MX" ? " This may interrupt email delivery." : item.record_type === "CAA" ? " This may affect certificate issuance." : "";
    if (!window.confirm(`Delete ${item.record_type} ${item.name}?${risk}`)) return;
    await run(`delete:${item.id}`, () => api.delete(`/admin/storefront/dns/zones/${zone.id}/records/${item.id}`));
  }

  if (!loaded) return <div className="mt-6 border-t pt-6 text-sm text-[var(--color-txt-sec)]">Loading DNS control plane…</div>;
  if (!zone) return <div className="mt-6 border-t border-[var(--color-brd)] pt-6">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Changing nameservers changes all DNS</p><p className="mt-1">Import mail, verification, and third-party records before switching at your registrar. Amar creates the authoritative zone first; your external DNS remains live until delegation changes.</p></div></div></div>
    <div className="mt-4 flex items-center justify-between gap-4"><div><h3 className="font-semibold">Current DNS: External</h3><p className="text-sm text-[var(--color-txt-sec)]">Use Amar DNS to manage this domain from your dashboard.</p></div>{entitled ? <button disabled={busy === "create-zone"} onClick={() => void createZone()} className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "create-zone" ? "Preparing…" : "Use Amar DNS"}</button> : <a href="/dashboard/plan" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"><LockKeyhole className="h-4 w-4" /> Amar DNS plan</a>}</div>
    {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
  </div>;

  return <div className="mt-6 space-y-5 border-t border-[var(--color-brd)] pt-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">Amar DNS control plane</p><h3 className="mt-1 text-xl font-semibold">{zone.zone_name}</h3><p className="mt-1 text-sm text-[var(--color-txt-sec)]">{delegationMessage(zone.delegation_status)} · Provider sync {zone.sync_status}</p></div><div className="flex gap-2"><button onClick={() => void downloadZone()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><Download className="h-4 w-4" /> Export</button><button disabled={Boolean(busy)} onClick={() => void run("delegation", () => api.post(`/admin/storefront/dns/zones/${zone.id}/check-delegation`))} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Check Nameservers</button></div></div>
    {!entitled ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This existing zone continues serving safely after a downgrade. Record changes are locked, while export and migration remain available.</div> : null}
    {zone.provider_error ? <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Provider sync needs attention: {zone.provider_error}</div> : null}
    {error ? <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

    <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[var(--color-bg)] p-4"><p className="text-xs font-semibold uppercase text-[var(--color-txt-sec)]">Nameservers</p>{zone.nameservers.map((nameserver) => <button key={nameserver} onClick={() => navigator.clipboard.writeText(nameserver)} className="mt-2 flex items-center gap-2 font-mono text-sm"><span>{nameserver}</span><Copy className="h-3.5 w-3.5" /></button>)}</div><div className="grid grid-cols-2 gap-3"><Status icon={<Globe2 className="h-4 w-4" />} label="Delegation" value={zone.delegation_status} /><Status icon={<ShieldCheck className="h-4 w-4" />} label="DNSSEC" value={zone.dnssec_status} /></div></div>

    <div><div className="flex items-center justify-between"><div><h4 className="font-semibold">DNS Records</h4><p className="text-sm text-[var(--color-txt-sec)]">Amar-managed Store routing is locked. Mail and other merchant records remain independent.</p></div></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase text-[var(--color-txt-sec)]"><tr><th className="pb-3">Type</th><th className="pb-3">Name</th><th className="pb-3">Value</th><th className="pb-3">TTL</th><th className="pb-3">Status</th><th className="pb-3">Managed by</th><th className="pb-3"></th></tr></thead><tbody>{zone.records.map((item) => <tr key={item.id} className="border-t border-[var(--color-brd)]"><td className="py-3 font-mono font-semibold">{item.record_type}</td><td className="py-3 font-mono">{item.name}</td><td className="max-w-[280px] truncate py-3 font-mono">{dnsRecordDisplayValue(item)}</td><td className="py-3">{item.ttl}</td><td className="py-3">{item.sync_status}</td><td className="py-3">{isLockedDnsRecord(item) ? <span className="inline-flex items-center gap-1"><LockKeyhole className="h-3.5 w-3.5" /> Amar</span> : "Merchant"}</td><td className="py-3 text-right">{!isLockedDnsRecord(item) && zone.editable ? <span className="inline-flex"><button onClick={() => void editRecord(item)} className="rounded-lg p-2" aria-label={`Edit ${item.record_type} ${item.name}`}><Pencil className="h-4 w-4" /></button><button onClick={() => void removeRecord(item)} className="rounded-lg p-2 text-red-600" aria-label={`Delete ${item.record_type} ${item.name}`}><Trash2 className="h-4 w-4" /></button></span> : null}</td></tr>)}</tbody></table></div></div>

    {zone.editable ? <div className="rounded-2xl bg-[var(--color-bg)] p-4"><h4 className="font-semibold">Add record</h4><div className="mt-3 grid gap-3 md:grid-cols-[100px_1fr_2fr_110px_100px_auto]"><select value={record.record_type} onChange={(event) => setRecord((value) => ({ ...value, record_type: event.target.value as DnsRecordType }))} className="rounded-xl border bg-transparent px-3 py-2">{DNS_RECORD_TYPES.map((kind) => <option key={kind}>{kind}</option>)}</select><input value={record.name} onChange={(event) => setRecord((value) => ({ ...value, name: event.target.value }))} placeholder="@ or name" className="rounded-xl border bg-transparent px-3 py-2" /><input value={record.content} onChange={(event) => setRecord((value) => ({ ...value, content: event.target.value }))} placeholder="Value" className="rounded-xl border bg-transparent px-3 py-2" /><input type="number" value={record.ttl} onChange={(event) => setRecord((value) => ({ ...value, ttl: Number(event.target.value) }))} className="rounded-xl border bg-transparent px-3 py-2" />{record.record_type === "MX" ? <input type="number" value={record.priority ?? ""} onChange={(event) => setRecord((value) => ({ ...value, priority: event.target.value ? Number(event.target.value) : null }))} placeholder="Priority" className="rounded-xl border bg-transparent px-3 py-2" /> : <span /> }<button disabled={busy === "add-record"} onClick={() => void addRecord()} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button></div></div> : null}

    {zone.editable ? <details className="rounded-2xl border border-[var(--color-brd)] p-4"><summary className="cursor-pointer font-semibold">Import existing BIND zone file</summary><p className="mt-2 text-sm text-[var(--color-txt-sec)]">Preview is required. Amar rejects include/generate directives and preserves unrelated existing records.</p><textarea value={zoneFile} onChange={(event) => { setZoneFile(event.target.value); setImportPreview(null); }} rows={7} placeholder={`$ORIGIN ${zone.zone_name}.\n@ 3600 IN MX 10 mail.example.com.`} className="mt-3 w-full rounded-xl border bg-transparent p-3 font-mono text-sm" /><div className="mt-3 flex gap-2"><button disabled={!zoneFile.trim() || busy === "preview-import"} onClick={() => void previewImport()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"><Upload className="h-4 w-4" /> Preview</button>{importPreview ? <button onClick={() => void run("apply-import", () => api.post(`/admin/storefront/dns/zones/${zone.id}/import`, { zone_file: zoneFile }))} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Apply {importPreview.records.length} records</button> : null}</div>{importPreview ? <p className="mt-3 text-sm text-[var(--color-txt-sec)]">{importPreview.records.length} supported · {importPreview.unsupported.length} skipped · {importPreview.warnings.length} warnings</p> : null}</details> : null}
  </div>;
}

function DNSRecord({ record }: { record: StoreDomain["dns_records"][number] }) {
  return <div className="grid gap-3 rounded-2xl bg-[var(--color-bg)] p-4 sm:grid-cols-[120px_1fr_2fr]">
    <div><p className="text-xs uppercase text-[var(--color-txt-sec)]">Type</p><p className="mt-1 font-mono text-sm font-semibold">{record.record_type}</p></div>
    <CopyValue label="Host" value={record.host} />
    <CopyValue label="Value" value={record.value} />
  </div>;
}

function CopyValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs uppercase text-[var(--color-txt-sec)]">{label}</p><button onClick={() => navigator.clipboard.writeText(value)} className="mt-1 flex max-w-full items-center gap-2 text-left font-mono text-sm"><span className="truncate">{value}</span><Copy className="h-3.5 w-3.5 shrink-0" /></button></div>;
}

function ActionButton({ busy, onClick, icon, label }: { busy: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button disabled={busy} onClick={onClick} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{label}</button>;
}

function Status({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl bg-[var(--color-bg)] p-4"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-txt-sec)]">{icon}{label}</span><p className="mt-2 text-sm font-semibold text-[var(--color-txt-pri)]">{domainStatusLabel(value)}</p></div>;
}
