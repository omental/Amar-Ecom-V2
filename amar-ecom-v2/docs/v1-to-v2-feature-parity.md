# Amar eCom v1 to v2 Feature Parity

## Purpose

This document compares the legacy Amar eCom v1 React + Firebase app in `D:\Amar-eCom` with the current v2 implementation in `D:\Amar-eCom\amar-ecom-v2`.

Scope rules for this review:

- v1 is a feature reference only
- no v1 source should be modified
- this is a parity assessment, not a build plan for brand new modules

## Status Labels

- `Done`: usable in v2 today
- `Partial`: foundational or limited support exists in v2, but parity is incomplete
- `Missing`: v1 support exists, v2 does not currently cover it
- `Future / Not now`: intentionally deferred for after MVP parity or intentionally excluded

## Full v1 Module Inventory

### Main route modules in v1

Confirmed from `src/App.tsx`:

- `Dashboard`
- `POS`
- `Orders`
- `NewOrder`
- `Inventory`
- `NewProduct`
- `CRM`
- `Inbox`
- `Returns`
- `Suppliers`
- `Logistics`
- `Finance`
- `HR`
- `Team`
- `Tasks`
- `Reports`
- `Settings`

### Shared app shell and auth layer in v1

- `Layout`
- `Login`
- `AuthContext`
- `SettingsContext`
- `ThemeContext`

### Important supporting components in v1

- `OrderDetailsModal`
- `ConfirmModal`
- `StockTransfers`
- `CourierReconciliation`
- `InvoiceTemplates`
- `PettyCash`
- `WooCommerceOrders`

### Important service/integration layer in v1

- `orderService`
- `activityService`
- `notificationService`
- `valuationService`
- `performanceService`
- `woocommerceService`
- `steadfastService`
- `smsService`
- `locationService`
- Express `server.ts` endpoints for WooCommerce, couriers, SMS, admin user deletion

## V2 Coverage Summary

| v1 Module | v2 Status | MVP | Notes |
| --- | --- | --- | --- |
| Auth / Login / approval | Done | Yes | JWT auth is live; approval-style active checks already exist on backend |
| Dashboard | Done | Yes | live counts and connected dashboard exist |
| Orders list | Done | Yes | list and create are working |
| Order creation | Done | Yes | multi-item order create is working |
| Order detail | Done | Yes | detail page and status updates exist |
| Inventory | Partial | Yes | inventory create/list exists; richer stock operations from v1 are still missing |
| Product create/edit | Partial | Yes | create/list exists, but v1 product depth is broader |
| Categories | Done | Yes | connected CRUD-style create/list exists |
| Brands | Done | Yes | connected CRUD-style create/list exists |
| Warehouses | Done | Yes | connected CRUD-style create/list exists |
| Customers / CRM | Partial | Yes | customer CRUD exists; CRM history/segmentation/follow-up depth is still limited |
| Team / Users | Partial | Yes | backend users exist, but v1 team admin UX is not yet recreated in frontend |
| Stock movements / ledger | Done | Yes | v2 is already stronger structurally than v1 here |
| POS | Future / Not now | No | operationally useful, but not required for current MVP |
| Returns / RMA | Missing | Later | v1 has clear workflow; v2 has none yet |
| Suppliers | Missing | Later | supplier + purchase order workflows not rebuilt yet |
| Logistics / courier ops | Missing | Later | v1 has courier config, dispatch, tracking, reconciliation |
| Finance | Missing | Later | v1 has real accounting-oriented module set |
| HR | Missing | Later | v1 includes designations, employees, attendance, salary |
| Tasks | Missing | Later | internal task management exists in v1 |
| Reports | Missing | Later | v1 has sales, inventory, and performance reporting |
| Settings | Partial | Later | v1 settings are broad; v2 has only limited foundation/config so far |
| Inbox | Future / Not now | No | do not implement now |
| WooCommerce integrations | Future / Not now | No | not part of current MVP parity push |

## Module-by-Module Detail

### Auth

- v1 appears to support:
  - Firebase Auth login
  - active/inactive approval gating
  - module permission checks
  - user profile resolution from Firestore
- v2 currently supports:
  - register/login
  - JWT protected APIs
  - protected dashboard routes
  - active user enforcement in backend auth dependency
- missing in v2:
  - mature team permission management UI
  - richer module permission editing in frontend
- MVP:
  - Yes

### Dashboard

- v1 appears to support:
  - real-time KPI cards
  - sales/order/customer/product overviews
  - richer charts and operational widgets
- v2 currently supports:
  - live counts for products, customers, orders, inventory
  - backend health status
  - admin dashboard shell
- missing in v2:
  - richer charts
  - operational summaries beyond counts
  - team/financial/logistics summary blocks
- MVP:
  - Yes

### Categories

- v1 appears to support:
  - category management inside Inventory
- v2 currently supports:
  - category list and create UI
  - backend CRUD foundation
- missing in v2:
  - fuller edit/delete management in frontend
  - inventory-tab style embedded management UX
- MVP:
  - Yes

### Brands

- v1 appears to support:
  - brand management inside Inventory
- v2 currently supports:
  - brand list and create UI
  - backend CRUD foundation
- missing in v2:
  - fuller edit/delete management in frontend
- MVP:
  - Yes

### Products

- v1 appears to support:
  - simple and variable products
  - bundle items
  - barcode support
  - image handling
  - min stock / richer product metadata
  - edit flow
- v2 currently supports:
  - product list and create UI
  - category/brand linking
  - SKU, price, cost price, status
  - backend product model with variants relation
- missing in v2:
  - product edit UI
  - variant management UI
  - bundle support
  - barcode workflows
  - richer product content/media controls
- MVP:
  - Yes

### Customers / CRM

- v1 appears to support:
  - customer CRUD
  - customer order history
  - segmentation
  - tags, notes, follow-up dates
- v2 currently supports:
  - customer list and create UI
  - order linkage at backend level
- missing in v2:
  - customer detail/history UI
  - segmentation and follow-up UX
  - richer CRM workflows
- MVP:
  - Yes

### Warehouses

- v1 appears to support:
  - multiple warehouses
  - warehouse management within inventory operations
- v2 currently supports:
  - warehouse list and create UI
  - backend CRUD
- missing in v2:
  - fuller edit/delete management in frontend
  - warehouse-aware order assignment
- MVP:
  - Yes

### Inventory

- v1 appears to support:
  - inventory balances
  - stock logs
  - stock adjustments
  - purchase batches
  - wastage logs
  - stock transfers
  - returns-related restocking
- v2 currently supports:
  - inventory item create/list
  - low-stock and out-of-stock visibility
  - adjustment logging through stock movements
  - stock movement ledger page
- missing in v2:
  - transfer workflows
  - purchase receiving workflows
  - wastage flows
  - richer warehouse balancing tools
- MVP:
  - Yes

### Orders

- v1 appears to support:
  - manual order creation
  - richer status workflow
  - customer/address/courier detail capture
  - duplicate checks
  - delivery and payment handling
  - invoices and printing
- v2 currently supports:
  - order list
  - multi-item order creation
  - order detail page
  - status updates
  - payment status/source fields
  - stock deduction on fulfillment status
- missing in v2:
  - invoice/print workflows
  - richer address and courier dispatch handling
  - partial delivery and return-aware order flows
  - warehouse selection at order level
- MVP:
  - Yes

### Order Detail

- v1 appears to support:
  - detailed order viewing through list/detail modal flows
  - status actions
  - printing and operational actions
- v2 currently supports:
  - dedicated order detail page
  - line items, totals, customer summary
  - status update warning for stock deduction
- missing in v2:
  - print/invoice controls
  - courier and dispatch actions
  - richer audit/log timeline
- MVP:
  - Yes

### Stock Movements

- v1 appears to support:
  - stock history via `inventoryLogs`, `stock_logs`, `stockLedger`, and related records
- v2 currently supports:
  - normalized stock movement table
  - movement history API
  - movement history frontend page
  - fulfillment-linked stock deduction logging
- missing in v2:
  - filters in frontend
  - broader movement sources like transfers, purchases, wastage, returns
- MVP:
  - Yes

### Team / Users

- v1 appears to support:
  - user creation
  - role changes
  - activate/deactivate
  - permissions editing
  - activity logs
  - deletion with admin helper
- v2 currently supports:
  - user model
  - auth flows
  - protected user endpoints
- missing in v2:
  - full team management frontend
  - permission matrix UI
  - activity log UI
- MVP:
  - Yes

### Settings

- v1 appears to support:
  - company profile and invoice settings
  - courier config
  - WooCommerce config
  - user settings
  - notifications/security/data management tabs
  - activity log tab
- v2 currently supports:
  - backend and frontend config foundations only
  - placeholder settings page
- missing in v2:
  - almost all settings UX and persistence
- MVP:
  - Partial, but not core for immediate parity after commerce modules

### POS

- v1 appears to support:
  - barcode scanning
  - walk-in customer sales
  - cart checkout
  - payment methods
  - invoice printing
  - stock updates
- v2 currently supports:
  - no POS module
- missing in v2:
  - full module
- MVP:
  - No

### Returns / RMA

- v1 appears to support:
  - RMA requests
  - status updates
  - refund transaction creation
  - inventory restocking on receipt
- v2 currently supports:
  - no returns module
- missing in v2:
  - full workflow
- MVP:
  - No, but strong next-phase candidate

### Suppliers

- v1 appears to support:
  - supplier master data
  - purchase orders
  - supplier ledger
  - supplier payments
- v2 currently supports:
  - no supplier module
- missing in v2:
  - full workflow
- MVP:
  - No, but important for parity after returns/logistics

### Logistics

- v1 appears to support:
  - courier integration
  - courier configs
  - delivery records
  - tracking
  - pending shipments
  - courier reconciliation
- v2 currently supports:
  - no logistics module
- missing in v2:
  - full workflow
- MVP:
  - No, but important operationally after core parity

### Finance

- v1 appears to support:
  - transactions
  - accounts
  - chart of accounts
  - petty cash
  - supplier payments
  - financial reports
- v2 currently supports:
  - no finance module
- missing in v2:
  - full workflow
- MVP:
  - No

### HR

- v1 appears to support:
  - designations
  - employees
  - attendance
  - salary advances
  - salary records
- v2 currently supports:
  - no HR module
- missing in v2:
  - full workflow
- MVP:
  - No

### Tasks

- v1 appears to support:
  - task CRUD
  - assignees
  - kanban/status workflow
  - notifications
- v2 currently supports:
  - no tasks module
- missing in v2:
  - full workflow
- MVP:
  - No

### Reports

- v1 appears to support:
  - sales reporting
  - inventory valuation
  - performance metrics
  - exports
  - AI/forecasting-related reporting helpers
- v2 currently supports:
  - no reports module
- missing in v2:
  - full workflow
- MVP:
  - No

### Inbox

- v1 appears to support:
  - a conversation UI
  - mock or early-stage multi-channel integration surfaces
  - channel configuration panels for Messenger, Instagram, WhatsApp
- v2 currently supports:
  - nothing
- missing in v2:
  - entire module
- MVP:
  - No
- note:
  - treat as explicitly excluded for now

## Current v2 Modules Already Implemented

These modules are present in the current v2 stack today:

- Auth
- Dashboard
- Categories
- Brands
- Products
- Customers
- Warehouses
- Inventory
- Orders
- Order Detail
- Stock Movements

## Exclusions For Now

These should be treated as intentionally out of scope for the next implementation cycle:

- Facebook AI Inbox Assistant
- Messenger webhook automation
- Instagram/WhatsApp automation
- OpenRouter AI reply assistant
- any brand new module not meaningfully implemented in v1

Also defer these until after core parity work:

- Inbox / social messaging operations
- AI reply tooling
- speculative automation-first modules
- broad greenfield features that are not grounded in v1 operational use

## Recommended Next 3 Phases

### Phase A: Team, Settings, and Product/Inventory Completion

Recommended scope:

- Team / Users frontend parity
- permission management UI
- product edit flow
- variant management UI
- inventory adjustment UX
- settings essentials needed by operations

Why next:

- this closes the main MVP admin gaps around governance and product maintenance
- it strengthens the modules already built instead of opening too many new fronts

### Phase B: Returns, Logistics, and Warehouse-Aware Order Operations

Recommended scope:

- Returns / RMA foundation
- order-to-warehouse assignment
- courier/logistics operational basics
- shipment and delivery state linkage

Why next:

- v1 clearly treated post-order operations as part of the day-to-day workflow
- current v2 order fulfillment is structurally good but still lacks downstream logistics parity

### Phase C: Suppliers, Purchasing, and Inventory Replenishment

Recommended scope:

- Suppliers
- purchase orders
- stock receiving / stock-in workflows
- supplier payments linkage later if needed

Why next:

- v1 inventory was not only sales-driven; it also had replenishment and procurement flows
- this phase closes a major operational loop missing in current v2

## Risk Notes

There are already areas where v2 is stronger than v1 structurally:

- PostgreSQL relational structure is cleaner than v1 Firestore denormalization
- JWT protected APIs are more explicit and backend-centric than v1 client-heavy access patterns
- stock movement ledger in v2 is more normalized than the multiple overlapping v1 log collections
- order fulfillment stock deduction is now explicit in backend workflow instead of relying on looser client-side behavior
- order detail is now a dedicated page instead of only modal-oriented handling

Current v2 risks or limitations relative to v1:

- orders still do not directly store warehouse selection, so fulfillment picks an available matching inventory row
- user/team management UI is behind the backend capability
- inventory, logistics, and returns are not yet as operationally deep as v1
- settings/integration management is still much lighter than v1

## Bottom Line

v2 already covers the operational commerce core better than a simple scaffold:

- auth
- dashboard
- catalog structure
- customers
- warehouses
- inventory
- orders
- stock movements

The highest-value parity work left is not random feature expansion. It is the disciplined completion of:

1. team/admin controls and product/inventory completion
2. returns plus logistics-aware order operations
3. supplier and purchasing workflows

That sequence matches actual v1 operational depth while keeping the current v2 architecture clean.
