# Amar-eCom v1 vs v2 Functional + UI/UX Parity Audit

Last reviewed: 2026-05-12

Scope:
- v1 reference app: legacy React + Firebase app in repo root
- v2 target app: `amar-ecom-v2` Next.js + FastAPI + PostgreSQL app
- this is an inspection-only audit
- no implementation work is included here

## Top Summary

### Overall parity estimate

- Functional parity estimate: `84%`
- UI/UX parity estimate: `73%`

These are directional estimates, not scorecard math. They reflect:
- strong progress in v2 core commerce data and CRUD
- better backend normalization in v2 for orders, returns, shipments, stock movements, and purchase receiving
- materially shallower workflow depth in many v2 screens
- most core operational modules are now present in v2, but several remain intentionally shallower than v1
- orders improved in Phase `9A-1` with duplicate warning checks, richer statuses, printable invoice flow, print tracking, and an order event timeline, but dispatch depth is still below v1
- customers improved in Phase `9A-2` with CRM fields, customer detail workspace, order history, activity timeline, and follow-up visibility, but deeper segmentation/export workflow is still below v1
- team improved in Phase `9A-3` with module permission assignments, login permission payloads, and visible activity logs, but full permission-enforced UI behavior is still not in place
- inventory improved in Phase `9B-1` with a multi-tab operations hub, stock adjustments, transfer workflows, wastage logging, and movement-ledger filtering, but embedded attributes/reporting depth is still below v1
- logistics improved in Phase `9B-2` with a pending-dispatch workspace, create-shipment-from-order flow, reconciliation fields, shipment events, and a dedicated logistics hub, but external courier sync/reconciliation depth is still below v1
- settings improved in Phase `10A-2` with broader invoice/business settings and invoice templates, but broader admin/settings areas from v1 are still missing
- reports improved in Phase `10A-1` and `10A-2` with a stronger reporting foundation covering sales summary, order and payment breakdowns, revenue by date, low-stock detail, top products, recent order activity, logistics totals, stock movement summaries, and lightweight CSV export, but not full management-reporting depth
- finance improved in Phase `10B-1` and `10B-2` with a practical finance workspace covering accounts, transactions, petty cash, supplier payments, linked transaction creation, summary date filters, and browser CSV export, but not full accounting depth
- tasks improved in Phase `10B-3` with a practical internal task workspace covering CRUD, assignees, due dates, priorities, status workflow, kanban/list views, activity logs, and dashboard summary cards
- HR improved in Phase `10B-4` with a practical internal HR workspace covering designations, employees, attendance, salary advances, salary records, activity logs, and dashboard summary cards
- POS improved in Phase `10B-5` with a practical counter-sale foundation covering warehouse-first product search, cart, walk-in customer handling, payment method capture, immediate stock deduction, order creation, optional finance transaction creation, and receipt/invoice handoff
- Phase `11A` validation confirmed fresh migration upgrade success, app import health, route registration coverage, and broad smoke/lint stability, while also surfacing remaining workflow-depth gaps honestly

### Top 10 missing functional gaps

1. Orders still lack v1-level dispatch workflow depth: partial-delivery operations, denser bulk controls, and broader downstream operational actions.
2. CRM/customer parity is improved, but still lacks v1 export depth, segmentation behavior, and denser operator workflow.
3. Inventory parity is improved, but still lacks valuation depth, richer attribute/admin controls, and broader inventory analytics.
4. Settings parity is still much narrower than v1: no backup/export settings, SMS/security areas, or broader admin configuration tooling.
5. Logistics parity is improved, but still lacks external courier API config, status sync, partner-specific controls, and deeper reconciliation depth.
6. Reports are now strong enough for practical operations, but still lack advanced charting, saved views, and deeper management-reporting slices.
7. Finance is operationally useful, but still lacks deep accounting statements, journal-grade controls, and broader payable/receivable depth.
8. HR exists as a useful foundation, but still lacks advanced payroll, leave, and broader people-ops tooling.
9. POS exists as a practical foundation, but still lacks hardware integrations, offline workflows, and refund depth.
10. Explicitly excluded parity gaps remain out of scope: WooCommerce sync, inbox/social automation, and external courier integrations.

### Top 10 missing UI/UX gaps

1. v2 still lacks some of the ultra-dense all-in-one operational layouts that v1 used in orders, settings, and logistics.
2. v2 orders UI is cleaner, but still shallower than the v1 table/grid/filter/export/print/action workflow.
3. v2 settings UI now covers business and invoice needs better, but broader multi-section admin tooling is still missing.
4. v2 dashboard still lacks stronger charting, richer recent-activity storytelling, and team-performance widgets.
5. v2 inventory UI is a legitimate operations hub now, but still lacks some v1 valuation/report tabs and denser cross-module admin flow.
6. v2 customer CRM is now present, but it is still lighter than the v1 operator workspace and lacks export/segment depth.
7. v2 logistics UI is operationally useful, but still lacks courier partner cards, sync controls, and denser reconciliation tooling.
8. v2 finance, HR, tasks, and POS all exist as practical workspaces, but each remains intentionally simpler than v1 depth.
9. v2 team permissions and activity visibility exist, but the admin workflow is still lighter than v1 and not yet enforced across the whole UI.
10. v2 still leans toward cleaner form-plus-table pages where v1 often used denser multi-panel operational workspaces.

### Recommended next 3 coding phases

- `Phase 11B`: Workflow hardening across orders, logistics, and settings
- `Phase 11C`: Advanced reports, exports, and backup/admin tooling
- `Phase 12A`: Selective depth improvements for finance, HR, and POS without breaking scope boundaries

## Status labels used

### Functional status

- `Done`
- `Partial`
- `Missing`
- `Better than v1`
- `Future / Not now`

### UI/UX status

- `Matched`
- `Partial`
- `Missing`
- `Improved`
- `Needs redesign`

## Audit Notes

- v1 contains both real workflows and a few prototype/mock surfaces.
- v2 backend is already structurally better than v1 in several areas, especially inventory movement normalization, returns restocking, shipment timestamps, and purchase receiving.
- structural improvements do not equal parity if the user-facing workflow is still thinner than v1.
- Inbox/social automation features in v1 are explicitly treated as excluded, especially where the v1 screen was mostly mock/prototype.

## Module Audit

### 1. App Shell, Auth, Permissions

**V1 functionality**
- Firebase email/password auth with approval gating via `users.active`
- route-level permission gating per module
- admin override behavior in auth/security flow
- login + inactive-account pending screen
- notification center and quick-action palette in shell

**V1 UI/UX pattern**
- left sidebar with nested module groups
- top utility bar with search, notifications, quick actions, theme toggle
- permission-based menu visibility
- notification filters for orders, tasks, system

**V2 functionality status**
- `Partial`
- auth, login, protected routes, active-state users are working
- module permission matrix is not rebuilt
- shell notifications and quick actions are not rebuilt

**V2 UI/UX status**
- `Partial`
- v2 shell is cleaner and lighter
- v1 utility density is not matched

**Gap list**
- functionality gaps: module-level permission matrix, approval/admin workflow depth, shell notifications, quick actions
- UI gaps: nested module nav, notification popover workflow, shell search/action palette
- backend gaps: permission model depth is lighter in current exposed flows
- frontend gaps: no permission editor, no shell utility parity
- workflow gaps: less admin control over who sees what

**Priority**
- `P0`: permission matrix
- `P1`: admin approval/user governance polish
- `P2`: notifications and quick actions

### 2. Dashboard

**V1 functionality**
- real-time KPIs from orders, customers, products, inventory, team
- daily sales comparisons
- low-stock and returns/cancellation awareness
- recent orders
- top products
- store performance charts
- staff performance widgets

**V1 UI/UX pattern**
- multi-widget dashboard with charts and storytelling
- summary cards plus recent activity
- visual stock health and performance modules

**V2 functionality status**
- `Partial`
- live counts exist for products, customers, orders, inventory, suppliers, returns, shipments, purchase orders
- backend/system health is surfaced
- operational analytics depth is much lower

**V2 UI/UX status**
- `Partial`
- cleaner card layout
- not close to v1 dashboard depth

**Gap list**
- functionality gaps: sales analytics, recent orders workspace, top products, team performance, richer low-stock insight
- UI gaps: chart density, operational panels, activity feed
- backend gaps: no reporting aggregation layer yet
- frontend gaps: dashboard is mostly count cards
- workflow gaps: weaker morning-ops overview than v1

**Priority**
- `P1`

### 3. Orders List + New Order

**V1 functionality**
- order list plus separate new-order route
- manual order create/edit
- multi-item cart workflow
- date filters, status tabs, search, grid/table toggle
- CSV export
- invoice printing with format choice
- order detail modal
- duplicate-order checking
- courier fraud/history lookup
- courier dispatch from order
- WooCommerce order sync and update
- richer statuses including `partial_delivered`
- notes, tags, payment and delivery handling

**V1 UI/UX pattern**
- very dense operational table/grid page
- horizontal status tabs
- filter drawer/popover
- print modal
- courier selection modal
- status badges with strong visual language

**V2 functionality status**
- `Partial`
- list/create/order-warehouse selection/status/payment/source are implemented
- duplicate warning, richer manual-order metadata, print tracking, printable invoice, and order audit events are now implemented
- order detail exists as dedicated page
- warehouse-aware fulfillment and stock deduction are stronger structurally than v1
- v1 workflow depth is not matched

**V2 UI/UX status**
- `Partial`
- cleaner than v1 and easier to scan
- much less operationally capable from a single screen

**Gap list**
- functionality gaps: partial delivery workflow depth, WooCommerce sync, courier dispatch from orders, fraud/history lookup, bulk operational controls
- UI gaps: grid/list toggle, denser action menus, print chooser/templates, modal editing flow
- backend gaps: no WooCommerce/courier integration layer parity
- frontend gaps: order list is improved but still not an ops-heavy workspace
- workflow gaps: dispatch and post-order flow still split across order, shipment, and downstream pages

**Priority**
- `P0`: dispatch workflow depth
- `P1`: partial delivery, bulk order controls
- `P2`: WooCommerce parity

### 4. Order Detail

**V1 functionality**
- modal-based detail review
- status actions
- printing
- operational actions tied back to courier/dispatch flow

**V1 UI/UX pattern**
- modal detail with quick actions
- action-heavy operational review

**V2 functionality status**
- `Partial`
- dedicated detail page is better than v1 for readability
- status update, customer, warehouse, shipment linkage exist
- print tracking, shipping/contact metadata, and event timeline are now present
- courier action depth is still missing

**V2 UI/UX status**
- `Improved`
- page-based detail is stronger structurally
- operational controls are still thin

**Gap list**
- functionality gaps: deeper courier/dispatch actions, partial-delivery action flow
- UI gaps: richer export controls and denser operational shortcuts
- backend gaps: no deeper courier integration event coverage yet
- frontend gaps: action surface improved but still lighter than v1 dispatch workflow
- workflow gaps: users still need to jump elsewhere for downstream ops

**Priority**
- `P1`

### 5. Categories

**V1 functionality**
- category management inside inventory workflow
- create/edit/delete master data

**V1 UI/UX pattern**
- embedded in inventory hub
- lightweight table + modal admin pattern

**V2 functionality status**
- `Done`

**V2 UI/UX status**
- `Partial`
- standalone CRUD works
- embedded inventory-admin experience not matched

**Gap list**
- functionality gaps: none critical
- UI gaps: not embedded in inventory hub
- backend gaps: none critical
- frontend gaps: no inline management from product/inventory flow
- workflow gaps: more navigation than v1

**Priority**
- `P2`

### 6. Brands

**V1 functionality**
- brand master management inside inventory

**V1 UI/UX pattern**
- embedded inventory-admin table + modal

**V2 functionality status**
- `Done`

**V2 UI/UX status**
- `Partial`

**Gap list**
- functionality gaps: none critical
- UI gaps: same embedded-admin parity issue as categories
- backend gaps: none critical
- frontend gaps: extra navigation overhead
- workflow gaps: weaker admin convenience

**Priority**
- `P2`

### 7. Products + Product Detail + Variants

**V1 functionality**
- create and edit products
- simple, variable, and bundle product support
- category/brand linkage
- barcode generation/printing/download
- image/media fields
- variant creation and attribute-driven options
- min stock/reorder depth

**V1 UI/UX pattern**
- dedicated new/edit page
- multi-section product form
- integrated barcode preview/print
- variant subforms and bundle controls

**V2 functionality status**
- `Partial`
- product create, update, detail, and variant CRUD exist
- inventory linkage on product detail exists
- bundle products, barcode workflow, richer media/attribute behavior are not rebuilt

**V2 UI/UX status**
- `Partial`
- dedicated product detail page is solid
- still much shallower than v1 product workspace

**Gap list**
- functionality gaps: bundle items, barcode generation/print, richer attributes, media handling depth, richer product metadata
- UI gaps: barcode panel, variant richness, bundle UX, asset management
- backend gaps: no clear bundle/attribute model parity
- frontend gaps: limited variant ergonomics and product storytelling
- workflow gaps: less complete merchandising workflow than v1

**Priority**
- `P1`

### 8. Warehouses

**V1 functionality**
- warehouse master management
- warehouse-linked inventory actions

**V1 UI/UX pattern**
- inventory-linked admin list/modal

**V2 functionality status**
- `Done`

**V2 UI/UX status**
- `Partial`

**Gap list**
- functionality gaps: no major master-data gap
- UI gaps: weaker embedded workflow
- backend gaps: none major
- frontend gaps: isolated admin page
- workflow gaps: less contextual than v1

**Priority**
- `P2`

### 9. Inventory Hub

**V1 functionality**
- major hub with tabs for products, categories, brands, attributes, warehouses, stock, purchases, suppliers, returns, logs, reports, transfers, wastage
- stock adjustment modal
- PO receive into stock
- transfer stock between warehouses
- wastage logging
- product export CSV
- inventory logs and stock logs
- embedded reports/valuation

**V1 UI/UX pattern**
- high-density tabbed operational workspace
- tables plus many modal workflows
- embedded admin masters and stock actions from one place

**V2 functionality status**
- `Partial`
- inventory now has an operational hub with stock overview, adjustments, transfers, wastage, and movement-ledger workflows
- stock movements, purchase receiving, and return restocking remain structurally stronger than v1
- v1 breadth around attributes, embedded masters, valuation, and reporting is still not rebuilt

**V2 UI/UX status**
- `Partial`
- the inventory page is now a real tabbed operations cockpit instead of simple CRUD
- it still does not match v1 breadth or density across all inventory-admin tabs

**Gap list**
- functionality gaps: attributes, embedded PO receiving convenience, inventory reports/valuation, deeper master-data controls
- UI gaps: broader inventory-admin tabs, embedded reports, denser modal/inline action coverage
- backend gaps: attribute/valuation/reporting parity not present
- frontend gaps: hub is in place but still lighter than the v1 all-in-one workspace
- workflow gaps: inventory managers can now adjust, transfer, and log wastage centrally, but still leave the hub for some related admin and reporting tasks

**Priority**
- `P1`: attributes, embedded receiving convenience, embedded reporting

### 10. Stock Movements

**V1 functionality**
- multiple stock log/ledger collections
- stock-in, sales deduction, transfers, returns, wastage history

**V1 UI/UX pattern**
- log tables inside inventory

**V2 functionality status**
- `Better than v1`
- normalized stock movement model exists
- order deductions, purchase receiving, return restocking are modeled explicitly
- coverage is still incomplete because transfers/wastage UI are not in parity

**V2 UI/UX status**
- `Improved`
- dedicated page is clearer than v1 logs
- filtering depth is still limited

**Gap list**
- functionality gaps: broader movement source coverage
- UI gaps: stronger filters/search/grouping
- backend gaps: transfer/wastage source parity
- frontend gaps: no advanced movement analysis
- workflow gaps: difficult to isolate specific operational causes quickly

**Priority**
- `P1`

### 11. Customers / CRM

**V1 functionality**
- customer CRUD
- search
- CSV export
- customer type segmentation
- tags, notes, follow-up date
- customer detail panel
- customer order history tables

**V1 UI/UX pattern**
- CRM page with metrics, search, segment filters, list + detail workspace
- tables for history/orders
- editable CRM fields in one place

**V2 functionality status**
- `Partial`
- customer CRUD, CRM fields, customer detail workspace, recent order history, and activity timeline now exist
- follow-up metadata and customer-type segmentation are now surfaced
- export depth and broader CRM workflow richness are still behind v1

**V2 UI/UX status**
- `Partial`
- cleaner admin form/table plus a dedicated CRM detail page now exist
- still lighter and less dense than the v1 workspace

**Gap list**
- functionality gaps: CSV export, deeper segmentation/filtering, richer customer lifecycle actions, more advanced follow-up workflow
- UI gaps: denser side-by-side CRM workspace, stronger quick actions, export and segmentation controls
- backend gaps: no broader CRM automation or richer activity taxonomy yet
- frontend gaps: CRM detail is good foundation but still lighter than v1 operator density
- workflow gaps: sales/support can now work the customer record, but not yet with v1-level speed and breadth

**Priority**
- `P1`

### 12. Team / Users

**V1 functionality**
- create users
- activate/deactivate
- role management
- module permission matrix
- delete user flow
- activity logs

**V1 UI/UX pattern**
- team page with members tab and activity tab
- searchable/paginated table
- permission editing modal
- admin action menus

**V2 functionality status**
- `Partial`
- create/edit role/active state exist
- module permission assignment now exists
- activity log listing now exists
- permission enforcement is still only partial and delete/admin-helper flow is still absent

**V2 UI/UX status**
- `Partial`
- cleaner forms plus a simple permission editor and dedicated activity log page
- still missing the denser v1 admin workflow feel

**Gap list**
- functionality gaps: stronger permission enforcement, delete/admin-helper flow, broader governance/reporting workflow
- UI gaps: denser matrix management, richer admin actions, more integrated activity review
- backend gaps: role abstraction and broader policy enforcement are still lightweight
- frontend gaps: permission editing is present but still simple and not system-wide
- workflow gaps: administrators can manage assignments and review logs, but not yet fully govern every surface like v1

**Priority**
- `P1`

### 13. Settings

**V1 functionality**
- tabs for General, Company Info, Account, Notifications, Security, Integrations, SMS Settings, Data Management, Mobile App, Activity Logs
- company branding and invoice settings
- permissions editing from settings
- WooCommerce config
- SMS gateway config
- security/session settings
- data export and backup controls
- mobile/PWA install assistance
- activity logs

**V1 UI/UX pattern**
- multi-column settings navigation
- dense admin forms
- grouped business/user/system sections

**V2 functionality status**
- `Partial`
- business settings page exists and is usable
- invoice/business profile fields now include richer invoice presentation controls
- invoice templates are now implemented with CRUD, default selection, and invoice print integration
- most v1 settings domains are missing

**V2 UI/UX status**
- `Partial`
- page is clean and coherent
- far narrower than v1

**Gap list**
- functionality gaps: integrations, SMS, user settings, security, data management, activity logs, permissions-in-settings
- UI gaps: still lighter than v1's denser admin utility surfaces
- backend gaps: no parity APIs for most non-invoice settings areas
- frontend gaps: broader system settings domains remain unbuilt
- workflow gaps: operations can now manage invoice templates, but still cannot configure the broader system

**Priority**
- `P0`: company/invoice essentials already okay; missing operational settings still important
- `P1`: integrations, SMS, security, data export

### 14. Returns / RMA

**V1 functionality**
- create RMA request
- status flow: pending, approved, received, refunded, rejected
- inventory restock on receipt
- refund transaction creation and account impact

**V1 UI/UX pattern**
- dedicated returns page
- stats cards
- searchable table
- modal create flow
- inline status actions

**V2 functionality status**
- `Partial`
- create/list/detail/update exist
- restock logic exists in backend and is cleaner than v1
- refund/accounting workflow depth is still behind v1

**V2 UI/UX status**
- `Partial`
- dedicated list/detail pattern is clean
- less action-rich than v1 list workflow

**Gap list**
- functionality gaps: finance/account linkage parity, richer status/action flow, replacement handling polish
- UI gaps: inline action density, ops shortcuts, request lifecycle visibility
- backend gaps: tighter refund-to-finance integration
- frontend gaps: less operational control from list page
- workflow gaps: returns-to-finance closure is weaker than v1

**Priority**
- `P1`

### 15. Couriers + Logistics + Shipments

**V1 functionality**
- courier config save to backend
- courier partner integrations: Steadfast, Pathao, RedX, Carrybee, Paperfly, plus manual couriers
- pending orders ready for dispatch
- send order to courier
- status sync from courier
- tracking links
- courier logs
- delivery/shipment records
- charge reconciliation workflow
- courier performance stats

**V1 UI/UX pattern**
- sub-tabs for pending dispatch, shipments, courier partners, charge reconciliation
- partner cards with success metrics
- shipment tables with sync and tracking actions
- integration forms for each courier

**V2 functionality status**
- `Partial`
- courier master CRUD exists
- shipment create/list/detail/update exist
- pending dispatch, create-shipment-from-order, recipient fields, reconciliation tracking, and shipment events now exist
- backend shipment timestamps are better structured than v1
- external courier integration, sync, fraud/history, and deeper partner-specific reconciliation are still missing

**V2 UI/UX status**
- `Partial`
- shipment detail pages are cleaner than v1
- a dedicated logistics workspace now covers pending dispatch, shipments, couriers, and reconciliation
- overall logistics depth still does not match the full v1 partner-ops workspace

**Gap list**
- functionality gaps: courier API configs, send-to-courier automation, tracking sync, fraud check, courier-side reconciliation depth
- UI gaps: courier partner cards, sync actions, richer dispatch shortcuts, deeper reconciliation analysis
- backend gaps: no courier integration/sync layer parity
- frontend gaps: logistics hub is in place but still lighter than the v1 courier-ops surface
- workflow gaps: dispatch team can now work internally from one hub, but not yet with v1 external-partner depth

**Priority**
- `P0`: dispatch workflow basics
- `P1`: sync/tracking/reconciliation

### 16. Suppliers

**V1 functionality**
- supplier CRUD
- supplier search
- supplier ledger
- supplier payment recording against accounts
- PO linkage and outstanding balance calculation

**V1 UI/UX pattern**
- supplier directory plus ledger/payment views
- modal create/edit/payment flows
- summary cards and table history

**V2 functionality status**
- `Partial`
- supplier directory CRUD exists
- supplier payments now exist through the finance workspace, but supplier ledger and broader balance workflow parity are still missing

**V2 UI/UX status**
- `Partial`
- simpler and cleaner
- not a supplier operations workspace yet

**Gap list**
- functionality gaps: ledger, supplier balance visibility, deeper account integration from the supplier workspace
- UI gaps: ledger modal/panel, supplier financial history
- backend gaps: supplier ledger and payable balance depth are not rebuilt
- frontend gaps: supplier page is still directory-first and does not surface finance history directly
- workflow gaps: finance can record supplier payments, but procurement still lacks a v1-style supplier ledger workspace

**Priority**
- `P1`

### 17. Purchase Orders / Replenishment

**V1 functionality**
- PO records existed across inventory and supplier workflows
- receive PO into stock
- link to suppliers and inventory

**V1 UI/UX pattern**
- embedded inside inventory/supplier workflow
- receive action directly from PO list

**V2 functionality status**
- `Done`
- PO CRUD, status flow, detail page, received stock posting, and stock movements are implemented
- backend receiving flow is better than v1

**V2 UI/UX status**
- `Improved`
- dedicated PO pages are clearer
- embedded procurement workflow convenience from v1 is not matched

**Gap list**
- functionality gaps: supplier payment linkage, embedded receiving convenience, richer notes/history
- UI gaps: quicker receive action surface from list/hub views
- backend gaps: finance linkage
- frontend gaps: not integrated into supplier ledger workflow
- workflow gaps: procurement is still split across separate pages

**Priority**
- `P1`

### 18. Reports

**V1 functionality**
- dedicated reports module
- multiple report tabs
- sales/inventory/performance reporting
- export-oriented behavior

**V1 UI/UX pattern**
- tabbed reporting workspace
- charts and tables

**V2 functionality status**
- `Partial`
- foundational reports now exist for sales, order and payment status, inventory, customers, logistics, top products, low-stock detail, revenue by date, recent order activity, and stock movements
- still missing richer exports, advanced filters, and finance-level reporting depth

**V2 UI/UX status**
- `Partial`
- there is now a clean reports dashboard with cards, tables, date filters, CSV exports, and lightweight visual bars
- it is still lighter than the v1 reporting workspace

**Gap list**
- functionality gaps: deeper report catalog, richer filtering, channel/courier/supplier slices, advanced exports, finance-linked reporting
- UI gaps: charting depth, denser comparison views, saved filters, multi-tab analysis flow
- backend gaps: broader reporting aggregations and historical trend endpoints
- frontend gaps: charts and drill-down depth are still limited
- workflow gaps: management reporting exists in basic form but not yet at v1 operational depth

**Priority**
- `P1`

### 19. Finance

**V1 functionality**
- finance dashboard
- transactions
- chart of accounts
- AR/AP
- supplier payments
- petty cash
- financial reports including P&L/balance/cash flow style outputs
- CSV export

**V1 UI/UX pattern**
- tabbed finance hub
- modal transaction/account creation
- dense tables plus charts

**V2 functionality status**
- `Partial`
- finance dashboard now exists with overview, accounts, transactions, petty cash, and supplier payment foundations
- basic finance summary and finance-linked report summary now exist
- full accounting, P&L, balance sheet, and deeper AR/AP remain out of scope

**V2 UI/UX status**
- `Partial`
- tabbed finance workspace exists, but it is intentionally lighter than v1

**Gap list**
- functionality gaps: full accounting, advanced AR/AP, and finance report depth
- UI gaps: denser analytics, richer filters, and modal-heavy workflows from v1
- backend gaps: no general ledger, journal-entry engine, or statement-grade reporting
- frontend gaps: finance visuals remain summary-first rather than analysis-heavy
- workflow gaps: returns-to-finance closure and deeper procurement-finance reconciliation remain weaker than v1

**Priority**
- `P1`

### 20. HR

**V1 functionality**
- employees
- designations
- attendance
- salary advances
- salary records

**V1 UI/UX pattern**
- multi-tab HR workspace
- searchable employee table
- attendance marking and payroll-related forms

**V2 functionality status**
- `Partial`
- HR workspace now exists with designations, employees, attendance, salary advances, salary records, and summary cards
- full payroll posting, leave policies, attendance devices, and deeper admin workflow remain out of scope

**V2 UI/UX status**
- `Partial`
- tabbed HR workspace exists, but it is intentionally lighter than v1

**Gap list**
- functionality gaps: full payroll workflow, leave management depth, attendance device integration, and richer employee admin depth
- UI gaps: denser employee administration, richer filters, and broader HR analytics
- backend gaps: no payroll posting, leave rules engine, or device-sync workflow
- frontend gaps: no dedicated employee detail workspace or document-heavy HR tooling
- workflow gaps: salary and attendance remain foundational rather than policy-heavy

**Priority**
- `P2`

### 21. Tasks

**V1 functionality**
- task CRUD
- assignment
- due dates
- status updates
- notifications
- list and kanban views with drag/drop

**V1 UI/UX pattern**
- list/kanban toggle
- draggable cards
- task modal

**V2 functionality status**
- `Partial`
- tasks workspace now exists with CRUD, assignment, due dates, priorities, status workflow, list view, kanban view, and dashboard summary

**V2 UI/UX status**
- `Partial`
- list and kanban-style workflows now exist, but drag/drop and richer collaboration remain lighter than v1

**Gap list**
- functionality gaps: notifications, drag/drop depth, richer workflow automation
- UI gaps: denser task collaboration and board interactions
- backend gaps: no reminder/notification engine
- frontend gaps: no dedicated task detail page or drag/drop board
- workflow gaps: task ops are now practical, but still lighter than v1 depth

**Priority**
- `P2`

### 22. POS

**V1 functionality**
- POS cart
- barcode scan/search
- walk-in customer flow
- payment method handling
- inventory deduction
- transaction/account integration
- SMS receipt option
- print invoice

**V1 UI/UX pattern**
- dedicated POS layout optimized for checkout
- scanner modal and payment modal
- success/print flow

**V2 functionality status**
- `Partial`
- POS workspace now exists with warehouse-first product search, cart, walk-in customer flow, payment method capture, immediate stock deduction, order creation, optional finance transaction creation, and invoice/receipt handoff
- offline mode, barcode hardware integration, SMS receipt, and refund workflow remain out of scope

**V2 UI/UX status**
- `Partial`
- dedicated POS layout now exists and is practical for internal checkout, but it remains lighter than the v1 modal/scanner flow

**Gap list**
- functionality gaps: offline mode, barcode hardware support, SMS receipt, POS refund flow, and richer cashier controls
- UI gaps: scanner modal, payment modal depth, and denser fast-keyboard checkout ergonomics
- backend gaps: no offline sync or POS refund endpoints yet
- frontend gaps: no hardware scan integration or richer payment-step workflow
- workflow gaps: walk-in sales now work end-to-end, but still without the broader v1 cashier-depth extras

**Priority**
- `P3`

### 23. Inbox

**V1 functionality**
- unified inbox shell
- channel configuration forms for Messenger, Instagram, WhatsApp
- conversation UI structure

**V1 UI/UX pattern**
- left conversation rail, middle chat panel, right customer/info panel
- integration modal

**Reality check**
- v1 source shows `mockConversations` and no meaningful production data workflow
- this is partly a prototype/mock surface, not a confirmed mature business module

**V2 functionality status**
- `Future / Not now`

**V2 UI/UX status**
- `Missing`

**Gap list**
- functionality gaps: intentionally excluded
- UI gaps: intentionally excluded
- backend gaps: intentionally excluded
- frontend gaps: intentionally excluded
- workflow gaps: intentionally excluded

**Priority**
- `P3`

## Supporting v1 Components That Matter For Parity

- `OrderDetailsModal`: v1 quick-detail workflow, partly replaced by stronger v2 page-based order detail
- `InvoiceTemplates`: now implemented in v2 with active/default management and invoice print integration
- `CourierReconciliation`: internal reconciliation foundation exists in v2, but not full external courier-partner reconciliation parity
- `StockTransfers`: implemented in v2
- `PettyCash`: implemented inside the finance foundation in v2
- `WooCommerceOrders`: missing and not for now

## Screens / Page Comparison

| Screen | v1 | v2 | Verdict |
| --- | --- | --- | --- |
| Dashboard | rich KPI + charts + recent orders + team performance | count-driven dashboard with shipment/returns/PO counts | `Functional Partial / UI Partial` |
| Orders | deep ops page with search, tabs, filters, export, print, courier actions, Woo sync | cleaner list/create screen with basic CRUD and detail links | `Functional Partial / UI Partial` |
| Order Detail | modal with quick actions | dedicated detail page with shipment linkage and stock warning | `Functional Partial / UI Improved` |
| Products | rich create/edit with barcode, bundle, variants, media | CRUD + detail + variant CRUD | `Functional Partial / UI Partial` |
| Product Detail / New Product | deeper merchandising workflow | solid detail page, but shallower feature set | `Functional Partial / UI Partial` |
| Inventory | big tabbed operations hub | tabbed inventory hub with overview, adjustments, transfers, wastage, and movement ledger | `Functional Partial / UI Partial` |
| Customers / CRM | actual CRM workspace | CRM list + detail workspace with order history and activities | `Functional Partial / UI Partial` |
| Team | permissions + activity logs | role/active-state management plus permission assignment and activity logs | `Functional Partial / UI Partial` |
| Settings | multi-domain admin center | business settings only | `Functional Partial / UI Partial` |
| Returns | operational RMA flow | good foundation, still lighter than v1 | `Functional Partial / UI Partial` |
| Logistics / Shipments | courier integrations + sync + reconciliation + delivery ops | internal logistics hub with pending dispatch, shipment detail, courier list, and reconciliation tracking | `Functional Partial / UI Partial` |
| Suppliers | supplier directory + ledger + payments | supplier directory CRUD only | `Functional Partial / UI Partial` |
| Reports | dedicated reporting module | enhanced reports dashboard with summaries, breakdowns, revenue overview, low-stock detail, recent order activity, and CSV export | `Functional Partial / UI Partial` |
| Finance | dedicated finance suite | finance foundation with accounts, transactions, petty cash, supplier payments, linked transaction records, filters, exports, and overview | `Functional Partial / UI Partial` |
| HR | dedicated HR suite | HR foundation with designations, employees, attendance, salary advances, salary records, and summary | `Functional Partial / UI Partial` |
| POS | functional POS | POS foundation with warehouse-first search, cart, checkout, stock deduction, finance link, and invoice handoff | `Functional Partial / UI Partial` |
| Inbox | mostly prototype/mock unified inbox shell | absent by design for now | `Future / Not now` |

## Explicit Exclusions

These should stay out of current implementation scope:

- Facebook AI Inbox Assistant
- Messenger webhook automation
- Instagram/WhatsApp automation
- OpenRouter AI reply assistant
- any new module that was only a mock/prototype in v1

For clarity:
- Inbox/social automation is excluded now
- WooCommerce and courier deep integrations are real v1 functionality, but they are not the same thing as the excluded AI/social automation scope

## Recommended Implementation Order

### Phase 9A

- finish orders parity: print/invoice, richer statuses, operational actions
- rebuild CRM depth: customer detail/history/tags/notes/follow-up
- complete team permissions + activity logs
- expand settings beyond business profile into core operational settings

Why:
- these are the biggest `P0` gaps inside already-active business workflows

### Phase 9B

- deepen inventory admin breadth around attributes, valuation, and embedded receiving/reporting
- tighten warehouse-first workflows
- bridge order-to-dispatch flow with logistics actions

Why:
- v1 operations depended on inventory and fulfillment controls being fast, centralized, and broader than the current hub

### Phase 9C

- complete logistics parity around courier sync, partner-specific reconciliation, and dispatch refinement
- deepen returns-finance closure
- connect suppliers and purchase orders to ledger/payment flow

Why:
- this closes the post-order and replenishment loop

### Phase 10A

- deepen reports module with richer filters, trends, and exports
- finance foundations: accounts, transactions, petty cash, supplier payments, linked transaction records, summary filters, CSV export
- shared reporting/analytics queries

Why:
- management visibility and accounting are important, but they should build on stable operational data

### Phase 10B

- HR foundation
- tasks foundation
- POS foundation

Why:
- these are real v1 modules, but they are not the best next parity unlock for current commerce MVP

## Bottom Line

- v2 backend foundations are already stronger than v1 in several core operational domains.
- v2 frontend is cleaner and more maintainable, but many modules are still CRUD-first rather than workflow-first.
- the main parity risk is not missing tables or endpoints alone. It is missing day-to-day operational UX depth in orders, CRM, inventory, team, settings, and logistics.
- reports, finance, HR, tasks, and POS remain parity gaps, but they now each have practical foundations in v2.
- inbox/social automation should not distort the roadmap because the v1 implementation there was at least partly prototype-oriented.
