# Amar DNS control plane

Amar DNS is an authoritative DNS **control plane**. FastAPI stores tenant-safe desired state and talks to an authoritative provider; it does not answer DNS queries. Next.js only renders the dashboard. Production DNS queries must be served by specialized, redundant authoritative infrastructure.

## Architecture

`StoreDomain` remains the hostname-to-Store mapping used by the storefront. A verified custom `StoreDomain` may opt into one `DnsZone`. Apex and `www` StoreDomains normally share one apex zone; a verified subdomain may instead create an independently delegated subzone. `DnsRecord` stores desired records and their sync state. `DnsZoneRevision` records immutable snapshots after changes.

The provider-neutral boundary is `AuthoritativeDnsProvider`:

- `TestDnsProvider` is deterministic and is rejected outside development/test.
- `PowerDnsProvider` implements the PowerDNS Authoritative HTTP API contract.
- Provider credentials are environment secrets and are never tenant fields.

The database is desired state. A record change is validated and persisted, then the entire supported record set is reconciled to the provider. `sync_status`, `last_synced_at`, and a sanitized `provider_error` make failures visible and retryable. PowerDNS replacement also removes stale non-SOA/non-NS records so provider state converges. Provider-side drift detection is a future scheduled operational task; manual reconciliation exists now.

## Configuration

```env
DNS_PROVIDER=powerdns
DNS_PROVIDER_API_URL=http://powerdns-api.internal:8081
DNS_PROVIDER_API_KEY=secret-from-your-secret-manager
DNS_PROVIDER_SERVER_ID=localhost
DNS_NAMESERVERS=ns1.amardns.com,ns2.amardns.com
DNS_DEFAULT_TTL=3600
DNS_MIN_TTL=60
DNS_MAX_TTL=86400
DNS_MAX_RECORDS_PER_ZONE=500
DNS_DELEGATION_RECHECK_SECONDS=30
```

Never use `DNS_PROVIDER=test` in staging or production. The application refuses it outside development/test.

## Activation and delegation

The safe order is:

1. Verify ownership of the Phase 11 custom domain.
2. Create the provider zone and initial Amar Store routing records.
3. Import or manually reproduce existing MX, SPF, DKIM, DMARC, verification, and service records.
4. Review/export the prepared zone.
5. Change nameservers at the domain registrar.
6. Check delegation. All configured Amar nameservers must be present before the zone becomes active.

`pending`, `partial`, `active`, `incorrect`, and `error` distinguish delegation outcomes. A partial match never activates the zone. Amar DNS does not control the registration; the merchant retains their registrar account.

`ns1.amardns.com` and `ns2.amardns.com` are examples/configured identities, not DNS servers created by this repository. Their A/AAAA records must exist and their parent registrar may require glue. At least two independent authoritative endpoints are required.

## Records and safety

Merchant APIs support A, AAAA, CNAME, TXT, MX, CAA, and SRV. Amar uses a logical managed `ALIAS` for apex Store routing when the provider/edge supports flattening. Ordinary apex CNAME is rejected. CNAME coexistence conflicts, IP formats, target hostnames, MX/SRV fields, CAA syntax, TTL bounds, TXT size, zone record limits, and names are server-validated.

Only hostnames attached as StoreDomains receive `amar_system` routing records. Those records and authoritative NS/SOA behavior are read-only to merchants. Other records remain merchant-managed. Store routing reconciliation never deletes unrelated MX/TXT records.

BIND-style import supports the safe record subset. `$INCLUDE` and `$GENERATE` are rejected; the parser never opens referenced files or executes directives. Preview is required by the dashboard. Applying an import is additive/updating and preserves unmatched records, which protects mail configuration. Export produces a BIND-compatible representation; logical ALIAS entries are emitted as comments because portable BIND ALIAS syntax does not exist.

## Entitlements and migration away

Creating or mutating Amar DNS requires the Phase 8 `amar_dns` entitlement. Hosted Store domains and externally managed custom domains do not. If access expires or is downgraded, an existing authoritative zone continues serving. Mutations are frozen, but export, delegation visibility, and migration-away remain available. DNS is never turned off automatically because of a billing failure.

Deactivation marks a retained migration state; it does not immediately delete the provider zone. The merchant should export records, establish the replacement DNS provider, change registrar nameservers, verify cutover, and then use a future platform retention workflow for destructive removal.

## DNSSEC and certificates

The schema and provider contract support DNSSEC states and DS metadata. The deterministic test provider exercises signing and `ds_required`; a zone is not marked active until the expected DS digest is observed at the parent. PowerDNS DNSSEC automation is deliberately disabled until deployment-specific key policy and parent-DS operations are configured. Incorrect DS records can make a domain unreachable, so enablement requires explicit merchant action.

Amar-controlled zones make future ACME DNS-01 possible. The existing Phase 11 `CertificateProvider` remains the TLS orchestration boundary. A future adapter may create ephemeral `_acme-challenge` system TXT records via `DnsService`, reconcile them, complete issuance, and remove them. This phase does not move TLS private keys into the application database or claim DNS-01 issuance is deployed.

## Production topology

A serious deployment requires:

- two or more authoritative endpoints, preferably geographically and failure-domain diverse;
- NS host A/AAAA records and registrar glue where required;
- a private/firewalled or strongly authenticated PowerDNS/provider API reachable by the Amar backend only;
- database and provider-zone backups;
- monitoring for provider/API health, authoritative UDP/TCP 53 reachability, delegation, sync failures, and DNSSEC expiry/state;
- controlled provider credentials in a secret manager;
- firewall rules allowing public UDP/TCP 53 only to authoritative servers, not the control-plane API;
- capacity, DDoS protection, and eventually Anycast for production scale.

Do not expose the PowerDNS API to merchant browsers. Do not ingest every DNS query by default; query analytics is a separate privacy and retention product.

## Backup and disaster recovery

Back up both the Amar PostgreSQL desired state and the authoritative provider's native data/configuration. A recovery procedure should:

1. restore Amar's database;
2. restore or recreate provider zones;
3. reconcile every desired zone through the provider adapter;
4. query the configured authoritative nameservers directly;
5. verify public parent delegation;
6. verify Store routing and custom-domain TLS.

The database alone is not proof that live authoritative DNS is healthy.

## What is not deployed by this repository

No authoritative server, nameserver IP, registrar glue, Anycast network, production DNSSEC key policy, durable health scheduler, or live domain delegation is created automatically. Those are infrastructure/operator responsibilities. Domain registration, registrar transfers, recursive DNS, email hosting, and public DNS query analytics are outside Phase 12.
