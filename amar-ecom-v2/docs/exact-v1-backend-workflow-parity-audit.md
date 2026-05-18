# Exact V1 Backend + Workflow Parity Audit

Last reviewed: 2026-05-18

## Scope

This document resets backend parity planning around the client's updated requirement:

- v1 React/Firebase is the source of truth for screen behavior and operator workflow
- v2 FastAPI/PostgreSQL remains the implementation base
- this phase is audit and planning only
- no v1 source was modified
- no v2 backend or frontend code was changed in this phase

## Requirement Reset

- Previous backend work focused on strong normalized APIs and safer operations, not literal v1 workflow recreation.
- The client now requires `exact v1 clone behavior` wherever the v1 experience depended on backend fields, statuses, side effects, and in-place actions.
- This backend/workflow audit supersedes earlier parity assumptions wherever they conflict.

## Status Update

- `15B-support` is now implemented for backend compatibility.
- v2 now exposes `/api/v1/auth/me` with a v1-shell-friendly payload and legacy permission map.
- v2 now includes a notification backend with unread counts and mark-read actions for shell parity work.
- Remaining shell limitations are now mostly social-auth parity and exact notification generation breadth, not missing shell support primitives.
- `15D-support` is now implemented for orders backend compatibility.
- Existing order endpoints now expose dense v1-friendly order row aliases, modal-friendly detail aliases, extra status-summary counts, month/date filters, and create-schema aliases without replacing the underlying v2 order model.
- `15E-support` is now implemented for inventory backend compatibility.
- v2 now exposes an inventory hub summary endpoint plus v1-style aliases on inventory, product, stock movement, supplier, purchase-order, transfer, wastage, return, category, brand, and warehouse responses where the upcoming exact v1 Inventory Hub needs flatter data.
- `15F-support` is now implemented for CRM backend compatibility.
- v2 now exposes a CRM summary endpoint plus v1-style customer list, detail, activity, and alias support so the split-pane CRM can read denser relationship data without a model rewrite.
- `15G-support` is now implemented for logistics backend compatibility.
- `15H-support` is now implemented for settings, team, admin, and activity-log backend compatibility.
- v2 now exposes a logistics command summary plus v1-style pending-dispatch, shipment, courier, and courier-log aliases so the unified v1 logistics workspace can load from the existing safe shipment and courier foundation.

## Parity Scale

- `Exact`: v2 already exposes the same practical backend behavior needed by the v1 screen
- `Partial`: core capability exists, but fields, statuses, side effects, or action shape differ
- `Missing`: no direct backend support exists in v2
- `Better in v2`: v2 is stronger or safer than v1, but may still need field/status mapping for UI parity
- `Excluded / mock-only`: v1 feature is prototype, local-only, or not backed by real operational data

## Cross-App Findings

- v1 mixes real Firestore data, Firebase Auth, Firebase Storage, and local/mock fallbacks.
- v1 often stores workflow state directly on documents instead of via normalized side tables.
- v1 shell notifications, user approval, and permission gating are real app behavior, not just UI decoration.
- v2 is stronger in normalized stock, shipments, WooCommerce, permissions, and activity logs, but exact v1 screens still need compatibility fields, statuses, and action surfaces.
- Several v1 workflows are modal-heavy and expect read/write APIs that support in-place mutation without route changes.
- Some v1 modules, especially Inbox/social automation and parts of performance reporting, are prototype-heavy and should not be treated as required backend gaps unless the client explicitly expands scope.

## Module Audit

### Auth / Users / Permissions

1. v1 data source
   Firestore `users` collection plus Firebase Auth. `AuthContext.tsx` reads `users/{uid}`, sets `lastLogin`, creates new pending staff users, and grants full admin permissions to a special bootstrap email. No storage dependency found.
2. v1 actions/workflows
   Email login, Google login, registration, sign-out, auto-create Firestore user doc, admin approval through `active: false`, permission-gated routes, role-based full access for admins.
3. v1 fields
   `uid`, `name`, `email`, `role`, `active`, `permissions`, `createdAt`, `lastLogin`; Google-derived `displayName` can override name in-session.
4. v2 equivalent
   Models: `backend/app/models/user.py`, `backend/app/models/access_control.py`
   Routes: `backend/app/api/routes/auth.py`, `users.py`, `permissions.py`
   Schemas: `backend/app/schemas/user.py`, `permission.py`
   Services: `permission_service.py`, `activity_log_service.py`
5. parity status
   `Partial`
6. gaps
   Google auth and Firebase-style social auth flow are still missing. Approval semantics exist via `is_active`, and `/api/v1/auth/me` now exposes `active`, `is_active`, `uid`, `last_login`, `lastLogin`, `created_at`, `createdAt`, `display_name`, nullable photo fields, normalized permissions, and v1-style `legacy_permissions`. v2 permissions remain richer than v1 and are mapped rather than replaced.
7. implementation risk
   `High`
8. recommended backend phase
   `15B-support`

### Shell Notifications / Quick Actions

1. v1 data source
   Firestore `notifications` collection queried per user and rendered from `Layout.tsx`. Quick actions are largely UI-driven but notification state is real.
2. v1 actions/workflows
   Fetch notifications, filter unread/all, mark one as read, mark all as read, unread badge in shell, quick POS and action launchers.
3. v1 fields
   Notification `title`, `message`, `type`, `read`, `createdAt`, and user-targeting fields inferred from shell usage. Quick actions themselves do not require a dedicated backend model.
4. v2 equivalent
   Model: `backend/app/models/notification.py`
   Route: `backend/app/api/routes/notifications.py`
   Schema: `backend/app/schemas/notification.py`
   Service: `backend/app/services/notification_service.py`
5. parity status
   `Partial`
6. gaps
   Backend routes now cover list, unread count, single read, mark-all-read, and create. Remaining gap is breadth of automatic event generation and exact parity with every historical Firestore notification source. Quick actions remain mostly frontend-emulated.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15B-support`

### Dashboard Metrics

1. v1 data source
   Mixed Firestore reads from `orders`, `products`, `customers`, `users`, and low-stock inventory data. Some performance/team metrics also reference `performanceMetrics` and helper aggregation that is partly mock.
2. v1 actions/workflows
   Summary KPI fetch, month/custom range filtering, recent orders, low-stock alerts, best sellers, team activity.
3. v1 fields
   Order totals, delivery and payment status counts, product stock quantities, customer spend/order counts, activity timestamps, possible team KPI score values.
4. v2 equivalent
   Routes: `backend/app/api/routes/reports.py`, `orders.py`, `logistics.py`, `hr.py`, `finance.py`
   Services: query logic is route-local plus `inventory_service.py`
   Frontend route: `/dashboard`
5. parity status
   `Partial`
6. gaps
   Core metrics exist, but the exact v1 dashboard card set is split across multiple summary endpoints. Team-performance style data is not fully real in v1 and not represented as a dedicated v2 metric source. Recent activity may need a combined feed shaped closer to v1.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15C-support`

### Orders

1. v1 data source
   Firestore `orders` collection with direct document mutation from `Orders.tsx` and shared helpers. Related reads from `customers`, `couriers`, and settings-like data.
2. v1 actions/workflows
   Create, edit, delete-like cancel flows, status transitions, duplicate checks, print invoice, export, send to courier, batch-ish operational actions, row-level modal actions.
3. v1 fields
   `customerId`, `customerName`, `customerPhone`, `customerAddress`, `items`, `subtotal`, `deliveryCharge`, `discount`, `totalAmount`, `paidAmount`, `dueAmount`, `status`, `paymentMethod`, `paymentStatus`, `source`, timestamps; v1 also references richer operational fields such as print state, courier data, and embedded notes/tags.
4. v2 equivalent
   Model: `backend/app/models/order.py`
   Route: `backend/app/api/routes/orders.py`
   Schema: `backend/app/schemas/order.py`
   Service: `backend/app/services/inventory_service.py` for stock side effects
   Frontend route: `/dashboard/orders`
5. parity status
   `Partial`
6. gaps
   Core order CRUD is strong, but exact v1 field names differ. Phase `15D-support` closes most of the immediate clone blockers by extending `GET /api/v1/orders`, `GET /api/v1/orders/{id}`, `GET /api/v1/orders/operations-summary`, and `GET /api/v1/orders/duplicate-check` with v1-friendly aliases and denser metadata. `POST /api/v1/orders` now accepts camelCase and v1-form aliases such as `orderNumber`, `customerName`, `customerPhone`, `customerAddress`, `paymentMethod`, `deliveryCharge`, `paidAmount`, `totalAmount`, and item aliases like `productId`, `productName`, and `unitPrice`. Remaining gaps are mostly UI-side exact modal choreography plus non-persisted v1 helper inputs such as city, zone, district, division, area, landmark, courier-name, tracking-number, custom shipment number, and exchange hints, which are accepted for compatibility but not stored as first-class order columns.
7. implementation risk
   `High`
8. recommended backend phase
   `15D-support`

### Order Detail / Modal

1. v1 data source
   Firestore `orders` plus related customer, shipment, and timeline-like data rendered in `OrderDetailsModal.tsx`.
2. v1 actions/workflows
   Open detail modal, inspect items/totals/status, print, send to courier, edit, review history, remain inside orders screen.
3. v1 fields
   Order summary fields, customer/shipping blocks, item rows, status stepper labels, source labels including WooCommerce, action timestamps, print state.
4. v2 equivalent
   Model: `order.py` plus shipment linkage
   Route: `orders.py` with `GET /{id}`, `GET /{id}/invoice-data`, `POST /{id}/mark-printed`, `POST /{id}/create-shipment`
   Schema: `order.py`
5. parity status
   `Partial`
6. gaps
   Backend detail reads now expose v1-friendly modal payload helpers directly from `GET /api/v1/orders/{id}`: `customer_summary`, `shipping_summary`, `totals_summary`, `logs`, `shipment_summary`, `courierName`, `trackingNumber`, `dueAmount`, and safe `action_flags` including `can_print`, `can_edit`, `can_create_shipment`, `can_refresh_woo`, `can_deduct_stock_by_status`, `can_cancel`, and `can_mark_delivered`. Remaining gap is frontend modal-first presentation rather than missing backend detail data.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15D-support`

### New Order

1. v1 data source
   Firestore `orders`, `products`, `customers`, `couriers`, and likely `deliveries` lookups. Some helper behavior is UI-local.
2. v1 actions/workflows
   Product search, duplicate order check, customer/address entry, courier history lookup, smart address parsing, save order, optional courier-ready metadata, edit via the same form.
3. v1 fields
   Customer identity and address fields, items array, pricing fields, notes, status, payment fields, possible courier/location metadata, duplicate-sensitive phone/address values.
4. v2 equivalent
   Model: `order.py`
   Route: `orders.py` including `GET /duplicate-check` and `POST /`
   Schema: `order.py`
5. parity status
   `Partial`
6. gaps
   Exact create/edit field set is broader in v1 than the native v2 schema, but `15D-support` now accepts the main v1 form aliases safely on the existing create endpoint and keeps duplicate checks warning-only. The duplicate-check response now includes `orderNumber`, customer name, phone, address, total, status, and created-at aliases needed by the v1 warning panel. Courier-assisted create helpers still remain UI-side unless a later exact-clone pass proves a dedicated backend helper is necessary.
7. implementation risk
   `High`
8. recommended backend phase
   `15D-support`

### Order Status Vocabulary Mapping

- Native and counted directly: `pending`, `confirmed`, `processing`, `ready_to_ship`, `shipped`, `delivered`, `cancelled`, `returned`, `partial_delivered`, `urgent`, `hold`
- Stock deduction behavior remains conservative and unchanged:
  - deduction still occurs only when moving from pre-fulfillment states into `shipped` or `delivered`
  - `urgent`, `hold`, and `partial_delivered` are exposed for exact v1 UI parity, but they do not bypass the existing v2 safety rules
- `urgent` and `hold` should currently be treated as display or workflow states rather than special destructive fulfillment transitions

### Inventory Hub

1. v1 data source
   Firestore `products`, `variants`, `inventory`, `inventoryLogs`, `stockLedger`, `stock_logs`, `categories`, `brands`, `warehouses`, `purchaseOrders`, `purchaseBatches`, `suppliers`, `returnRequests`, `stock_transfers`, `wastage_logs`, and `settings` defaults. Firebase Storage is used for product image upload.
2. v1 actions/workflows
   Switch tab in one route, create/edit/delete master data, adjust stock, transfer stock, record wastage, receive purchase orders, open returns, export products, upload product images.
3. v1 fields
   Product identity, cost/sale pricing, stock levels, reorder point, warehouse stock, category/brand references, log metadata, transfer references, wastage reason, purchase receiving values, image URLs.
4. v2 equivalent
   Models: `product.py`, `inventory.py`, `inventory_ops.py`, `stock_movement.py`, `supplier.py`, `return_request.py`, `warehouse.py`, `category.py`, `brand.py`
   Routes: `products.py`, `inventory.py`, `stock_movements.py`, `stock_transfers.py`, `wastage_logs.py`, `purchase_orders.py`, `suppliers.py`, `returns.py`
   Schemas: corresponding inventory/product/supplier/return schemas
   Service: `inventory_service.py`
5. parity status
   `Partial`
6. gaps
   Phase `15E-support` closes the main backend blocker by adding `GET /api/v1/inventory/hub-summary`, enriching `GET /api/v1/inventory` with v1-friendly stock-row aliases, and extending adjacent schemas so the monolithic v1-style hub can load flatter tab payloads without destructive model changes. Remaining gaps are limited to the `attributes` tab persistence decision, Firebase Storage image-upload parity, and exact v1 barcode/label UX, which is frontend-side unless later scope proves otherwise.
7. implementation risk
   `High`
8. recommended backend phase
   `15E-support`

### CRM

1. v1 data source
   Firestore `customers` collection plus direct `orders` lookups by `customerPhone`. Export is client-side CSV from the loaded list. No separate backend conversation store is used by the core CRM screen.
2. v1 actions/workflows
   Split-pane customer browsing, search, select-customer detail pane, add/edit/delete customer modal, segment badges, order history review, items-bought visibility, and lightweight relationship follow-up notes.
3. v1 fields
   Customer profile: `name`, `phone`, `email`, `address`, `orderCount`, `totalSpent`, `lastOrderDate`, `points`, `createdAt`, `segment`, `tags`, `notes`, `followUpDate`.
   Detail side uses customer contact info, segment badge, order history rows, item history derived from order items, and basic messaging placeholders.
4. v2 equivalent
   Models: `backend/app/models/customer.py`, `backend/app/models/order.py`
   Route: `backend/app/api/routes/customers.py`
   Schemas: `backend/app/schemas/customer.py`
   Related report route: `backend/app/api/routes/reports.py`
5. parity status
   `Partial`
6. gaps
   Phase `15F-support` closes the main backend blockers by adding `GET /api/v1/customers/crm-summary`, enriching `GET /api/v1/customers` with split-pane list aliases and computed order or activity stats, extending `GET /api/v1/customers/{id}` with profile aliases, order-history aliases, CRM stats, and activity timeline aliases, and allowing v1-style create or update input aliases such as `customerName`, `customerPhone`, `customerType`, `followUpDate`, `lastContactedAt`, and tag arrays. Remaining deviation is export: v1 handled CRM export client-side, so no new backend export endpoint was added.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15F-support`

### Products

1. v1 data source
   Firestore `products`, `variants`, `inventory`, `categories`, `brands`, plus Firebase Storage for image upload.
2. v1 actions/workflows
   Create/edit product, variant-aware inventory, barcode printing, stock adjustment, delete product, upload image.
3. v1 fields
   `sku`, `name`, `category`, `brand`, `price`, `costPrice`, `stockLevel`, `reorderPoint`, `warehouseId`, `hasVariants`, image fields, barcode-related display data.
4. v2 equivalent
   Model: `backend/app/models/product.py`
   Route: `backend/app/api/routes/products.py`
   Schema: `backend/app/schemas/product.py`
5. parity status
   `Partial`
6. gaps
   Core product CRUD now exposes v1-friendly aliases such as `productName`, `barcode`, `categoryName`, `brandName`, `salePrice`, `costPrice`, `stockLevel`, `reorderPoint`, `lowStockThreshold`, `image`, `imageUrl`, `hasVariants`, `variantsCount`, `createdAt`, and `updatedAt`. Remaining gap is real storage-backed upload parity; the backend still exposes URL-based image fields only.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15E-support`

### Categories

1. v1 data source
   Firestore `categories`
2. v1 actions/workflows
   Add, edit, delete from inside inventory.
3. v1 fields
   Name, optional description, timestamps, usage adjacency to products.
4. v2 equivalent
   Model: `category.py`
   Route: `categories.py`
   Schema: `category.py`
5. parity status
   `Exact`
6. gaps
   Structural route differences are frontend-only. Backend CRUD is sufficient for v1 parity.
7. implementation risk
   `Low`
8. recommended backend phase
   `15E-support`

### Brands

1. v1 data source
   Firestore `brands`
2. v1 actions/workflows
   Add, edit, delete from inside inventory.
3. v1 fields
   Name, optional description/logo-like metadata if used in UI.
4. v2 equivalent
   Model: `brand.py`
   Route: `brands.py`
   Schema: `brand.py`
5. parity status
   `Exact`
6. gaps
   No major backend gap found for v1 parity.
7. implementation risk
   `Low`
8. recommended backend phase
   `15E-support`

### Warehouses

1. v1 data source
   Firestore `warehouses`
2. v1 actions/workflows
   Add, edit, delete warehouse, use warehouse immediately in stock and order workflows.
3. v1 fields
   Warehouse name, address/contact, active state, optional notes.
4. v2 equivalent
   Model: `warehouse.py`
   Route: `warehouses.py`
   Schema: `warehouse.py`
5. parity status
   `Partial`
6. gaps
   Backend CRUD remains sufficient, and v2 now exposes `location`, `status`, `createdAt`, and `updatedAt` aliases to support the v1 warehouse cards and modals. Exact v1 freeform warehouse description behavior still needs frontend-only handling because v2 does not add a separate warehouse description column.
7. implementation risk
   `Low`
8. recommended backend phase
   `15E-support`

### Stock Logs / Movements

1. v1 data source
   Firestore `inventoryLogs`, `stockLedger`, `stock_logs`, `stock_transfers`, `wastage_logs`, and inventory documents.
2. v1 actions/workflows
   Adjust stock, transfer stock, record wastage, receive stock from PO, review logs.
3. v1 fields
   Quantity delta, before/after stock, warehouse, reason, user, transfer refs, PO refs, timestamps.
4. v2 equivalent
   Models: `inventory.py`, `stock_movement.py`, `inventory_ops.py`
   Routes: `inventory.py`, `stock_movements.py`, `stock_transfers.py`, `wastage_logs.py`, `purchase_orders.py`
   Service: `inventory_service.py`
5. parity status
   `Partial`
6. gaps
   v2 keeps the safer canonical movement model and now exposes v1-friendly log aliases plus product, warehouse, SKU, reason, and `createdAt` helpers. Product, warehouse, movement-type, variant, and date filtering are available on `GET /api/v1/stock-movements`. A single merged v1-style log feed across transfers, wastage, and inventory logs is still a frontend composition choice rather than a required new backend route.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15E-support`

### Customers / CRM

1. v1 data source
   Firestore `customers` plus related `orders`. Customer panel also derives repeat/VIP behavior from order history.
2. v1 actions/workflows
   Create/edit/delete customer, select customer in split pane, fetch related orders/items, export customers, WhatsApp/email quick actions.
3. v1 fields
   `name`, `phone`, `email`, `address`, `orderCount`, `totalSpent`, `lastOrderDate`, customer segment labels such as `VIP`, `Repeat`, `At Risk`, `New Customer`.
4. v2 equivalent
   Model: `customer.py`
   Route: `customers.py`
   Schema: `customer.py`
   Frontend routes: `/dashboard/customers`, `/dashboard/customers/[id]`
5. parity status
   `Partial`
6. gaps
   v2 has strong customer CRUD and activity support, but exact v1 customer segment fields are not stored in the same way. Some v1 panel metrics are computed in-screen and may need explicit backend summaries for exact clone behavior. Export parity is not clearly exposed as a dedicated endpoint.
7. implementation risk
   `High`
8. recommended backend phase
   `15F-support`

### Logistics

1. v1 data source
   Firestore `deliveries`, `couriers`, `orders`, `courier_logs`, and logistics settings-like data.
2. v1 actions/workflows
   Manage pending ready-to-ship queue, create/edit shipments, add/edit couriers, sync courier status, export reconciliation, inspect API logs.
3. v1 fields
   Shipment number, order reference, courier reference, tracking, status, cod/charge fields, reconciliation states, sync timestamps, API log success/failure.
4. v2 equivalent
   Models: `courier.py`, `courier_integration.py`, `order.py`
   Routes: `logistics.py`, `shipments.py`, `couriers.py`, `courier_integrations.py`
   Services: `courier_service.py`
5. parity status
   `Exact`
6. gaps
   Phase `15G-support` closes the main backend blocker by adding `GET /api/v1/logistics/command-summary`, extending `GET /api/v1/logistics/pending-dispatch` with v1 queue aliases and action flags, extending shipment and courier payloads with v1-style aliases, and exposing courier API log rows with shipment and order references plus response summaries. Remaining deviation is mostly presentation-side: v1 `location` and `ETA` are still frontend-derived rather than first-class shipment columns, and the embedded courier cards still rely on the existing conservative provider-settings workflow rather than legacy Firestore config docs.
7. implementation risk
   `High`
8. recommended backend phase
   `15G-support`

### Couriers

1. v1 data source
   Firestore `couriers`
2. v1 actions/workflows
   Add/edit/delete courier, activate/deactivate, configure courier partner cards.
3. v1 fields
   Name, contact, API-enabled flags, active flags, connection status hints.
4. v2 equivalent
   Model: `courier.py`
   Route: `couriers.py`
   Schema: `courier.py`
5. parity status
   `Exact`
6. gaps
   Courier rows now expose `courierName`, `contactPhone`, `status`, `activeShipmentCount`, `deliveredCount`, `pendingReconciliationCount`, and camelCase timestamps. Provider connectivity remains intentionally separate and admin-gated via courier-integration settings so the exact frontend can merge partner cards without weakening the current security model.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15G-support`

### Shipments

1. v1 data source
   Firestore `deliveries` and order-linked shipment metadata.
2. v1 actions/workflows
   Add/edit/delete shipment, sync status, inspect courier/tracking state.
3. v1 fields
   `orderId`, `courierId`, `trackingNumber`, `status`, `lastUpdate`, recipient/cod/charge fields.
4. v2 equivalent
   Shipment model lives in `backend/app/models/courier.py`
   Route: `backend/app/api/routes/shipments.py`
   Schema: `backend/app/schemas/courier.py`
   Service: `courier_service.py`
5. parity status
   `Exact`
6. gaps
   Shipment list and detail payloads now expose v1-friendly aliases such as `shipmentNumber`, `orderNumber`, `customerName`, `courierName`, `trackingNumber`, `statusLabel`, `pendingAmount`, `sentToCourier`, camelCase timestamps, `logs`, and safe action flags. Create and update schemas also accept v1-style camelCase aliases like `shipmentNumber`, `orderId`, `courierId`, `deliveryCharge`, `courierCharge`, `codAmount`, `collectedAmount`, and `reconciliationStatus`.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15G-support`

### Returns

1. v1 data source
   Firestore `rma_requests` in standalone returns plus `returnRequests` inside inventory-related workflows.
2. v1 actions/workflows
   Create RMA, approve, receive, refund, reject, search by order or RMA id, inline progression actions.
3. v1 fields
   Return id/RMA id, order reference, customer, items, reason, refund amount, approval/receive/refund statuses, timestamps.
4. v2 equivalent
   Model: `return_request.py`
   Route: `returns.py`
   Schema: `return_request.py`
5. parity status
   `Partial`
6. gaps
   Status vocabulary is the clearest mismatch. v1 uses `pending`, `approved`, `received`, `refunded`, `rejected`; v2 uses a stronger normalized return model with different default/status semantics and optional restock flows. The UI clone likely needs explicit status mapping or a compatibility layer.
7. implementation risk
   `High`
8. recommended backend phase
   `15G-support`

### Suppliers

1. v1 data source
   Firestore `suppliers`, `supplierPayments`, and linked `purchaseOrders`.
2. v1 actions/workflows
   Add/edit/delete supplier, open supplier ledger, record payment, create purchase order.
3. v1 fields
   Supplier profile fields, running balance/ledger rows, payments, PO status counts.
4. v2 equivalent
   Model: `supplier.py`, finance supplier-payment models
   Routes: `suppliers.py`, `supplier_payments.py`
   Schemas: `supplier.py`, `finance.py`
   Services: `finance_service.py`
5. parity status
   `Partial`
6. gaps
   Supplier CRUD and payments exist, but no dedicated supplier ledger endpoint was found. The v1 supplier screen expects payment history and procurement context to be adjacent and easy to fetch together.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15G-support`

### Purchase Orders

1. v1 data source
   Firestore `purchaseOrders`, `purchaseBatches`, `suppliers`, `inventory`
2. v1 actions/workflows
   Create PO, edit, receive stock, view status, link back to supplier and inventory receiving.
3. v1 fields
   PO number, supplier, warehouse, ordered quantity, received quantity, unit cost, totals, status, expected date, notes.
4. v2 equivalent
   Model: `supplier.py` purchase-order entities
   Route: `purchase_orders.py`
   Schema: `supplier.py`
   Service: `inventory_service.py`
5. parity status
   `Partial`
6. gaps
   Core receiving and stock side effects are already stronger in v2. Main parity gaps are exact field/status naming, supplier-adjacent ledger context, and support for the embedded v1 procurement workflow rather than a standalone route-first flow.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15G-support`

### Reports

1. v1 data source
   Mixed Firestore aggregates across orders, stock, performance, HR, and finance-like data. Some performance comparisons are partly mock.
2. v1 actions/workflows
   Date filtering, valuation views, role-based comparisons, executive summary cards, top sellers, dead stock, stock ledger excerpts.
3. v1 fields
   Sales totals, top products, stock valuation, dead stock, employee KPI/performance figures, period comparisons.
4. v2 equivalent
   Route: `reports.py`
   Schemas: `reports.py`
   Supporting routes: `finance.py`, `hr.py`, `orders.py`, `logistics.py`
5. parity status
   `Partial`
6. gaps
   v2 reporting is broad and practical, but it does not follow the exact v1 executive taxonomy. Human-capital performance slices in v1 include partially mock aggregation and should not be over-counted as a hard backend gap unless the client wants them fully real.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15I-support`

### Finance

1. v1 data source
   Firestore `accounts`, `transactions`, `supplierPayments`, `petty_cash`; some statements are assembled in UI-level workflows and modal reports.
2. v1 actions/workflows
   Add account, add transaction, record supplier payment, petty cash issue/settle, launch profit-and-loss, balance sheet, cash flow modals, AR/AP views.
3. v1 fields
   Account code/type, transaction number, type, category, amount, direction, supplier payment refs, petty cash refs, status labels like completed/pending.
4. v2 equivalent
   Models: `finance.py`, `supplier.py`
   Routes: `accounts.py`, `transactions.py`, `supplier_payments.py`, `petty_cash.py`, `finance.py`
   Schemas: `finance.py`
   Service: `finance_service.py`
5. parity status
   `Better in v2`
6. gaps
   v2 finance foundation is safer and more normalized, but exact v1 report-modal payloads, status wording, AR/AP grouping, and chart-of-accounts presentation may need response shaping. Full accounting statements are still lighter than the v1 modal expectations.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15I-support`

### HR

1. v1 data source
   Firestore `designations`, `employees`, `attendance`, `salaryAdvances`, `salaryRecords`, and sometimes `users`.
2. v1 actions/workflows
   Add designation, add employee, mark attendance, grant salary advance, generate salary, open profile modal, update statuses.
3. v1 fields
   Employee code, profile/contact fields, designation, salary, attendance state, advance status, salary-record status.
4. v2 equivalent
   Models: `hr.py`, `user.py`
   Routes: `designations.py`, `employees.py`, `attendance.py`, `salary_advances.py`, `salary_records.py`, `hr.py`
   Schemas: `hr.py`
5. parity status
   `Partial`
6. gaps
   Core domain support exists. Main gaps are status label alignment, modal-oriented support payloads, and potential differences in generated salary workflow expectations. v2 intentionally uses normalized lowercase statuses instead of the v1 presentation language.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15I-support`

### POS

1. v1 data source
   Firestore `products`, `inventory`, `customers`, `orders`, `transactions`
2. v1 actions/workflows
   Search product, add to cart, attach/select customer, choose payment method, complete sale, show receipt, deduct stock.
3. v1 fields
   POS item rows, cart totals, payment method, paid/due values, customer fields, stock per warehouse, receipt/invoice identifiers.
4. v2 equivalent
   Models: order/inventory/finance models
   Route: `pos.py`
   Schemas: `pos.py`
   Services: `inventory_service.py`, `finance_service.py`
5. parity status
   `Better in v2`
6. gaps
   Backend support is strong for checkout, stock deduction, and optional finance posting. Exact v1 POS clone may still need payment/status label mapping and support for UI-only modal helpers such as scanner/variant selection, but these are mostly not backend blockers.
7. implementation risk
   `Low`
8. recommended backend phase
   `15I-support`

### Settings

1. v1 data source
   Firestore `settings` docs including company settings and user-scoped docs such as `settings/user_<uid>`, plus activity-log and integration-adjacent data.
2. v1 actions/workflows
   Save general/company/account/notification/SMS/security/integration/data/mobile-app settings, export all data, review activity logs, trigger sensitive confirmations.
3. v1 fields
   Company identity fields, user preference fields, notification toggles, SMS config, security toggles, integration switches, export controls.
4. v2 equivalent
   Models: `business_settings.py`, `invoice_template.py`, `woocommerce.py`, `courier_integration.py`
   Routes: `settings.py`, `invoice_templates.py`, `woocommerce.py`, `courier_integrations.py`, `admin.py`, `activity_logs.py`
   Schemas: matching settings and integration schemas
5. parity status
   `Mostly ready after 15H-support`
6. gaps
   Phase `15H-support` closes the main backend blocker by adding `GET /api/v1/settings/center-summary`, extending `GET/PATCH /api/v1/settings/business` with v1 aliases such as `companyName`, `businessName`, `logoUrl`, `invoicePrefix`, `invoiceTitle`, `paymentInstructions`, `taxRate`, and `lowStockDefaultThreshold`, and leaving the broader admin/export workflow additive rather than destructive. Remaining deviations are mostly breadth-related: per-user account, notification, mobile, and security preferences are still not stored as first-class backend rows, and v1's export-all-data button still maps best to the existing admin export surfaces rather than a new destructive center route.
7. implementation risk
   `Low`
8. recommended backend phase
   `15H-support`

### Team / Users

1. v1 data source
   Firebase Auth plus Firestore `users`
2. v1 actions/workflows
   Add member, activate/deactivate, edit role, edit permission matrix, delete member, inspect member activity.
3. v1 fields
   `name`, `email`, `role`, `active`, `permissions`, `lastLogin`, user identity metadata.
4. v2 equivalent
   Models: `user.py`, `access_control.py`
   Routes: `users.py`, `permissions.py`, `activity_logs.py`
   Schemas: `user.py`, `permission.py`, `activity_log.py`
5. parity status
   `Mostly ready after 15H-support`
6. gaps
   Phase `15H-support` closes the main backend blocker by extending `/api/v1/users` and `/api/v1/users/{id}` with aliases such as `uid`, `displayName`, `fullName`, `active`, `isActive`, `status`, `pendingApproval`, `permissions`, `legacyPermissions`, `hasFullAccess`, `lastLogin`, `photoURL`, and camelCase timestamps. It also adds `GET /api/v1/permissions/legacy-matrix` and `PATCH /api/v1/users/{id}/legacy-permissions` so the v1 boolean module-permission modal can stay intact without flattening the normalized permission tables. Remaining deviation is approval semantics: pending and inactive both still map to `is_active=false` because v1 used looser Firebase document conventions than the current relational user model.
7. implementation risk
   `Low`
8. recommended backend phase
   `15H-support`

### Activity Logs

1. v1 data source
   Firestore `activityLogs` plus embedded activity-like feeds in team/settings.
2. v1 actions/workflows
   Review recent actions from inside team/settings contexts. Primarily read-only.
3. v1 fields
   User, action, message, module, timestamp, entity reference.
4. v2 equivalent
   Model: activity log model registered via `models/__init__.py`
   Route: `activity_logs.py`
   Schema: `activity_log.py`
   Service: `activity_log_service.py`
5. parity status
   `Ready for exact v1 embedded use after 15H-support`
6. gaps
   Phase `15H-support` closes the main backend blocker by extending `GET /api/v1/activity-logs` with `action`, `search`, `date_from`, and `date_to` filters plus aliases such as `userName`, `userEmail`, `actionLabel`, `moduleLabel`, `entityType`, `entityId`, `message`, and `createdAt`. No destructive log mutation was added.
7. implementation risk
   `Low`
8. recommended backend phase
   `15H-support`

### WooCommerce

1. v1 data source
   `WooCommerceOrders.tsx` exists, but no active route was confirmed in `src/App.tsx`. Some order rows and detail views in v1 also show WooCommerce source labels.
2. v1 actions/workflows
   Unclear as a first-class routed module. Likely source-label display and some imported-order visibility rather than a fully separated admin flow.
3. v1 fields
   External source labels, imported order numbers, sync-related metadata where surfaced.
4. v2 equivalent
   Models: `woocommerce.py`, order/product external sync fields
   Route: `woocommerce.py`
   Schemas: `woocommerce.py`, `order.py`, `product.py`
   Service: `woocommerce_service.py`
5. parity status
   `Better in v2`
6. gaps
   v2 integration is more complete and safer than confirmed v1 behavior. Main parity question is not backend capability, but whether the standalone admin route should be secondary if exact v1 route exposure is required.
7. implementation risk
   `Low`
8. recommended backend phase
   `15I-support`

### Courier Integrations

1. v1 data source
   Embedded in `Logistics.tsx` using `couriers`, `courier_logs`, and shipment-linked sync behavior.
2. v1 actions/workflows
   Configure courier cards, inspect API logs, sync shipment statuses, connect or toggle courier integration behavior.
3. v1 fields
   Provider/partner name, connected state, active state, log status, last sync timestamps, tracking refs.
4. v2 equivalent
   Models: `courier_integration.py`, shipment external fields, courier API logs
   Route: `courier_integrations.py`
   Schemas: `courier_integration.py`, `courier.py`
   Service: `courier_service.py`
5. parity status
   `Better in v2`
6. gaps
   Backend safety is stronger in v2 and should be kept. Exact clone work mainly needs field and status mapping so the v1 logistics UI can consume provider state and logs from one workspace.
7. implementation risk
   `Medium`
8. recommended backend phase
   `15G-support`

### Inbox / Social Automation

1. v1 data source
   `src/components/Inbox.tsx` uses `mockConversations` and UI-local prototype state. No real Firestore or backend workflow was confirmed for the AI inbox assistant/social automation behavior.
2. v1 actions/workflows
   Prototype conversation UI, channel-connect modal, AI assistant framing, reply drafts, tags/flags.
3. v1 fields
   Mock conversation fields, message arrays, social channel placeholders.
4. v2 equivalent
   No matching backend route found. Existing CRM/customer routes do not represent this feature.
5. parity status
   `Excluded / mock-only`
6. gaps
   Should not be treated as a required backend parity gap unless the client explicitly promotes this prototype into scope.
7. implementation risk
   `Low`
8. recommended backend phase
   `Excluded`

## Top Backend / Workflow Mismatches

1. Auth parity: v1 depends on Firebase Auth, Google login, pending approval, and Firestore `users` docs with boolean module permissions.
2. Shell notifications: v1 notification drawer uses real Firestore data, but v2 has no notification backend route yet.
3. Orders create/edit parity: v2 order APIs are strong, but exact v1 fields, status names, duplicate checks, and courier-assisted create flow are not fully aligned.
4. Returns status model: v1 RMA progression labels differ materially from the stronger normalized v2 return workflow.
5. CRM summaries and segmentation: v1 master-detail flow expects customer summary data and segments in a legacy shape.
6. Inventory hub remaining gaps: backend aggregation and response shaping are now in place, but attributes persistence, storage-backed image upload, and exact barcode/label UX decisions remain.
7. Supplier ledger and settings-center breadth: v1 expects embedded supplier balances/payments and broader settings/account preferences than current route shapes expose.

## Must Fix Before Exact UI Clone

- Auth approval and permission payload mapping used by the shell and protected routes
- Notification backend or an explicit approved placeholder strategy for the exact shell clone
- Order status vocabulary and create/edit payload parity
- Duplicate-check behavior required by the v1 new-order flow
- Return-status mapping required by the v1 returns list and inline progression actions
- Any missing customer summary/segment fields required for the v1 CRM split pane
- Any missing aggregation payloads needed to rebuild the v1 inventory and logistics hubs without excessive frontend re-derivation

## Better In V2 And Worth Preserving

- Canonical stock movement tracking and warehouse-safe inventory mutation
- Shipment normalization and conservative courier sync behavior
- WooCommerce credential storage and sync safety
- Normalized permissions and activity logging foundation
- POS checkout stock and finance side effects
- Purchase-order receiving and finance transaction linkage

## Mock / Excluded Areas

- Inbox/social automation remains prototype or mock-only in v1 and should stay excluded unless scope changes
- Some team-performance and executive reporting slices rely on mock aggregation and should not be treated as mandatory backend gaps by default
- WooCommerce as a dedicated routed admin surface is uncertain in v1; treat route exposure as a UX decision, not an automatic backend deficiency

## Recommended First Backend Support Phase

`15B-support`

Reason:

- Exact shell restoration depends on real auth semantics, permission payloads, and notification behavior
- The shell is the first shared surface the user will see during clone phases
- If shell auth and notification behaviors remain mismatched, later screen-level parity work will sit on the wrong operational foundation

Current state:

- The backend foundation for `15B-support` is now in place.
- Remaining shell work is primarily frontend clone implementation plus any later decision on Google auth parity.
