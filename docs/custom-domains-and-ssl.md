# Custom domains and SSL

Phase 11 connects merchant-managed DNS to the same `StoreDomain -> Store -> published theme` resolver used by Amar-hosted subdomains. There is no custom-domain renderer and no browser-supplied Store ID.

## Lifecycle

1. A tenant-authorized merchant with the `custom_domain` entitlement submits a hostname only.
2. Amar normalizes it with IDNA and validates it against the Public Suffix List. IP literals, public suffixes, local names, URLs, wildcard names, and every `*.amar-ecom.com` name are rejected.
3. Amar creates a globally unique, pending `StoreDomain` and a cryptographically random verification token. The token hash is stored for comparison; the display copy is encrypted with the application secret infrastructure.
4. The merchant publishes the TXT ownership record and the routing record shown by the Domains screen.
5. `DomainVerificationService` performs bounded DNS-only lookups. Ownership and routing are independent health states.
6. Only verified domains routed to the configured Amar ingress are submitted to the configured `CertificateProvider`.
7. A domain becomes `active` only when ownership is verified, routing is valid, and TLS is active.
8. The merchant may atomically make that domain primary. Existing active aliases, including the mandatory hosted subdomain, receive `redirect_to_primary=true`.

Verification is manually rechecked in this phase. The persisted timestamps and provider interfaces are the boundary for a future durable health/renewal scheduler.

## DNS configuration

Configure a stable ingress name:

```env
CUSTOM_DOMAIN_CNAME_TARGET=domains.amar-ecom.com
```

Subdomains use CNAME:

```text
shop.example.com CNAME domains.amar-ecom.com
```

Apex domains cannot universally use an ordinary CNAME. Amar displays an ALIAS/ANAME or provider-flattening target. If the ingress has stable public addresses, configure them as comma-separated values and the UI will also display A/AAAA alternatives:

```env
CUSTOM_DOMAIN_IPV4_TARGETS=<public IPv4 ingress addresses>
CUSTOM_DOMAIN_IPV6_TARGETS=<public IPv6 ingress addresses>
```

Every custom hostname gets its own ownership record:

```text
_amar-verification.example.com TXT amar-verification=<random token>
```

The application rejects private, loopback, link-local, and other non-public answers as routing proof. The DNS resolver never performs an HTTP request to a merchant-controlled URL. Timeouts are controlled by `DNS_RESOLVER_TIMEOUT_SECONDS`, and merchant rechecks are throttled by `DOMAIN_VERIFICATION_RECHECK_SECONDS`.

## Ingress and Host preservation

Both `*.amar-ecom.com` and `CUSTOM_DOMAIN_CNAME_TARGET` must reach the same Next.js storefront ingress. The ingress must preserve the original `Host`; FastAPI trusts forwarded host data only from `STOREFRONT_TRUSTED_PROXY_IPS`. The same-origin Next.js API proxy signs the resolved host with `STOREFRONT_INTERNAL_SECRET`.

Do not enable credentialed wildcard CORS for custom domains. Public storefront browser calls remain same-origin and are proxied server-side.

Aliases are redirected by Next.js `proxy.ts` before storefront rendering. A 308 redirect preserves the path and query. The resolver response supplies the persisted primary canonical origin; loop checks prevent primary-to-itself redirects.

## TLS and certificate providers

TLS terminates at the edge/load balancer/CDN, not inside FastAPI or React rendering. The application stores only provider references and normalized status/expiry metadata in `StoreDomainCertificate`; it does not store certificate private keys.

```env
CERTIFICATE_PROVIDER=external
```

`external` records a provisioning request for integration with the deployed edge certificate manager. `test` is a deterministic adapter for development and automated tests only; configuration rejects it outside `development`/`test`.

The provider contract supports request, status, and revoke. Requests are idempotent for ordinary DNS rechecks. An explicit retry after a failed order creates a new attempt. Provider-managed automatic renewal can synchronize `issued_at`, `expires_at`, and status later. No production certificate manager or renewal scheduler is claimed by this repository alone.

For an ACME deployment, HTTP-01 is appropriate after routing is valid. DNS-01 is not assumed because Amar does not control external merchant DNS in Phase 11.

## Removal and rollback

- The Amar-hosted domain cannot be deleted.
- A primary custom domain must first be replaced as primary.
- Removing a non-primary custom domain revokes/cleans its certificate association before releasing the globally unique hostname.
- A newly attached hostname must always complete a fresh ownership verification, preventing stale association takeover.
- A custom-domain entitlement downgrade blocks new attachments but preserves existing working domains and merchant data.
- If custom TLS fails, the hosted Amar subdomain remains attached and usable.

## Troubleshooting

- **TXT record not found:** confirm the full record name and value; some DNS panels automatically append the zone name.
- **Routing incorrect:** confirm CNAME/ALIAS/A/AAAA points to the configured Amar ingress and remove conflicting records.
- **Private target rejected:** production routing must resolve to public ingress addresses.
- **SSL provisioning failed:** correct DNS first, then use Retry SSL. Platform operators can inspect and retry through platform-authorized service endpoints.
- **DNS appears unchanged:** wait according to the DNS provider's TTL and retry; Amar does not promise a fixed propagation time.

Amar DNS, nameserver delegation, domain registration, registrar integration, email DNS, and production certificate-provider credentials remain later infrastructure phases.
