# V1 to V2 UI/UX Parity Audit

Last reviewed: 2026-05-16

## Scope

This audit compares the legacy v1 React UI in the parent workspace `src/components/*` against the current v2 Next.js dashboard UI in `frontend/app/dashboard/*` and `frontend/components/*`.

Rules for this phase:
- v1 was inspected for reference only
- no legacy files were modified
- no backend behavior changes are proposed here
- this document is planning-focused, not an implementation record

## Executive Summary

Functional parity is now strong across the requested v2 scope, but UI/UX parity is still partial. The largest gap is not missing routes. It is that v1 behaved like a dense, branded operations console, while v2 is currently a cleaner, safer, more modular admin app.

Estimated parity:
- Backend and workflow parity: strong
- Route coverage parity: strong
- Visual and interaction parity: moderate
- Overall v1 UI/UX parity estimate: roughly `60-70%`

Biggest parity gaps:
- Global shell, sidebar, topbar, and page framing
- Dashboard visual hierarchy and information density
- Orders as a true operations cockpit
- Inventory as a broad admin hub
- CRM split-pane workflow
- Reports visual richness and decision-support feel

Biggest v2 advantages:
- Cleaner module boundaries
- Better external integration safety
- Better explicit operator warnings
- Safer non-destructive flows for WooCommerce and courier integrations

## Match Levels

- `Matched`: very close in structure and operator feel
- `Partial`: major workflow exists, but v1 layout or interaction style is noticeably richer
- `Missing`: expected v1 pattern is absent
- `Better in v2`: v2 is intentionally safer or clearer
- `Needs redesign`: route works, but the current UI pattern is too far from the v1 experience

## Global Shell

### App Shell / Sidebar / Topbar

- v1 UI pattern:
  - branded shell with grouped navigation sections
  - collapsible desktop sidebar
  - mobile sidebar drawer
  - richer active states and section markers
  - topbar search, notifications, quick actions, theme toggle, profile block
- v2 current UI pattern:
  - simple static sidebar with flat navigation
  - simpler topbar with lightweight title, placeholder search, and avatar
  - clean but less operational
- match level: `Needs redesign`
- concrete gaps:
  - layout gaps: no grouped sidebar sections, no collapsed sidebar mode, less layered shell
  - visual style gaps: v1 has stronger card, shadow, radius, and accent treatment
  - workflow gaps: topbar lacks v1 quick-action and notification richness
  - modal/page behavior gaps: v1 shell feels like a control center, v2 feels like standard admin chrome
- recommended implementation phase: `14D`
- risk level: `Medium`

## Module Audit

### Dashboard

- v1 UI pattern:
  - premium operations dashboard
  - dense KPI zones, charts, alerts, filters, top sellers, recent orders
  - stronger color coding and section hierarchy
- v2 current UI pattern:
  - strong summary and operations cards
  - less chart density, less visual hierarchy
- match level: `Partial`
- concrete gaps:
  - layout gaps: fewer dashboard zones and less hierarchy
  - visual style gaps: weaker dashboard personality
  - workflow gaps: fewer “at a glance” alert clusters
  - table/filter/action gaps: less inline drilldown behavior
- recommended implementation phase: `14D` then `14G`
- risk level: `Low`

### Orders

- v1 UI pattern:
  - dense operations cockpit
  - tabs, board/list modes, strong status ribbons, print flow, bulk handling
  - more direct dispatch-focused behavior
- v2 current UI pattern:
  - operationally strong list with filters, batch actions, exports, Woo refresh, shipment links
- match level: `Partial`
- concrete gaps:
  - layout gaps: no v1-style board or tightly packed dispatch cockpit framing
  - visual style gaps: status chips and row emphasis are flatter
  - workflow gaps: print flow is more basic than v1
  - table/filter/action gaps: less dense row actions and less visible dispatch state stacking
  - modal/page behavior gaps: fewer modal-driven operator loops
- recommended implementation phase: `14E`
- risk level: `Medium`

### Order Detail / Invoice

- v1 UI pattern:
  - more embedded ops actions around detail and print
- v2 current UI pattern:
  - readable detail pages and browser print invoice
- match level: `Partial`
- concrete gaps:
  - layout gaps: less “dispatch next steps” framing
  - workflow gaps: print and shipment handoff still split across pages
- recommended implementation phase: `14E`
- risk level: `Low`

### Products

- v1 UI pattern:
  - product management lives inside a broader inventory admin hub
  - denser admin rows and tighter merchandising feel
- v2 current UI pattern:
  - straightforward standalone product CRUD and detail pages
- match level: `Partial`
- concrete gaps:
  - layout gaps: lacks hub-style adjacency with categories, brands, stock, suppliers
  - visual style gaps: less dense product table treatment
  - workflow gaps: weaker “catalog admin center” feel
- recommended implementation phase: `14F`
- risk level: `Low`

### Inventory

- v1 UI pattern:
  - large tabbed hub including products, stock, categories, brands, suppliers, returns, logs, reports, transfers, wastage
- v2 current UI pattern:
  - practical inventory workspace with focused internal tabs
- match level: `Needs redesign`
- concrete gaps:
  - layout gaps: v2 is more split across routes, less hub-like
  - visual style gaps: fewer dense admin panels in one place
  - workflow gaps: less one-stop inventory administration
  - table/filter/action gaps: less consolidated stock operations
- recommended implementation phase: `14F`
- risk level: `Medium`

### Customers / CRM

- v1 UI pattern:
  - CRM split-pane directory with detail pane and relationship context
- v2 current UI pattern:
  - list page plus separate customer detail page
- match level: `Needs redesign`
- concrete gaps:
  - layout gaps: no split-pane master-detail experience
  - workflow gaps: more page-jumping than v1
  - visual style gaps: less CRM-specific density and context
- recommended implementation phase: `14F`
- risk level: `Medium`

### Logistics / Couriers / Shipments

- v1 UI pattern:
  - unified logistics workspace with tabs for shipments, couriers, logs, pending, reconciliation
  - stronger operational coupling
- v2 current UI pattern:
  - logistics cockpit improved, shipments page improved, courier integrations separated
- match level: `Partial`
- concrete gaps:
  - layout gaps: external courier workflows live in a separate page instead of a denser logistics command center
  - visual style gaps: less urgency and less visual grouping for dispatch vs reconciliation
  - workflow gaps: more cross-page movement
- recommended implementation phase: `14E`
- risk level: `Medium`

### Returns

- v1 UI pattern:
  - returns are part of the broader inventory/ops rhythm
- v2 current UI pattern:
  - standalone, safe return workflow
- match level: `Partial`
- concrete gaps:
  - layout gaps: less embedded into inventory and service operations
  - workflow gaps: fewer shortcuts and operational context cues
- recommended implementation phase: `14F`
- risk level: `Low`

### Suppliers / Purchase Orders

- v1 UI pattern:
  - more tightly connected to inventory hub and procurement flow
- v2 current UI pattern:
  - standalone supplier and purchase-order pages
- match level: `Partial`
- concrete gaps:
  - layout gaps: less integrated procurement hub feel
  - workflow gaps: weaker supplier-to-PO adjacency
- recommended implementation phase: `14F`
- risk level: `Low`

### Reports

- v1 UI pattern:
  - visual analytics workspace with chart-heavy tabs and stronger section identity
- v2 current UI pattern:
  - safe, broad reporting with simpler visual language and new integration health slice
- match level: `Partial`
- concrete gaps:
  - layout gaps: less analytical zoning
  - visual style gaps: less chart depth and less premium feel
  - workflow gaps: fewer saved-view or executive-style glance patterns
- recommended implementation phase: `14G`
- risk level: `Low`

### Finance

- v1 UI pattern:
  - multi-tab finance workspace with dashboard flavor
- v2 current UI pattern:
  - practical finance foundation
- match level: `Partial`
- concrete gaps:
  - layout gaps: less integrated finance command surface
  - visual style gaps: fewer dashboard-style finance sections
- recommended implementation phase: `14H`
- risk level: `Low`

### HR

- v1 UI pattern:
  - tabbed HR workspace with denser admin behavior
- v2 current UI pattern:
  - functional HR foundation
- match level: `Partial`
- concrete gaps:
  - layout gaps: less cohesive HR hub
  - workflow gaps: fewer embedded admin loops
- recommended implementation phase: `14H`
- risk level: `Low`

### Tasks

- v1 UI pattern:
  - board-oriented workflow with stronger task management feel
- v2 current UI pattern:
  - list and kanban views with simpler presentation
- match level: `Partial`
- concrete gaps:
  - visual style gaps: less board polish
  - workflow gaps: lighter collaboration feel
- recommended implementation phase: `14H`
- risk level: `Low`

### POS

- v1 UI pattern:
  - more retail-style workspace feel
- v2 current UI pattern:
  - effective checkout and product/cart flow
- match level: `Partial`
- concrete gaps:
  - layout gaps: less visual energy and sales-floor feel
  - workflow gaps: fewer retail-style shortcuts
- recommended implementation phase: `14H`
- risk level: `Low`

### Settings

- v1 UI pattern:
  - broader admin/settings shell with more adjacency to logs, permissions, integrations
- v2 current UI pattern:
  - business and invoice settings with supporting links
- match level: `Partial`
- concrete gaps:
  - layout gaps: less “admin center” identity
  - workflow gaps: broader settings parity still distributed across routes
- recommended implementation phase: `14H`
- risk level: `Low`

### Team / Users

- v1 UI pattern:
  - stronger team admin workspace with tabs and modal-centric control
- v2 current UI pattern:
  - solid user + permissions workspace
- match level: `Partial`
- concrete gaps:
  - visual style gaps: less explicit admin-panel feel
  - workflow gaps: less compact role and activity adjacency
- recommended implementation phase: `14H`
- risk level: `Low`

### Activity Logs

- v1 UI pattern:
  - activity visibility embedded more directly into admin/settings context
- v2 current UI pattern:
  - separate route with useful filters
- match level: `Better in v2`
- concrete gaps:
  - layout gaps: could still inherit stronger shell styling
- recommended implementation phase: `14H`
- risk level: `Low`

## Shared UI Component Recommendations

These should be created or evolved before large page-by-page redesign work:

- `OpsPageHeader`
  - richer header with eyebrow, title, status chips, actions, and summary rail
- `OpsSummaryCard`
  - denser KPI card aligned to v1 card hierarchy
- `OpsFilterBar`
  - reusable quick-filter chips plus structured filters and search
- `OpsDataTable`
  - denser rows, richer header, row meta zones, optional bulk-selection support
- `OpsStatusBadge`
  - stronger uppercase/tracked status styling closer to v1
- `OpsActionMenu`
  - compact row actions for operational tables
- `OpsModal`
  - consistent modal framing closer to v1 density
- `OpsTabs`
  - horizontally scrollable operations tabs with stronger active state
- `OpsDrawer`
  - side-drawer pattern for detail/edit flows
- `BatchActionBar`
  - reusable sticky or floating selection action bar

## Implementation Roadmap

### Phase 14D

- Global shell match
- Sidebar grouping, collapse behavior, active-state redesign
- Topbar redesign
- Dashboard layout and framing parity foundation

Status:
- completed as shell/design foundation
- module pages still need route-level UI parity passes

### Phase 14E

- Orders + Logistics v1-style operational UI
- Dispatch, print, shipment, reconciliation presentation alignment
- Shared ops table and filter system

Status:
- completed for first-pass route-level parity on:
  - `/dashboard/orders`
  - `/dashboard/orders/[id]`
  - `/dashboard/logistics`
  - `/dashboard/shipments`
  - `/dashboard/shipments/[id]`
- the global shell language from `14D` now carries into the highest-traffic operations screens
- remaining parity work is still needed for inventory, products, CRM, reports, and lower-priority admin modules

### Phase 14F

- Inventory + Products v1-style admin hub UI
- CRM split-pane redesign
- Returns, suppliers, and procurement visual alignment

Status:
- inventory, products, product detail, categories, brands, and warehouses now have the first-pass v1-style shell treatment
- the shared ops language now covers inventory and product admin surfaces in addition to orders and logistics
- CRM, returns, suppliers, and procurement visual adjacency still remain for the next parity pass

### Phase 14G

- Dashboard + Reports visual parity
- Chart zones, hierarchy, and richer executive/ops summary presentation

Status:
- CRM list and CRM detail now have a first-pass v1-style operator treatment with denser headers, KPI strips, clearer badge clusters, richer timeline hierarchy, and stronger edit/activity panel framing
- Reports now use the shared ops shell more directly with a richer reporting header, grouped filter bar, report-group tabs, stronger KPI strip, and a clearer integration health widget
- remaining work after this phase is mostly final dashboard polish plus lower-priority finance, HR, POS, settings, admin, WooCommerce, and courier visual consistency

### Phase 14H

- Finance + HR + POS + Settings + Team polish
- Bring lower-priority modules onto the shared design language

Status:
- completed for first-pass route-level polish on:
  - `/dashboard/finance`
  - `/dashboard/hr`
  - `/dashboard/pos`
  - `/dashboard/settings`
  - `/dashboard/admin-tools`
  - `/dashboard/woocommerce`
  - `/dashboard/courier-integrations`
- dashboard received a final small touch-up so the remaining module groups sit in the same v1-inspired visual language
- remaining work is now mainly `14I` regression QA plus any optional exact-v1 recreation passes

### Phase 14I

- UI regression QA
- mobile behavior checks
- consistency pass for badges, filters, tabs, empty states, and modal patterns

Status:
- completed as a consistency-focused pass across shared dashboard primitives and lower-priority routes
- badge language, page headers, loading states, error alerts, empty states, and batch action framing now align more closely with the v1-inspired ops system
- a dedicated full responsive/layout cleanup is still intentionally pending, especially around shell/content horizontal overflow on narrower widths

## Highest-Priority Screens

1. Global shell, sidebar, and topbar
2. Orders
3. Logistics
4. Inventory
5. Dashboard
6. CRM
7. Reports

## Phase 14D Completion Note

Phase `14D` should be treated as a design-system and shell translation pass, not full parity by itself. After this phase:
- the shell should feel closer to v1
- the dashboard should reflect the new visual language
- shared ops components should exist for later module refactors
- the next highest-value implementation phase is `14E` for Orders + Logistics

## Risks

- Overfitting to v1 visuals can accidentally weaken v2’s safer modular structure
- Recreating v1 density without shared components would create inconsistent one-off pages
- Orders, logistics, and inventory should move together to avoid mixed UI language
- Some v1 monolithic screens should be translated into shared patterns, not copied literally
