# API Route Audit

Last reviewed: 2026-05-18

Requirement reset note:
- Backend routes remain functionally strong, but exact v1 workflow parity now requires a separate backend/workflow audit.
- Previous route expansion focused on safe operational coverage, not literal v1 Firebase workflow matching.
- See `docs/exact-v1-backend-workflow-parity-audit.md` and `docs/exact-v1-backend-gap-roadmap.md` for exact-clone planning.

Scope:
- app import validated after full Alembic migration chain
- route registration verified from `backend/app/api/routes/__init__.py`
- health endpoint smoke-tested with `GET /api/v1/health`

## Public Routes

| Group | Base path | Main endpoints | Access | Notes |
| --- | --- | --- | --- | --- |
| Health | `/api/v1/health` | `GET /health` | Public | Basic API smoke endpoint returning service status. |
| Auth | `/api/v1/auth` | `POST /register`, `POST /login`, `GET /me` | Mixed | Main user bootstrap and token issuance entrypoints. `/me` exposes the v1-shell-compatible current-user context. |

## Protected Route Groups

| Group | Base path | Main endpoints | Access | Notes |
| --- | --- | --- | --- | --- |
| Users | `/api/v1/users` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Team/user CRUD; permission assignment endpoints live separately. |
| Permissions | `/api/v1` | `GET /permissions`, `POST /permissions/seed-defaults`, `GET/PATCH /users/{id}/permissions` | Protected | Permission matrix exists, but frontend enforcement is still partial. |
| Notifications | `/api/v1/notifications` | `GET /`, `GET /unread-count`, `PATCH /{id}/read`, `PATCH /mark-all-read`, `POST /` | Protected | Phase 15B-support adds shell notification persistence with broadcast plus per-user visibility and a v1-friendly unread workflow. Create is admin-only for now. |
| Activity Logs | `/api/v1/activity-logs` | `GET /` | Protected | Filtered audit feed across implemented modules. |
| Admin Tools | `/api/v1/admin` | `GET /system-health`, `GET /backup-guidance`, `GET /maintenance-checklist`, `GET /exports/*` | Protected | Admin and super-admin focused release-readiness surface for health checks, exports, and backup guidance. |
| Settings | `/api/v1/settings` | `GET /business`, `PATCH /business` | Protected | Business and invoice display settings live here. |
| Invoice Templates | `/api/v1/invoice-templates` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}`, `POST /{id}/set-default` | Protected | Deactivate uses soft behavior. |
| Categories | `/api/v1/categories` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Standard master-data CRUD. |
| Brands | `/api/v1/brands` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Standard master-data CRUD. |
| Products | `/api/v1/products` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}`, variant CRUD | Protected | Includes product variant endpoints under the same route group. Phase `15E-support` adds v1-inventory-friendly aliases such as `productName`, `barcode`, `categoryName`, `brandName`, `stockLevel`, `reorderPoint`, `image`, `hasVariants`, and camelCase timestamps without changing the underlying product model. |
| Customers | `/api/v1/customers` | `GET /crm-summary`, `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}`, activity list/create/update | Protected | CRM activity timeline is included. Phase `15F-support` adds the split-pane CRM summary endpoint, denser customer list/detail aliases, richer activity aliases, v1-friendly create/update aliases, and extra CRM filters such as `segment`, `follow_up_due`, `tag`, `city`, and created-date range. |
| Warehouses | `/api/v1/warehouses` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Used by orders, inventory, logistics, and POS. Phase `15E-support` adds `location`, `status`, and camelCase timestamp aliases for the exact v1 inventory cards and modals. |
| Inventory | `/api/v1/inventory` | `GET /hub-summary`, `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `POST /{id}/adjust` | Protected | Inventory adjustment is handled here. Phase `15E-support` adds the inventory hub summary plus v1-style stock overview aliases on the existing list and detail endpoints. |
| Stock Movements | `/api/v1/stock-movements` | `GET /`, `GET /{id}` | Protected | Read-only ledger surface for adjustments, transfers, returns, orders, and POS. Phase `15E-support` extends it with v1-friendly log aliases and `variant_id` filtering. |
| Stock Transfers | `/api/v1/stock-transfers` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Internal warehouse transfer workflow. |
| Wastage Logs | `/api/v1/wastage-logs` | `GET /`, `GET /{id}`, `POST /` | Protected | No delete route; acts as an operational log. |
| Orders | `/api/v1/orders` | `GET /`, `GET /operations-summary`, `GET /dispatch-export`, `GET /duplicate-check`, `POST /batch-actions`, `GET /{id}`, `POST /`, `PATCH /{id}`, `GET /{id}/invoice-data`, `POST /{id}/mark-printed`, `POST /{id}/create-shipment` | Protected | Includes invoice payload, shipment creation handoff, operator-focused summary counts, dispatch CSV export, and safe batch actions. Phase `15D-support` extends the existing endpoints for the v1 orders cockpit instead of adding parallel routes: the list endpoint now includes dense row aliases plus month and date filters, the detail endpoint now includes modal-friendly summaries and action flags, the create endpoint accepts v1-style aliases, the duplicate-check endpoint returns warning-panel fields, and the operations summary now includes broader v1 status counts. Batch actions stay conservative and preserve the existing stock-deduction rules. |
| Returns | `/api/v1/returns` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Restock behavior depends on status/action flags. Phase `15E-support` adds inventory-hub-friendly aliases such as `returnNumber`, `orderNumber`, `customerName`, `warehouseName`, `refundState`, and `restockState`. |
| Couriers | `/api/v1/couriers` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Internal courier master-data only. Phase `15G-support` adds v1 logistics aliases such as `courierName`, `contactPhone`, `status`, `activeShipmentCount`, `deliveredCount`, and `pendingReconciliationCount`. |
| Shipments | `/api/v1/shipments` | `GET /`, `POST /batch-status-update`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Shipment lifecycle and reconciliation surface plus safe batch local-status updates. Phase `15G-support` adds v1 logistics aliases such as `shipmentNumber`, `orderNumber`, `customerName`, `courierName`, `statusLabel`, `pendingAmount`, camelCase timestamps, `logs`, and safe action flags, while the create and update payloads now accept v1-style camelCase aliases. Batch updates preserve existing timestamp behavior and do not trigger courier API calls. |
| Logistics | `/api/v1/logistics` | `GET /command-summary`, `GET /pending-dispatch`, `GET /operations-summary`, `GET /reconciliation-export` | Protected | Focused internal dispatch queue plus operations summary and reconciliation CSV export. Phase `15G-support` adds a v1 logistics command-summary endpoint and extends pending-dispatch rows with queue aliases and action flags for the exact command-center rebuild. Reconciliation stays internal-first even though Phase 13A adds separate manual external courier foundation routes. |
| Courier Integrations | `/api/v1/courier-integrations` | `GET /providers`, `GET /providers/{provider}/settings`, `PATCH /providers/{provider}/settings`, `POST /providers/{provider}/test-connection`, `POST /shipments/{shipment_id}/send`, `POST /shipments/{shipment_id}/sync-status`, `POST /status-sync/bulk`, `GET /logs` | Protected | External courier foundation with encrypted provider settings, manual shipment send, manual external status sync, bulk status sync, and sanitized API logs. Phase 13C hardens status sync with conservative external-to-internal mapping, conflict warnings, `apply_safe_status` opt-in behavior, and richer log filtering including message search. Phase `15G-support` adds v1 log-table-friendly fields such as `shipment_number`, `order_number`, `requestAt`, `createdAt`, and `response_summary`. Settings and logs are admin-only. No background worker or destructive remote-driven shipment mutation is included in this phase. |
| Suppliers | `/api/v1/suppliers` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Supplier foundation exists and is used by purchase orders and supplier payments. Phase `15E-support` adds `contactPerson`, `status`, and camelCase timestamp aliases for the embedded inventory supplier tab. |
| Purchase Orders | `/api/v1/purchase-orders` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Receiving integrates with inventory and stock movements. Phase `15E-support` adds aliases such as `poNumber`, `supplierName`, `warehouseName`, and `receivedState` for the exact v1 inventory procurement tab. |
| WooCommerce | `/api/v1/woocommerce` | `GET /settings`, `PATCH /settings`, `POST /test-connection`, `GET /products-preview`, `POST /products-import`, `POST /products/{local_product_id}/refresh`, `POST /products-refresh`, `GET /orders-preview`, `POST /orders-import`, `POST /orders/{local_order_id}/refresh`, `POST /orders-refresh`, `POST /run-sync`, `GET /sync-status`, `GET /sync-logs`, `GET /sync-logs/{id}` | Protected | Admin-only WooCommerce sync foundation with manual preview/import plus lifecycle-aware product and order refresh. Credentials are stored encrypted server-side, imported WooCommerce products and orders keep external references and safe payload snapshots, existing WooCommerce-linked rows can be refreshed without duplicate creation, Woo stock remains external-only visibility metadata, conflicts are logged as warnings instead of destructive overwrites, sync status exposes schedule/readiness metadata, and the integration remains read-only against WooCommerce with no production worker, no stock auto-deduction during order refresh, no destructive updates, and no push-back. |
| Accounts | `/api/v1/accounts` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Soft deactivate behavior for finance accounts. |
| Transactions | `/api/v1/transactions` | `GET /`, `GET /{id}`, `POST /` | Protected | Supports account/type/direction/date/search filters. |
| Petty Cash | `/api/v1/petty-cash` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Approval/settlement can create linked finance transactions. |
| Supplier Payments | `/api/v1/supplier-payments` | `GET /`, `GET /{id}`, `POST /` | Protected | Creates linked finance transactions when recorded. |
| Finance Summary | `/api/v1/finance` | `GET /summary` | Protected | Date-filtered practical finance overview; full accounting statements remain out of scope. |
| Tasks | `/api/v1/tasks` | `GET /summary`, `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Delete currently maps to cancellation workflow. |
| Designations | `/api/v1/designations` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | HR master-data with soft deactivate behavior. |
| Employees | `/api/v1/employees` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Delete uses soft inactive employment status. |
| Attendance | `/api/v1/attendance` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Duplicate employee/date protection is enforced. |
| Salary Advances | `/api/v1/salary-advances` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Approval stamps approver and time, but no finance posting yet. |
| Salary Records | `/api/v1/salary-records` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Net salary is calculated server-side; paid status stamps time. |
| HR Summary | `/api/v1/hr` | `GET /summary` | Protected | HR overview cards source. |
| POS | `/api/v1/pos` | `GET /products`, `POST /checkout`, `GET /summary` | Protected | Walk-in POS checkout ties into orders, stock, and optional finance capture; refunds, offline mode, and hardware integration are not included yet. |
| Reports | `/api/v1/reports` | `GET /sales-summary`, `GET /order-status`, `GET /payment-status`, `GET /inventory`, `GET /stock-movements-summary`, `GET /customers`, `GET /logistics`, `GET /integration-summary`, `GET /finance-summary`, `GET /top-products`, `GET /low-stock-products`, `GET /revenue-by-date`, `GET /recent-order-activity` | Protected | Reporting foundation exists but remains lighter than statement-grade analytics. Phase 14A adds a safe integration-health slice for WooCommerce and courier monitoring without adding destructive automation. |

## Validation Notes

- Fresh migration path was validated against a temporary PostgreSQL database using `alembic upgrade head`.
- App import succeeded after migration completion.
- `GET /api/v1/health` returned `200 OK`.
- Release-candidate backend validation on 2026-05-18 includes targeted Phase `15G-support` logistics compatibility coverage in addition to the earlier inventory and CRM support checks.
- Registered `/api/v1/*` route count at validation time: `159`.
