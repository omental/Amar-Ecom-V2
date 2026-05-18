# Exact V1 Backend Gap Roadmap

Last reviewed: 2026-05-18

## Scope

- v1 Firebase/Firestore workflow remains the reference behavior
- v2 FastAPI/PostgreSQL remains the technical base
- this roadmap classifies backend parity work before exact UI clone implementation
- previous backend passes improved safety and normalization, but were not built to reproduce v1 literally

## Requirement Reset

- Previous parity work optimized for strong backend foundations and safer operations.
- The client now requires `exact v1 clone behavior` where backend data, statuses, or side effects shape the UI workflow.
- This roadmap supersedes earlier backend parity assumptions where they conflict with the exact-clone requirement.

## A. Must Fix Before Exact UI Clone

### 15B-support: Shell, Auth, Permissions

Status: `Completed for backend foundation`

- Map v2 auth/session payloads to the v1 shell expectations for `active`, role, and module-level permissions.
- Decide whether to add Google auth parity or explicitly document a temporary approved exception before shell clone starts.
- Add notification backend support or an approved placeholder strategy for the exact notification drawer, unread count, and mark-read behavior.
- Expose any user profile fields the shell depends on, such as last-login or display-name compatibility.

Completed in this phase:

- `/api/v1/auth/me` now returns v1-shell-friendly user context
- `legacy_permissions` now maps normalized permission keys into the v1 module boolean shape
- notifications now have backend persistence plus unread-count and mark-read endpoints
- login now updates `last_login`

Remaining:

- Google auth parity is still open
- automatic notification generation is intentionally narrow for now

### 15C-support: Dashboard

- Provide a stable aggregation shape for the exact v1 dashboard card set so the frontend does not have to reconstruct every metric from scattered endpoints.
- Confirm which team-performance and activity slices are real data versus v1 mock aggregation, and only implement the real parity requirements.

### 15D-support: Orders

Status: `Completed for backend compatibility foundation`

- Align order status vocabulary with the v1 order workflow and badge labels.
- Expand order create/update schemas where required for the v1 new-order and edit-order form.
- Match duplicate-check behavior used by the v1 create flow.
- Confirm print-related fields and event semantics needed by the v1 orders list and detail modal.
- Expose any courier-ready order fields used directly from the v1 orders workflow.

Completed in this phase:

- `GET /api/v1/orders` now exposes dense v1-friendly row aliases and metadata for the orders cockpit.
- `GET /api/v1/orders/{id}` now exposes modal-friendly detail aliases, summaries, logs, and safe action flags.
- `GET /api/v1/orders/operations-summary` now includes v1 status-family counts such as `pending`, `confirmed`, `processing`, `ready_to_ship`, `shipped`, `delivered`, `cancelled`, `returned`, `partial_delivered`, `urgent`, and `hold`.
- `POST /api/v1/orders` now accepts the main v1 create-flow aliases without changing the underlying v2 model.
- `GET /api/v1/orders/duplicate-check` now returns the warning-panel row data needed by the v1 new-order flow.

Remaining:

- Some v1 helper inputs are accepted but intentionally not persisted as first-class columns.
- The exact modal-first edit loop and dense frontend choreography are still part of frontend Phase `15D`.
- Export and print presentation still need exact UI matching even though the backend print and event foundations are already in place.

### 15E-support: Inventory

Status: `Completed for backend compatibility foundation`

- Add any missing compatibility fields or summary payloads needed to rebuild the v1 all-in-one inventory hub.
- Decide whether product image upload parity will need backend storage support or a separate approved implementation path.
- Add missing inventory-adjacent support only where the v1 hub truly depends on it, especially around attributes if that tab remains in-scope for exact parity.

Completed in this phase:

- `GET /api/v1/inventory/hub-summary` now returns the cross-tab counts needed by the v1 inventory control center.
- `GET /api/v1/inventory` and `GET /api/v1/inventory/{id}` now expose flatter v1-style stock overview aliases including product, warehouse, category, brand, price, stock status, inventory value, last movement summary, and camelCase timestamps.
- `GET /api/v1/products` now exposes inventory-hub-friendly aliases such as `productName`, `barcode`, `categoryName`, `brandName`, `stockLevel`, `reorderPoint`, `image`, and `hasVariants`.
- `GET /api/v1/stock-movements` now exposes v1 log aliases plus variant filtering.
- Supplier, purchase-order, return, transfer, wastage, category, brand, and warehouse responses now include the alias fields the embedded inventory tabs need.

Remaining:

- No new backend `attributes` model was added because the v1 source did not prove that exact persistent backend support is required to unblock the first v2 inventory-hub rebuild.
- Product image upload remains URL-based in v2; Firebase Storage-style upload parity is still an explicit deviation.
- Barcode and label printing remain frontend-generated flows; backend PDF generation was intentionally not added.

### 15F-support: CRM

Status: `Completed for backend compatibility foundation`

- Expose customer summary and segment data in the exact shape required by the v1 split-pane CRM.
- Add any export support only if the v1 customer export behavior must be server-backed rather than client-derived.

Completed in this phase:

- `GET /api/v1/customers/crm-summary` now returns the v1 CRM KPI counts and spend rollups needed by the split-pane header cards.
- `GET /api/v1/customers` now exposes v1-friendly customer aliases and computed CRM fields such as `customerName`, `customerPhone`, `customerType`, `segment`, `tagList`, `totalOrderCount`, `totalSpend`, `lastOrderAt`, `lastOrderNumber`, `activityCount`, and `openActivityCount`.
- `GET /api/v1/customers/{id}` now exposes richer profile aliases, order-history aliases, activity timeline aliases, `averageOrderValue`, `followUpState`, and a `stats` summary block for the right pane.
- Customer create and update endpoints now accept v1-style aliases such as `customerName`, `customerPhone`, `customerType`, `followUpDate`, `lastContactedAt`, and tag arrays.
- Customer list filtering now covers the CRM workflow filters for `segment`, `follow_up_due`, `tag`, `city`, and created-date range without breaking the existing search or follow-up filters.

Remaining:

- No backend export endpoint was added because the v1 CRM screen generated CSV client-side from the loaded customer list.
- The v1 `points` badge and `active chats/messages` blocks are still frontend-side placeholders unless a later scope pass proves a real backend workflow behind them.

### 15G-support: Logistics, Returns, Suppliers

Status: `Completed for backend compatibility foundation`

- Map shipment, courier, and reconciliation statuses to the v1 logistics workspace language.
- Align return-status vocabulary with the v1 standalone returns flow.
- Add supplier-ledger style support if the exact supplier workspace requires backend-computed balances or joined payment history.
- Expose cross-module logistics payloads so the v1 single-screen command center can load from coherent backend surfaces.

Completed in this phase:

- `GET /api/v1/logistics/command-summary` now returns the command-center counts and COD or courier totals needed by the v1 logistics header cards.
- `GET /api/v1/logistics/pending-dispatch` now exposes v1 queue aliases such as `orderNumber`, `customerName`, `customerPhone`, `customerAddress`, `totalAmount`, `itemCount`, and action flags like `canCreateShipment`.
- `GET /api/v1/shipments` and `GET /api/v1/shipments/{id}` now expose v1-friendly aliases such as `shipmentNumber`, `orderNumber`, `customerName`, `courierName`, `trackingNumber`, `statusLabel`, `pendingAmount`, `sentToCourier`, event-log aliases, camelCase timestamps, and safe action flags.
- Shipment create or update payloads now accept v1-style camelCase aliases such as `shipmentNumber`, `orderId`, `courierId`, `recipientName`, `recipientPhone`, `deliveryAddress`, `deliveryCharge`, `courierCharge`, `codAmount`, `collectedAmount`, and `reconciliationStatus`.
- `GET /api/v1/couriers` now exposes v1 courier-card aliases such as `courierName`, `contactPhone`, `status`, `activeShipmentCount`, `deliveredCount`, and `pendingReconciliationCount`.
- `GET /api/v1/courier-integrations/logs` now exposes shipment and order references plus `requestAt`, `createdAt`, and `response_summary` while preserving sanitized payload snapshots and admin-only access.

Remaining:

- No new destructive courier automation was added; external sync remains manual, warning-first, and `apply_safe_status` still only auto-applies the safest local `delivered` transition.
- v1 `location` and `ETA` display values are still frontend-derived because the current v2 shipment model intentionally does not persist those Firestore-specific fields.
- Supplier ledger or finance-grade balance parity is still out of scope unless the later exact frontend logistics or supplier workspace proves it is truly required.

### 15H-support: Settings, Team, Activity

- Add any missing per-user settings/profile data required by the v1 settings center.
- Shape team/user payloads around v1 activation and permission editing expectations.
- Support embedded activity views used inside settings and team without forcing the frontend to depend only on the standalone activity route.
- Completed on `2026-05-18`.
- Added `GET /api/v1/settings/center-summary` for the grouped settings-center cards and readiness indicators.
- Extended `GET/PATCH /api/v1/settings/business` with v1 aliases such as `companyName`, `businessName`, `logoUrl`, `invoicePrefix`, `invoiceTitle`, `paymentInstructions`, `taxRate`, and `lowStockDefaultThreshold`.
- Extended `GET /api/v1/users`, `GET /api/v1/users/{id}`, `POST /api/v1/users`, and `PATCH /api/v1/users/{id}` with v1 team aliases plus alias input handling for `fullName`, `displayName`, `active`, `isActive`, and optional legacy permission payloads.
- Added `GET /api/v1/permissions/legacy-matrix` and `PATCH /api/v1/users/{id}/legacy-permissions` so the v1 boolean module-permission modal can stay intact on top of the normalized v2 access-control tables.
- Extended `GET /api/v1/activity-logs` with v1 log-table aliases plus `action`, `search`, `date_from`, and `date_to` filters for embedded Team and Settings activity views.
- Extended invoice-template responses and writes with v1 aliases such as `templateName`, `accentColor`, `headerText`, `footerText`, `termsText`, `paymentInstructions`, `isDefault`, and `isActive`.
- Known backend deviations remain:
  pending approval and inactive team states both currently map to `is_active=false`
  `photoURL` remains placeholder-only because there is still no persisted user-avatar workflow in v2
  broad per-user notification, security, mobile, and data-management preference persistence is still not first-class beyond the current business/admin settings model

## B. Can Emulate In Frontend

- Quick actions panel launch behavior and keyboard shortcuts
- Static quick links such as POS launch buttons
- Some list density, tab choreography, and modal sequencing where current backend data is already sufficient
- Barcode printing if it remains a client-generated workflow
- Notification placeholders only if the client explicitly approves a temporary non-backend exact-look shell
- Dashboard visual composition where the underlying counts already exist
- POS scanner, variant picker, and success-modal flow when they do not require additional server state

## C. Already Better In V2

- Safer stock movement model with canonical inventory mutation
- Warehouse-aware stock deduction and purchase-order receiving
- Normalized shipments and conservative courier sync behavior
- WooCommerce credential handling, payload snapshots, and conflict-safe refresh flows
- Structured permissions and activity logs
- Supplier payments and finance transaction linkage
- POS checkout integration with order, stock, and finance side effects
- Admin tools and system-health surfaces

Important:

- Keep these strengths.
- Prefer response shaping, field aliases, and status mapping over destructive backend simplification.
- Do not regress operational safety just to imitate v1 internals.

## D. Excluded

- Facebook AI inbox assistant
- Social automation and channel-connect prototype behavior
- Any mock-only conversation data from `Inbox.tsx`
- Mock performance aggregation that was never backed by a real production workflow
- Unconfirmed standalone WooCommerce admin behavior if the v1 route was not actually active

## Recommended Execution Order

1. `15B-support`
2. `15D-support`
3. `15E-support`
4. `15F-support`
5. `15G-support`
6. `15H-support`
7. `15C-support`
8. `15I-support`

## Current Backend Support Status

- `15D-support` is complete.
- `15E-support` is complete.
- `15F-support` is complete.
- `15G-support` is complete.
- `15H-support` is complete.
- The next likely backend parity phase is `15I-support`, unless the frontend `15H` rebuild uncovers one narrow additional compatibility need.
