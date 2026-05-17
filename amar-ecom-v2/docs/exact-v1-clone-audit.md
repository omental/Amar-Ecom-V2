# Exact V1 Clone Audit

Last reviewed: 2026-05-17

## Scope

This document resets frontend parity planning around the client's updated requirement:

- v1 React/Firebase is the source of truth
- v2 must clone v1 UI, UX, and operator workflows as exactly as practical
- this phase is audit and planning only
- no v1 source was modified
- no v2 UI or backend behavior was changed in this phase

## Requirement Reset

- Previous UI passes were `v1-inspired modernization`, not literal recreation.
- The client now requires `exact v1 clone behavior`.
- This exact-clone roadmap supersedes the previous visual roadmap wherever they conflict.

## Phase Status

- `15B` is now implemented for the shell only.
- `15C` is now implemented for the dashboard only.
- The dashboard shell, sidebar, topbar, quick actions, notification popover, collapse behavior, and permission-gated nav have been realigned to the v1 `Layout.tsx` model.
- Notification behavior is now backed by the v2 notification API rather than mocked frontend state.
- v2-only routes remain available under a clearly secondary nav group until later exact-clone phases absorb or de-emphasize them.
- The dashboard page now follows the v1 header, filter bar, six-KPI grid, stock-alerts card, top-sellers card, recent-order card, store-performance chart, and staff-performance panel structure.

## Match Scale

- `Near match`: small visual or workflow differences only
- `Partial`: same domain exists, but structure or interaction differs clearly
- `Major mismatch`: v2 covers the business function but not the v1 screen model
- `Missing`: no direct v2 equivalent

## Global Observations

- v1 is a denser, modal-heavy, tab-heavy monolith with more embedded workflows per screen.
- v2 splits many v1 hubs into separate Next.js routes and form cards.
- v1 uses stronger branded shells, richer active states, quick actions, notification center behavior, and more in-place operations.
- v1 inventory, logistics, CRM, team, HR, finance, and settings rely on multi-tab control-center screens instead of the more modular v2 structure.
- Several v1 modules that are separate routes in v2 are actually tabs or subviews inside a larger v1 parent screen.

## Route Mapping Notes

- v1 `Login` is an auth screen, not a dashboard route.
- v1 `/` maps to `Dashboard`.
- v1 `/orders` plus `/orders/new` cover list, detail modal, and create/edit order flow.
- v1 `/inventory` is a large hub containing products, categories, brands, attributes, warehouses, stock, transfers, wastage, purchases, suppliers, returns, logs, and reports tabs.
- v1 `/crm` is a split-pane directory and detail experience.
- v1 `/logistics` contains shipments, pending ready-to-ship, couriers, reconciliation, and API logs.
- v1 `/finance`, `/hr`, `/team`, and `/settings` are also tabbed workspaces.
- v1 contains `WooCommerceOrders.tsx`, but the current routed shell in `App.tsx` does not expose a dedicated WooCommerce route.
- v1 courier integrations are embedded inside `Logistics`, not isolated as a separate admin page.

## Screen Audit

### Login

1. v1 route/component
   `src/components/Login.tsx`
2. v1 layout structure
   Two-column auth screen. Left branded marketing panel on large screens, right auth card with language switcher, login/register toggle, secure footer note.
3. v1 tabs/sections
   Login mode and register mode inside the same card.
4. v1 filters/search
   None.
5. v1 tables/cards
   Single auth card.
6. v1 modals/drawers
   None.
7. v1 buttons/actions
   Email login, Google login, switch to register, switch back to login, show/hide password, remember me, forgot password.
8. v1 status badges
   None, but Firebase config warning banner appears inline.
9. v1 workflow behavior
   Login and registration are in one surface. Google auth is first-class. Account-pending state is handled outside this screen by `App.tsx`.
10. current v2 equivalent
   `/login`
11. exact gaps
   v2 auth shell is not verified here as matching the branded two-column v1 screen. Must match the v1 left branding panel, language picker placement, card spacing, login/register toggle behavior, and copy hierarchy exactly.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15B`

Match: `Partial`

### App Shell / Sidebar / Topbar

1. v1 route/component
   `src/components/Layout.tsx`
2. v1 layout structure
   Collapsible desktop sidebar, grouped nav sections, mobile slide-over drawer, sticky top header, content container, logout footer.
3. v1 tabs/sections
   Sidebar groups: overview and operations. Orders and Inventory have expandable submenus.
4. v1 filters/search
   Header search input. Notification filter chips inside the notification panel.
5. v1 tables/cards
   N/A
6. v1 modals/drawers
   Mobile menu drawer, quick actions panel behavior, notifications popover.
7. v1 buttons/actions
   Quick POS link, quick actions toggle, theme toggle, notifications, install app button in mobile drawer, sidebar collapse, logout.
8. v1 status badges
   Unread notification dot, online/business labels, rich active nav states.
9. v1 workflow behavior
   Permission-filtered nav, submenu expansion based on route, POS auto-minimizes sidebar, keyboard shortcut for quick actions, notifications with mark-all-read.
10. current v2 equivalent
   `frontend/app/dashboard/layout.tsx`, `frontend/components/dashboard/sidebar.tsx`, `frontend/components/dashboard/topbar.tsx`
11. exact gaps
   Core shell parity is now in place, but a few intentional deviations remain: the v1 `Inbox` route is still excluded, v2-only routes are preserved under a secondary group, and `New Order` / `Add Product` submenu entries currently map to the nearest existing v2 route rather than dedicated v1-style standalone screens.
12. implementation difficulty
   High
13. recommended clone phase
   `15B`

Match: `Near match`

### Dashboard

1. v1 route/component
   `src/components/Dashboard.tsx`
2. v1 layout structure
   Hero summary card plus dense KPI grid, charts, low-stock block, best sellers, recent orders, and team activity.
3. v1 tabs/sections
   No hard tabs. Has time and month/year filtering controls.
4. v1 filters/search
   Month or custom period filter with dropdown-driven state.
5. v1 tables/cards
   KPI cards, sales/revenue charts, low stock list, best sellers list, recent orders table/list, team activity card.
6. v1 modals/drawers
   Filter overlay behavior.
7. v1 buttons/actions
   Filter controls, section-level actions, plus buttons on some card headers.
8. v1 status badges
   Order status pills in recent orders and emphasis colors throughout stats.
9. v1 workflow behavior
   Dashboard is an operational cockpit, not just a summary page. It emphasizes daily comparison, top movers, recent operational activity, and low-stock alerts.
10. current v2 equivalent
   `/dashboard`
11. exact gaps
   Core dashboard structure now follows v1 closely. Remaining deviations are mostly data-shape limitations rather than layout mismatch: v1 `Staff Performance` was recreated visually, but v2 does not yet expose safe per-staff order ownership data, so that widget currently stays in an `Awaiting Data` state instead of showing live ranked staff progress. The v1 header also linked to `/orders/new`, while v2 still maps `New Order` to `/dashboard/orders`.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15C`

Match: `Near match`

### Orders List

1. v1 route/component
   `src/components/Orders.tsx`
2. v1 layout structure
   Dense orders cockpit with summary cards, filter controls, view toggle, tabbed statuses, table/grid modes, and embedded create/edit flow triggers.
3. v1 tabs/sections
   Status tabs with `All` plus business statuses, plus table/grid view toggle.
4. v1 filters/search
   Search, date filter, advanced filter sheet behavior, quick status filtering.
5. v1 tables/cards
   Summary KPI cards, dense order list rows, optional card/grid mode, row meta for source, payment, delivery, print state.
6. v1 modals/drawers
   New/edit order modal, order details modal, status menu popovers, confirmation dialogs.
7. v1 buttons/actions
   New order, export/download, print invoice, view detail, edit, duplicate checks, send to courier, batch selection actions.
8. v1 status badges
   Rich branded status pills for urgent, hold, pending, confirmed, processing, shipped, delivered, cancelled, returned, partial delivered.
9. v1 workflow behavior
   Highly in-place workflow. Operators can browse, inspect, update statuses, print, edit, and launch courier-related actions without route hopping.
10. current v2 equivalent
   `/dashboard/orders`
11. exact gaps
   v2 has a strong list but is still route-split and form-card based. v1 uses embedded modal loops, table/grid switching, denser row meta, and different status/filter choreography. Exact v1 order list behavior is not yet present.
12. implementation difficulty
   High
13. recommended clone phase
   `15D`

Match: `Major mismatch`

### Order Detail / Modal

1. v1 route/component
   `src/components/OrderDetailsModal.tsx`
2. v1 layout structure
   Modal detail surface with summary header, status stepper, customer/shipping blocks, items, history, totals, and action cluster.
3. v1 tabs/sections
   Sectioned modal, not separate routed tabs.
4. v1 filters/search
   None.
5. v1 tables/cards
   Items list, history/activity blocks, shipment and financial summaries.
6. v1 modals/drawers
   Full detail modal launched from orders list.
7. v1 buttons/actions
   Close, print, send to courier, edit-related actions depending on order state.
8. v1 status badges
   Strong status icon + pill system, stepper progression, source labels including WooCommerce.
9. v1 workflow behavior
   Detail is part of the orders loop, not a separate page. Operators inspect and act without leaving context.
10. current v2 equivalent
   `/dashboard/orders/[id]`
11. exact gaps
   v2 uses a dedicated page instead of the v1 details modal. That is a foundational behavior mismatch. The v1 modal-first inspection loop likely needs to be restored or faithfully emulated.
12. implementation difficulty
   High
13. recommended clone phase
   `15D`

Match: `Major mismatch`

### New Order

1. v1 route/component
   `src/components/NewOrder.tsx`
2. v1 layout structure
   Large single workflow form with customer, address, product selection, totals, courier metadata, and order notes in one flow.
3. v1 tabs/sections
   No route tabs. Product picker and order form sections are embedded.
4. v1 filters/search
   Product search dropdown, courier history lookup, location matching behavior.
5. v1 tables/cards
   Order item list with quantity/price control.
6. v1 modals/drawers
   Duplicate-order confirmation and destructive confirmation dialogs.
7. v1 buttons/actions
   Add product, remove product, save order, back, optional SMS-related actions, courier-linked options.
8. v1 status badges
   Order status select uses v1 order status language.
9. v1 workflow behavior
   Very operational and manual. Inline duplicate checking, smart address parsing, courier history lookup, and optional courier-related metadata live in the create form.
10. current v2 equivalent
   Embedded new-order form inside `/dashboard/orders`
11. exact gaps
   v2 folds new-order creation into a card on the orders page. v1 treats it as a dedicated full workflow surface and also reuses it for edit flows. Must restore the exact screen structure and operator pacing.
12. implementation difficulty
   High
13. recommended clone phase
   `15D`

Match: `Major mismatch`

### Inventory Hub

1. v1 route/component
   `src/components/Inventory.tsx`
2. v1 layout structure
   Large monolithic inventory admin hub with alert banner, header actions, horizontally scrollable tabs, and many embedded admin surfaces.
3. v1 tabs/sections
   `Products`, `Categories`, `Brands`, `Attributes`, `Warehouses`, `Stock`, `Transfers`, `Wastage`, `Purchases`, `Suppliers`, `Returns`, `Logs`, `Reports`
4. v1 filters/search
   Tab-specific search and filtering, plus low-stock global alerting.
5. v1 tables/cards
   Product catalog table, stock table, warehouse cards, log tables, report blocks, purchase list, wastage ledger, returns list.
6. v1 modals/drawers
   Warehouse, stock adjustment, transfer, purchase order, supplier, category, brand, attribute, wastage, and confirmation modals.
7. v1 buttons/actions
   Context-sensitive add button tied to active tab, export products, edit/delete across many entities, stock adjust, transfers, PO receive.
8. v1 status badges
   Stock badge states like in stock, low stock, out of stock; PO and return states.
9. v1 workflow behavior
   Inventory is the main admin hub for catalog, stock, procurement, returns, and logs. Operators stay inside one route and switch tabs instead of bouncing between pages.
10. current v2 equivalent
   `/dashboard/inventory` plus `/dashboard/products`, `/dashboard/categories`, `/dashboard/brands`, `/dashboard/warehouses`, `/dashboard/stock-movements`, `/dashboard/suppliers`, `/dashboard/purchase-orders`, `/dashboard/returns`
11. exact gaps
   This is one of the biggest structural mismatches. v2 split the v1 hub into many routes. Exact parity likely means rebuilding the v1 all-in-one inventory hub behavior and using the split routes as implementation support rather than primary UX.
12. implementation difficulty
   High
13. recommended clone phase
   `15E`

Match: `Major mismatch`

### Products

1. v1 route/component
   Inventory `Products` tab inside `src/components/Inventory.tsx`
2. v1 layout structure
   Product catalog tab with search, category/brand helpers, paginated table, and actions.
3. v1 tabs/sections
   Inside inventory hub.
4. v1 filters/search
   Search by name, SKU, or product metadata.
5. v1 tables/cards
   Product table with image, stock, category, brand, barcode print, edit, adjust, delete.
6. v1 modals/drawers
   Relies on parent inventory modals and separate add/edit product route.
7. v1 buttons/actions
   Add product, print barcode, edit product, adjust stock, delete product, add category, add brand.
8. v1 status badges
   Stock status badge.
9. v1 workflow behavior
   Product management is inseparable from stock and supporting catalog entities.
10. current v2 equivalent
   `/dashboard/products`
11. exact gaps
   v2 product management is standalone. v1 expects product management inside the inventory hub and uses a different row/action density.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15E`

Match: `Partial`

### Categories

1. v1 route/component
   Inventory `Categories` tab
2. v1 layout structure
   Simple management list inside inventory.
3. v1 tabs/sections
   Inventory sub-tab only.
4. v1 filters/search
   Minimal.
5. v1 tables/cards
   Compact list/cards with edit/delete.
6. v1 modals/drawers
   Category modal.
7. v1 buttons/actions
   Add category, edit, delete.
8. v1 status badges
   None notable.
9. v1 workflow behavior
   Very lightweight and tightly adjacent to products.
10. current v2 equivalent
   `/dashboard/categories`
11. exact gaps
   v2 makes this a standalone admin page, not an inventory tab.
12. implementation difficulty
   Low
13. recommended clone phase
   `15E`

Match: `Partial`

### Brands

1. v1 route/component
   Inventory `Brands` tab
2. v1 layout structure
   Simple management list inside inventory.
3. v1 tabs/sections
   Inventory sub-tab only.
4. v1 filters/search
   Minimal.
5. v1 tables/cards
   Compact list/cards with edit/delete.
6. v1 modals/drawers
   Brand modal.
7. v1 buttons/actions
   Add brand, edit, delete.
8. v1 status badges
   None notable.
9. v1 workflow behavior
   Same pattern as categories, embedded in inventory flow.
10. current v2 equivalent
   `/dashboard/brands`
11. exact gaps
   v2 route structure and card framing differ from the tabbed v1 pattern.
12. implementation difficulty
   Low
13. recommended clone phase
   `15E`

Match: `Partial`

### Warehouses

1. v1 route/component
   Inventory `Warehouses` tab
2. v1 layout structure
   Warehouse card/list view inside inventory.
3. v1 tabs/sections
   Inventory sub-tab only.
4. v1 filters/search
   Minimal.
5. v1 tables/cards
   Warehouse cards with metadata and actions.
6. v1 modals/drawers
   Warehouse modal.
7. v1 buttons/actions
   Add warehouse, edit, delete.
8. v1 status badges
   Not emphasized like v2 active/inactive chips.
9. v1 workflow behavior
   Warehouses support stock operations immediately within the same hub.
10. current v2 equivalent
   `/dashboard/warehouses`
11. exact gaps
   v2 standalone form/list route differs from v1 tabbed adjacency and card style.
12. implementation difficulty
   Low
13. recommended clone phase
   `15E`

Match: `Partial`

### Stock Logs / Movements

1. v1 route/component
   Inventory `Stock`, `Transfers`, `Logs`, and `Wastage` tabs
2. v1 layout structure
   Stock levels table, transfer workflow, inventory logs table, wastage ledger.
3. v1 tabs/sections
   Separate tabs under inventory.
4. v1 filters/search
   Mostly tab-scoped and lightweight.
5. v1 tables/cards
   Stock table, log table, wastage rows, transfer views.
6. v1 modals/drawers
   Adjustment modal, transfer modal, wastage modal.
7. v1 buttons/actions
   Adjust stock, transfer stock, report wastage, receive PO.
8. v1 status badges
   Stock state emphasis, transfer and receiving states.
9. v1 workflow behavior
   Movement actions and logs are tightly coupled in one route.
10. current v2 equivalent
   `/dashboard/inventory` and `/dashboard/stock-movements`
11. exact gaps
   v2 has some matching concepts but not the exact v1 multi-tab choreography or modal-first action pattern.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15E`

Match: `Partial`

### Customers / CRM

1. v1 route/component
   `src/components/CRM.tsx`
2. v1 layout structure
   Split-pane CRM: left customer directory, right live detail panel.
3. v1 tabs/sections
   Not route tabs, but the detail side includes bills, items bought, messages, summary stats.
4. v1 filters/search
   Search by name, phone, email, address; customer segment chips like new and regular.
5. v1 tables/cards
   Summary cards above, customer list, detail cards, orders and purchased-items sections.
6. v1 modals/drawers
   Add/edit customer modal and confirm delete modal.
7. v1 buttons/actions
   Add customer, export customers, edit, delete, WhatsApp contact, copy email, select customer from list.
8. v1 status badges
   Customer segment badges like VIP, Repeat, At Risk, New Customer.
9. v1 workflow behavior
   Master-detail stays on one screen. Selecting a customer updates the right pane and fetches related orders.
10. current v2 equivalent
   `/dashboard/customers` and `/dashboard/customers/[id]`
11. exact gaps
   v2 split the CRM into list and detail routes. The v1 split-pane workflow is a major behavior difference and one of the clearest clone targets.
12. implementation difficulty
   High
13. recommended clone phase
   `15F`

Match: `Major mismatch`

### Logistics

1. v1 route/component
   `src/components/Logistics.tsx`
2. v1 layout structure
   Unified logistics command screen with header actions, tab strip, shipment tables, courier cards, reconciliation, logs, and integration cards.
3. v1 tabs/sections
   `Shipments`, `Pending Ready-to-Ship`, `Courier Partners`, `Charge Reconciliation`, `API Logs`
4. v1 filters/search
   Shipment search, status-related filtering, reconciliation views.
5. v1 tables/cards
   Shipment list, pending orders list, courier integration cards, manual courier list, reconciliation views, API logs.
6. v1 modals/drawers
   Add/edit courier modal, add/edit delivery modal, confirmation dialogs.
7. v1 buttons/actions
   Export CSV, add shipment, add courier, sync shipment status, sync all, edit/delete shipments and couriers.
8. v1 status badges
   Shipment states, courier API connection states, log success/failure states.
9. v1 workflow behavior
   Dispatch, courier setup, reconciliation, and logs are handled from one module. Courier integrations are embedded rather than isolated.
10. current v2 equivalent
   `/dashboard/logistics`, `/dashboard/couriers`, `/dashboard/shipments`, `/dashboard/courier-integrations`
11. exact gaps
   v2 spread the v1 logistics command center across multiple pages. Exact parity likely requires pulling these back into one primary logistics workspace.
12. implementation difficulty
   High
13. recommended clone phase
   `15G`

Match: `Major mismatch`

### Couriers

1. v1 route/component
   Logistics `Courier Partners` tab
2. v1 layout structure
   Integration cards plus manual courier list inside logistics.
3. v1 tabs/sections
   Not standalone.
4. v1 filters/search
   Light.
5. v1 tables/cards
   Courier cards and manual courier table/list.
6. v1 modals/drawers
   Add/edit courier modal.
7. v1 buttons/actions
   Connect/configure, add custom courier, edit, delete, toggle active.
8. v1 status badges
   Connected/disconnected and active/not connected states.
9. v1 workflow behavior
   Courier configuration is part of logistics operations, not a separate master-data screen.
10. current v2 equivalent
   `/dashboard/couriers` and part of `/dashboard/courier-integrations`
11. exact gaps
   v2 separation breaks the v1 flow.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15G`

Match: `Major mismatch`

### Shipments

1. v1 route/component
   Logistics `Shipments` tab
2. v1 layout structure
   Shipment list is embedded in the logistics workspace.
3. v1 tabs/sections
   Sibling of pending, couriers, reconciliation, logs.
4. v1 filters/search
   Search and operational status syncing.
5. v1 tables/cards
   Dense shipment table with tracking, courier, status, actions.
6. v1 modals/drawers
   Shipment add/edit modal.
7. v1 buttons/actions
   Add, edit, delete, sync status.
8. v1 status badges
   Shipment and courier states.
9. v1 workflow behavior
   Shipment actions are in-place and adjacent to other logistics subviews.
10. current v2 equivalent
   `/dashboard/shipments` and part of `/dashboard/logistics`
11. exact gaps
   v2 keeps shipments as a separate page instead of as the main logistics sub-tab experience.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15G`

Match: `Partial`

### Returns

1. v1 route/component
   `src/components/Returns.tsx` and also inventory `Returns` tab
2. v1 layout structure
   Standalone returns dashboard with top summary cards, search, and list with status progression actions.
3. v1 tabs/sections
   No route tabs.
4. v1 filters/search
   Search by order ID or RMA ID.
5. v1 tables/cards
   KPI cards and returns list.
6. v1 modals/drawers
   Create return request modal.
7. v1 buttons/actions
   Create RMA, progress status, approve, receive, refund, reject.
8. v1 status badges
   Pending, approved, received, refunded, rejected.
9. v1 workflow behavior
   Status progression actions are visible inline from the list.
10. current v2 equivalent
   `/dashboard/returns`
11. exact gaps
   v2 is more form-card and detail-route oriented, while v1 is a tighter list-and-status progression screen. Also v1 has overlapping returns concepts in inventory.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15G`

Match: `Partial`

### Suppliers

1. v1 route/component
   `src/components/Suppliers.tsx` and inventory `Suppliers` tab
2. v1 layout structure
   Two-tab procurement workspace with `Suppliers` and `Purchase Orders`.
3. v1 tabs/sections
   `Suppliers`, `Purchase Orders`
4. v1 filters/search
   Search suppliers by name or phone.
5. v1 tables/cards
   Supplier cards/list, PO list, supplier ledger modal.
6. v1 modals/drawers
   Supplier modal, PO modal, supplier ledger modal, payment modal, confirm delete.
7. v1 buttons/actions
   Add supplier, open ledger, record payment, create PO, edit, delete.
8. v1 status badges
   PO states like received, ordered, cancelled.
9. v1 workflow behavior
   Supplier directory, purchasing, and supplier payments are tightly linked in one module.
10. current v2 equivalent
   `/dashboard/suppliers` and `/dashboard/purchase-orders`
11. exact gaps
   v2 split supplier and PO flows. v1 keeps them together and includes ledger/payment interaction directly from supplier context.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15G`

Match: `Major mismatch`

### Purchase Orders

1. v1 route/component
   `src/components/Suppliers.tsx` purchase-order tab and inventory `Purchases` tab
2. v1 layout structure
   Embedded purchasing list and receiving loop, not a standalone procurement route first.
3. v1 tabs/sections
   Inside suppliers or inventory.
4. v1 filters/search
   Limited compared with v2.
5. v1 tables/cards
   PO table with supplier, amount, status, receiving cues.
6. v1 modals/drawers
   New PO modal, receive PO confirmation flow.
7. v1 buttons/actions
   Create PO, receive stock, record related supplier payment.
8. v1 status badges
   Ordered, received, cancelled.
9. v1 workflow behavior
   Closely tied to supplier ledger and inventory receiving.
10. current v2 equivalent
   `/dashboard/purchase-orders`
11. exact gaps
   v2 standalone flow is structurally different from the embedded v1 procurement behavior.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15G`

Match: `Partial`

### Reports

1. v1 route/component
   `src/components/Reports.tsx`
2. v1 layout structure
   Branded analytics workspace with large tab strip and chart-heavy cards.
3. v1 tabs/sections
   `Intelligence & Assets`, `Asset Entry`, `Human Capital`
4. v1 filters/search
   Date range, valuation method, selected role.
5. v1 tables/cards
   Stat cards, sales trend chart, top sellers, valuation blocks, dead stock, stock ledger excerpt, role comparison, top performers.
6. v1 modals/drawers
   None prominent.
7. v1 buttons/actions
   Filter controls, export/report actions implied by report layout.
8. v1 status badges
   Light use; more emphasis on colored stat and analysis cards.
9. v1 workflow behavior
   Reports are grouped by executive concepts, not by the v2 route's broader operational slices.
10. current v2 equivalent
   `/dashboard/reports`
11. exact gaps
   v2 report grouping, sections, and cards do not match the v1 tab taxonomy or screen composition.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15I`

Match: `Major mismatch`

### Finance

1. v1 route/component
   `src/components/Finance.tsx`
2. v1 layout structure
   Multi-tab finance control center with dashboard, transactions, COA, reports, AR/AP, supplier payments, petty cash.
3. v1 tabs/sections
   `dashboard`, `transactions`, `coa`, `reports`, `ar_ap`, `supplier_payments`, `petty_cash`
4. v1 filters/search
   Search transactions, report date range filters.
5. v1 tables/cards
   KPI cards, transaction table, chart of accounts tree, report launch cards, AR/AP views, supplier payments, petty cash component.
6. v1 modals/drawers
   Transaction modal, supplier payment modal, account modal, P&L modal, balance sheet modal, cash flow modal, confirm modal.
7. v1 buttons/actions
   Add account, add transaction, open financial reports, record supplier payments, manage petty cash.
8. v1 status badges
   Completed and pending transaction states, category styling.
9. v1 workflow behavior
   Finance is a highly tabbed in-place admin module with report modals rather than route-hopping.
10. current v2 equivalent
   `/dashboard/finance`
11. exact gaps
   v2 finance uses the same domain but not the exact tab set, modal behavior, or layout density.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15I`

Match: `Partial`

### HR

1. v1 route/component
   `src/components/HR.tsx`
2. v1 layout structure
   Multi-tab HR admin workspace with action row and search.
3. v1 tabs/sections
   `Employees`, `Designations`, `Attendance`, `Payroll`
4. v1 filters/search
   Employee search by name or designation, attendance filtering.
5. v1 tables/cards
   Employee table, designation table, attendance table, advances and salary sections.
6. v1 modals/drawers
   Designation, employee, attendance, advance, salary generation, profile view, and confirm modals.
7. v1 buttons/actions
   Add employee, add designation, mark attendance, salary advance, generate salary, profile view.
8. v1 status badges
   Employee active/inactive, attendance states, advance pending, salary paid.
9. v1 workflow behavior
   HR tasks are primarily handled in modals launched from the active tab.
10. current v2 equivalent
   `/dashboard/hr`
11. exact gaps
   v2 HR is capable but route card structure differs from v1 tab labels, modal loops, and screen density.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15I`

Match: `Partial`

### POS

1. v1 route/component
   `src/components/POS.tsx`
2. v1 layout structure
   Retail-style split workspace: product search/catalog on one side, cart/customer/checkout on the other.
3. v1 tabs/sections
   Product browsing modes and payment choices are embedded, not route tabs.
4. v1 filters/search
   Product search, category filter, customer search.
5. v1 tables/cards
   Product grid/list, cart summary, checkout summary.
6. v1 modals/drawers
   Camera scanner, add customer, success receipt, variant selection, payment details, confirm modal.
7. v1 buttons/actions
   Add to cart, scan, change customer, add customer, choose payment method, complete sale.
8. v1 status badges
   Limited; more emphasis on selected states and payment chips.
9. v1 workflow behavior
   POS is a focused cashier flow with many modal assists.
10. current v2 equivalent
   `/dashboard/pos`
11. exact gaps
   v2 POS keeps the function but not the exact retail shell, two-panel pacing, or modal sequence from v1.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15I`

Match: `Partial`

### Settings

1. v1 route/component
   `src/components/Settings.tsx`
2. v1 layout structure
   Large settings center with multiple grouped horizontal tab rows and one content pane.
3. v1 tabs/sections
   `General`, `Company Info`, `Account`, `Notifications`, `SMS Settings`, `Security`, `Integrations`, `Data Management`, `Mobile App`, `Activity Logs`
4. v1 filters/search
   None prominent.
5. v1 tables/cards
   Form blocks, toggle lists, export tools, activity log section.
6. v1 modals/drawers
   Confirm modal for sensitive actions.
7. v1 buttons/actions
   Save current section, export all data, toggle notifications, configure integrations and security settings.
8. v1 status badges
   Minimal; mostly toggles and section states.
9. v1 workflow behavior
   Settings centralizes configuration, integrations, data management, mobile app, and logs in one place.
10. current v2 equivalent
   `/dashboard/settings` plus `/dashboard/activity-logs`, `/dashboard/admin-tools`, `/dashboard/woocommerce`, `/dashboard/courier-integrations`
11. exact gaps
   v2 fragmented major v1 settings/admin content into several routes. Exact parity likely requires restoring the broad v1 settings center as the primary experience.
12. implementation difficulty
   High
13. recommended clone phase
   `15H`

Match: `Major mismatch`

### Team / Users

1. v1 route/component
   `src/components/Team.tsx`
2. v1 layout structure
   Tabbed team admin workspace with member list and activity logs.
3. v1 tabs/sections
   `Members`, `Activity Logs`
4. v1 filters/search
   Search members by name or email.
5. v1 tables/cards
   Member list rows and recent activity list.
6. v1 modals/drawers
   Add member modal, permissions modal, delete confirmation modal.
7. v1 buttons/actions
   Add member, edit role/status, open permissions, delete user.
8. v1 status badges
   Role/status presentation, permission toggles.
9. v1 workflow behavior
   Team admin and activity monitoring are combined. Permissions editing is modal-centric.
10. current v2 equivalent
   `/dashboard/users` and `/dashboard/activity-logs`
11. exact gaps
   v2 split team and logs. The modal-centric permissions experience and two-tab team workspace are not preserved exactly.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15H`

Match: `Major mismatch`

### Activity Logs

1. v1 route/component
   `src/components/Team.tsx` activity tab and `src/components/Settings.tsx` activity logs section
2. v1 layout structure
   Embedded within admin modules, not primarily a separate route.
3. v1 tabs/sections
   Team activity tab or settings sub-section.
4. v1 filters/search
   Lightweight or inherited from parent workspace.
5. v1 tables/cards
   Recent activity list style.
6. v1 modals/drawers
   None central.
7. v1 buttons/actions
   Mostly review-only.
8. v1 status badges
   Limited.
9. v1 workflow behavior
   Activity logs are context-adjacent rather than a standalone audit center first.
10. current v2 equivalent
   `/dashboard/activity-logs`
11. exact gaps
   v2 is more standalone than v1. If exact parity is mandatory, the separate route should become secondary to the embedded admin experiences.
12. implementation difficulty
   Low
13. recommended clone phase
   `15H`

Match: `Partial`

### WooCommerce

1. v1 route/component
   `src/components/WooCommerceOrders.tsx` exists, but no active routed entry was confirmed in `src/App.tsx`.
2. v1 layout structure
   Uncertain as a live routed screen in the current v1 shell.
3. v1 tabs/sections
   Uncertain from routing.
4. v1 filters/search
   Uncertain from routing.
5. v1 tables/cards
   Component exists, but live placement is unclear.
6. v1 modals/drawers
   Uncertain.
7. v1 buttons/actions
   Uncertain.
8. v1 status badges
   Uncertain.
9. v1 workflow behavior
   WooCommerce may be implemented as a component or experimental flow, but it is not currently an obvious first-class route like v2.
10. current v2 equivalent
   `/dashboard/woocommerce`
11. exact gaps
   Need a follow-up decision: if the client wants exact v1 behavior, v2 may need to de-emphasize or hide the standalone WooCommerce route unless a matching v1 entry point is confirmed.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15I`

Match: `Uncertain`

### Courier Integrations

1. v1 route/component
   Embedded in `src/components/Logistics.tsx`
2. v1 layout structure
   Courier cards and API logs sit inside logistics.
3. v1 tabs/sections
   Part of `Courier Partners` and `API Logs`.
4. v1 filters/search
   Embedded and lightweight.
5. v1 tables/cards
   Available integration cards, manual courier list, API logs.
6. v1 modals/drawers
   Courier configuration sections expand inline.
7. v1 buttons/actions
   Connect, configure, toggle active, view logs.
8. v1 status badges
   Connected/disconnected, active/not connected, log status.
9. v1 workflow behavior
   Courier integration management is not a standalone admin console in v1.
10. current v2 equivalent
   `/dashboard/courier-integrations`
11. exact gaps
   v2 created a dedicated route and much deeper standalone workflow. For exact parity, the primary UX should be embedded in logistics like v1.
12. implementation difficulty
   Medium
13. recommended clone phase
   `15G`

Match: `Major mismatch`

## Highest Mismatch Screens

1. Inventory hub
2. Orders list + order detail modal flow
3. CRM split-pane workspace
4. Logistics unified command center
5. Settings center
6. Team/users plus embedded activity logs
7. Reports taxonomy and composition

## Recommended First Coding Phase

`15D: Exact v1 Orders workflow`

Reason:

- The shell and landing dashboard now establish the v1 visual and interaction baseline.
- Orders remains the next highest-visibility operational workflow and still has the biggest modal-versus-route parity gap.
- Inventory, CRM, logistics, and admin modules depend on the orders clone language that follows.

## Uncertainty Notes

- `WooCommerceOrders.tsx` exists in v1, but no active route was confirmed in `src/App.tsx`.
- Some v1 business areas overlap across parent hubs. Example: returns show up both as a standalone route and an inventory tab; purchase orders appear in both suppliers and inventory contexts.
- The exact v1 login route entry in the root app was confirmed behaviorally, but the v2 login screen itself was not part of the requested file list, so visual mismatch assessment there is based on requirement context rather than a full v2 auth audit.
