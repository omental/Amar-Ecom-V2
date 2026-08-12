# Deterministic full-platform demo seed

Phase 15.5A provides two stable, fictional businesses for development, functional QA, AI grounding checks, and tenant-isolation testing. The fixture is authoritative rather than random: running it again restores the same logical scenario.

## Safety boundary

The command runs only when `APP_ENV` is `development` or `test`. It refuses production and unknown environments. It recognizes its tenants by both stable UUIDv5 identifiers and reserved demo slugs; a slug/UUID mismatch stops the run.

Reset never truncates shared tables. It deletes Store-owned rows only for the two manifest Store UUIDs, then deletes only their known memberships, Organizations, billing accounts, and fixture users. Unrelated Stores, users, products, and media are outside its deletion predicate.

The seed does not call email, checkout, billing, courier, Meta, DNS, certificate, or AI providers. Provider-facing states use the existing deterministic test-provider boundaries and are labeled as simulated.

## Commands

Run from `backend`:

```bash
venv/bin/python scripts/seed_demo_platform.py
venv/bin/python scripts/seed_demo_platform.py --reset
venv/bin/python scripts/seed_demo_platform.py --verify
```

`--verify` is read-only and exits non-zero when a canonical fact differs. Normal seed and explicit reset both reconcile the two demo tenants to the manifest; `--reset` makes that destructive intent visible at the call site.

The local-only default password is `AmarDemo!2026`. Override it with a password of at least 12 characters:

```bash
AMAR_DEMO_PASSWORD='choose-a-local-demo-password' venv/bin/python scripts/seed_demo_platform.py --reset
```

The CLI deliberately does not print the password.

## Demo businesses and users

Urban Thread Group Ltd. owns the primary Store `urban-thread-demo` (Urban Thread BD):

- `owner@urban-thread.example`
- `manager@urban-thread.example`
- `sales@urban-thread.example`
- `support@urban-thread.example`
- `inventory@urban-thread.example`
- `hr@urban-thread.example`
- `restricted@urban-thread.example`

TechNest Group Ltd. owns the isolated Store `technest-demo` (TechNest BD):

- `owner@technest.example`
- `staff@technest.example`

The Support Agent can view/reply/add notes and read commerce context, but cannot manage channels, billing, DNS, payroll, or credentials. Inventory and HR roles are similarly constrained to current permission keys. Provider credentials remain encrypted and are never returned by the seed.

## Canonical truth

The machine-readable identifiers and assertions live in `backend/scripts/demo_seed_manifest.py`.

Urban Thread has 40 products, 30 customers, 50 orders, and 15 conversations. Its critical facts are:

- Product: Classic Oxford Shirt (`classic-oxford-shirt`)
- Variant: Black / XL (`UT-OXF-BLK-XL`)
- Price: BDT 2,490.00
- Main Warehouse — Dhaka: 12
- Dhanmondi Outlet: 3
- Chattogram Warehouse: 0
- Aggregate available stock: 15
- Customer: Rahim Ahmed
- Order: `UT-1042`, status `shipped`
- Tracking: `UT-TRACK-1042`

Additional stock fixtures include a low-stock product, an out-of-stock product, and stock held in only one warehouse. One adversarial Product description contains a harmless prompt-injection string and remains ordinary Product data.

TechNest has 12 products, 8 customers, 12 orders, and one conversation. Both Stores deliberately own a `gift-card` Product slug, proving Store-scoped uniqueness. All Store-owned IDs and canonical objects are separate.

## Platform coverage

The fixture populates current models for:

- Organizations, Stores, memberships, permissions, onboarding, and settings
- categories, brands, products, variants, custom fields, content, and local media metadata
- warehouses, inventory, suppliers, purchase orders, transfers, wastage, and returns
- customers, CRM activity, orders, POS-sourced orders, couriers, shipments, and tracking
- finance, employees, attendance, salary records, and tasks
- Builder V2 themes, templates, sections, global classes, saved sections, pages, query loops, and dynamic bindings
- plans, entitlement snapshots/overrides, subscriptions, invoice, payment, and usage
- hosted/custom domains, deterministic certificate state, Amar DNS records, and revisions
- Facebook/WhatsApp test channels, encrypted test credentials, identities, conversations, notes, tags, reads, and order links
- AI settings, one historical deterministic test execution, and usage event

Urban Thread has an active Pro monthly test subscription. TechNest has a Growth trial. Urban AI is explicitly enabled in Copilot mode and is immediately usable when `AI_PROVIDER=test`; TechNest AI remains off.

## Domain and infrastructure fixtures

Urban Thread's custom primary hostname is `urban-thread-demo.example.com`. The `.example.com` namespace is reserved for documentation and cannot represent a real merchant domain. Its ownership, routing, certificate, delegation, and DNS provider states are deterministic test-adapter facts—not proof of public DNS or TLS.

Its Amar DNS fixture includes protected Store routing, `www`, MX, SPF-like TXT, DMARC TXT, and CAA records. The MX/TXT records are merchant-managed so Store routing reconciliation can be checked without risking email records.

## Messaging and AI scenarios

Seeded conversations cover stock, price, linked order status, human handoff, order modification, cancellation, prompt injection, stale historical stock, an expired WhatsApp service window, and an internal note. Provider message references are stable so later QA can replay duplicate inbound delivery.

No seed conversation is sent to a customer. Test Meta assets, phone values, credentials, DNS, certificates, and AI history are local simulations only.

## Mutate and restore

QA may deliberately change canonical inventory or statuses. Restore everything with:

```bash
venv/bin/python scripts/seed_demo_platform.py --reset
venv/bin/python scripts/seed_demo_platform.py --verify
```

For example, changing Oxford Black / XL stock to zero and resetting must restore the warehouse split `12 + 3 + 0 = 15`.

## Current schema limitations

- Product currently has one `category_id`, so the seed does not fabricate a many-category relationship.
- Product has no authoritative compare-at-price field; the Builder compare-price block is present, but no fake pricing fact is stored.
- POS has no separate transaction aggregate model; deterministic POS scenarios use supported Orders with the current POS source/payment fields.
- Provider infrastructure is simulated. No real Meta asset, authoritative DNS server, public TLS certificate, billing provider, courier, SMTP, or production model is contacted or verified.
