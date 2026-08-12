# Manual full-platform browser QA

Use this checklist after preparing the deterministic environment:

```bash
cd backend
venv/bin/python scripts/seed_demo_platform.py --reset
venv/bin/python scripts/seed_demo_platform.py --verify
venv/bin/python scripts/qa_demo_platform.py --full
```

The local-only password is documented in `docs/demo-seed.md`; the CLI never prints it. Do not use these credentials or fixtures outside development/test.

## Authentication and Store switching

- Sign in as `owner@urban-thread.example`; confirm Urban Thread BD dashboard loads.
- Switch to TechNest BD only with a user that is actually a member there. Confirm Urban products, orders, billing, domains, Inbox, and AI state disappear.
- Return to Urban Thread and confirm state is freshly loaded, not stale TechNest data.
- Sign in as Support, Inventory, HR, and Restricted users and confirm the permission matrix described in the seed documentation.
- Confirm Support cannot manage channels, billing, DNS, or payroll; Inventory cannot see payroll/provider credentials; Restricted receives permission denial after valid membership.

## Products, inventory, and orders

- Search Products for Classic Oxford Shirt and open it.
- Confirm Black / XL, SKU `UT-OXF-BLK-XL`, and BDT 2,490.
- Confirm inventory is Main Warehouse 12, Dhanmondi Outlet 3, Chattogram 0, total 15.
- Open low-stock and out-of-stock fixtures and confirm UI indicators agree with the backend.
- Open `UT-1042`; confirm Rahim Ahmed, one Black / XL item, shipped status, and `UT-TRACK-1042`.
- Inspect seeded returns, suppliers, purchase orders, transfers, wastage, POS-sourced orders, finance, and HR pages.

## Builder and Theme Engine

- Open Online Store → Builder and confirm the published Urban Editorial tree loads.
- Select Header, Hero, Product Query, content, promo, and Footer sections.
- Inspect responsive values, hover state, global classes, dynamic binding, conditional visibility, and Query Loop settings.
- Make one harmless draft-only style edit, save, reload, and confirm persistence.
- Change the value again, use Undo, Redo, save, and reload.
- Drag/reorder a safe draft block, verify the tree is valid, then restore its original position.
- Open the Urban Studio draft preview. Confirm the public Store still uses Urban Editorial until an intentional publish.

## Storefront and cart isolation

- Open Urban Thread's configured hosted/custom development URL.
- Confirm Header, Hero, collections, query-loop products, content section, and Footer render.
- Open `/products/classic-oxford-shirt`, select Black / XL, and confirm BDT 2,490 and in-stock state.
- Add it to cart and confirm Product/Store identity.
- Open TechNest's hostname and confirm the Urban cart is absent and TechNest's Theme/data render.
- Confirm unknown and reserved platform hosts show a safe not-found response.
- Use only the local/test checkout path; do not invoke a production payment provider.

## Commercial, billing, domains, and DNS

- Urban Plan & Usage: Pro, active, AI usage visible.
- Urban Billing: active monthly test subscription, paid demo invoice and payment.
- TechNest: Growth trial and AI off.
- Domains: custom test domain primary/active, hosted domain retained as redirect, test SSL state clearly identified.
- Amar DNS: ALIAS routing and `www` are locked; MX, SPF-like TXT, DMARC, and CAA are visible and merchant-managed where expected.
- Never describe these deterministic DNS/TLS states as publicly deployed infrastructure.

## Inbox, Meta test channels, and AI

- Open Inbox and confirm 15 Urban conversations with Facebook/WhatsApp badges, assignments, priorities, tags, notes, and commerce context.
- Open Rahim's Order Status conversation; confirm Customer and `UT-1042` context.
- Add an internal note and verify it is visually distinct and never appears as an outbound customer message.
- Channels must show deterministic test connections only; credentials must remain masked.
- In Copilot, generate a response for “Black Oxford shirt XL আছে?” Confirm a draft and tool summary appear, but nothing auto-sends.
- Confirm order status uses `UT-1042`/shipped, human request hands off, modification/cancellation do not mutate the Order, and prompt injection reveals nothing.
- Open the closed-window WhatsApp fixture and confirm free-form sending is blocked.
- Take Over and Resume AI, confirming human control always wins.

## Responsive sanity

- Check Storefront at mobile width.
- Check Inbox three-column layout at desktop and reduced widths.
- Check Product, Order, Domains, DNS, Billing, and Builder critical controls remain usable.

## Evidence and restore

- Capture screenshots only on failure unless project policy asks otherwise.
- Record exact route, Store, user, expected result, and actual result.
- Restore deterministic state after manual mutation:

```bash
cd backend
venv/bin/python scripts/seed_demo_platform.py --reset
venv/bin/python scripts/seed_demo_platform.py --verify
```

Real Meta, OpenAI, PowerDNS, public DNS/TLS, production billing, courier, and SMTP verification are separate external QA activities.
