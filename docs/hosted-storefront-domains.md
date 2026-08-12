# Hosted storefront domains

`StoreDomain` is the only public hostname-to-Store authority. The request path is `Host -> StoreDomain -> Store -> published Theme -> Template -> Resource`; production has no primary-Store fallback.

## Application configuration

- `STOREFRONT_BASE_DOMAIN=amar-ecom.com`
- `STOREFRONT_PUBLIC_SCHEME=https`
- `STOREFRONT_WILDCARD_TLS_ACTIVE=true` only after wildcard TLS is deployed and verified
- `STOREFRONT_INTERNAL_SECRET=<shared random secret>` on both FastAPI and the Next.js server for signed server-to-server hostname forwarding
- `STOREFRONT_TRUSTED_PROXY_IPS=<comma-separated ingress IPs>`; forwarded host headers are ignored unless the direct peer is configured
- `AMAR_BACKEND_ORIGIN=http://backend:8000` on Next.js for the same-origin `/api/v1/*` rewrite
- `AMAR_INTERNAL_API_BASE_URL=http://backend:8000/api/v1` on Next.js for server rendering

The internal secret must not use the development fallback in production. Browsers use same-origin `/api/v1` requests; they cannot select a Store with an arbitrary Store ID/header.

## DNS and TLS

Create one provider-neutral wildcard DNS record:

```text
*.amar-ecom.com  CNAME/ALIAS  <storefront ingress>
```

The apex/root and platform hosts (`www`, `api`, `app`, `dashboard`, health ingress) must be routed separately. Terminate HTTPS at the CDN/load balancer/ingress with a wildcard certificate for `*.amar-ecom.com`; include a separate apex certificate when the root is served. Preserve the original `Host` to Next.js and FastAPI. CDN cache keys must include `Host`.

Do not issue one certificate per Amar-hosted Store. Phase 11 custom domains reuse `StoreDomain`; see [custom-domains-and-ssl.md](custom-domains-and-ssl.md) for ownership verification, routing health, certificate-provider integration, and primary-domain aliases.

## Local development

Modern browsers resolve `*.localhost` locally. Run the frontend on port 3000 and backend on port 8000, then open `http://<store-slug>.localhost:3000`. Next.js proxies `/api/v1` to FastAPI while retaining the Store request context. Persistent domain rows continue to use the production base domain; the resolver maps only local development aliases to those authoritative rows.

## Proxy trust and failure policy

`Host` is parsed and normalized as untrusted input. `X-Forwarded-Host` is accepted only from configured trusted peers. A Next.js SSR hostname header is accepted only with the shared internal secret. Unknown, malformed, root, reserved, inactive Store, and inactive domain hosts fail with a generic 404. Health endpoints do not require Store resolution.

DNS records, wildcard certificates, CDN configuration, and external reachability are infrastructure responsibilities and must be verified in the target deployment; setting an application status does not prove TLS exists.
