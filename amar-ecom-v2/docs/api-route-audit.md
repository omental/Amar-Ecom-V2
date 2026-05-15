# API Route Audit

Last reviewed: 2026-05-12

Scope:
- app import validated after full Alembic migration chain
- route registration verified from `backend/app/api/routes/__init__.py`
- health endpoint smoke-tested with `GET /api/v1/health`

## Public Routes

| Group | Base path | Main endpoints | Access | Notes |
| --- | --- | --- | --- | --- |
| Health | `/api/v1/health` | `GET /health` | Public | Basic API smoke endpoint returning service status. |
| Auth | `/api/v1/auth` | `POST /register`, `POST /login` | Public | Main user bootstrap and token issuance entrypoints. |

## Protected Route Groups

| Group | Base path | Main endpoints | Access | Notes |
| --- | --- | --- | --- | --- |
| Users | `/api/v1/users` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Team/user CRUD; permission assignment endpoints live separately. |
| Permissions | `/api/v1` | `GET /permissions`, `POST /permissions/seed-defaults`, `GET/PATCH /users/{id}/permissions` | Protected | Permission matrix exists, but frontend enforcement is still partial. |
| Activity Logs | `/api/v1/activity-logs` | `GET /` | Protected | Filtered audit feed across implemented modules. |
| Admin Tools | `/api/v1/admin` | `GET /system-health`, `GET /backup-guidance`, `GET /maintenance-checklist`, `GET /exports/*` | Protected | Admin and super-admin focused release-readiness surface for health checks, exports, and backup guidance. |
| Settings | `/api/v1/settings` | `GET /business`, `PATCH /business` | Protected | Business and invoice display settings live here. |
| Invoice Templates | `/api/v1/invoice-templates` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}`, `POST /{id}/set-default` | Protected | Deactivate uses soft behavior. |
| Categories | `/api/v1/categories` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Standard master-data CRUD. |
| Brands | `/api/v1/brands` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Standard master-data CRUD. |
| Products | `/api/v1/products` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}`, variant CRUD | Protected | Includes product variant endpoints under the same route group. |
| Customers | `/api/v1/customers` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}`, activity list/create/update | Protected | CRM activity timeline is included. |
| Warehouses | `/api/v1/warehouses` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Used by orders, inventory, logistics, and POS. |
| Inventory | `/api/v1/inventory` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `POST /{id}/adjust` | Protected | Inventory adjustment is handled here. |
| Stock Movements | `/api/v1/stock-movements` | `GET /`, `GET /{id}` | Protected | Read-only ledger surface for adjustments, transfers, returns, orders, and POS. |
| Stock Transfers | `/api/v1/stock-transfers` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Internal warehouse transfer workflow. |
| Wastage Logs | `/api/v1/wastage-logs` | `GET /`, `GET /{id}`, `POST /` | Protected | No delete route; acts as an operational log. |
| Orders | `/api/v1/orders` | `GET /`, `GET /duplicate-check`, `GET /{id}`, `POST /`, `PATCH /{id}`, `GET /{id}/invoice-data`, `POST /{id}/mark-printed`, `POST /{id}/create-shipment` | Protected | Includes invoice payload and shipment creation handoff. |
| Returns | `/api/v1/returns` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Restock behavior depends on status/action flags. |
| Couriers | `/api/v1/couriers` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Internal courier master-data only. |
| Shipments | `/api/v1/shipments` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Shipment lifecycle and reconciliation surface. |
| Logistics | `/api/v1/logistics` | `GET /pending-dispatch` | Protected | Focused internal dispatch queue endpoint; reconciliation is handled through shipment fields rather than external courier APIs. |
| Suppliers | `/api/v1/suppliers` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `DELETE /{id}` | Protected | Supplier foundation exists and is used by purchase orders and supplier payments, but no dedicated supplier ledger endpoint exists yet. |
| Purchase Orders | `/api/v1/purchase-orders` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}` | Protected | Receiving integrates with inventory and stock movements. |
| WooCommerce | `/api/v1/woocommerce` | `GET /settings`, `PATCH /settings`, `POST /test-connection`, `GET /products-preview`, `POST /products-import`, `GET /orders-preview`, `POST /orders-import`, `GET /sync-logs`, `GET /sync-logs/{id}` | Protected | Admin-only manual import hardening. Credentials are stored encrypted server-side, previews expose duplicate indicators, imports return row-level outcomes, logs support filtering/detail, and the integration remains read-only against WooCommerce with no auto-sync, no destructive updates, and no push-back. |
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
| Reports | `/api/v1/reports` | `GET /sales-summary`, `GET /order-status`, `GET /payment-status`, `GET /inventory`, `GET /stock-movements-summary`, `GET /customers`, `GET /logistics`, `GET /finance-summary`, `GET /top-products`, `GET /low-stock-products`, `GET /revenue-by-date`, `GET /recent-order-activity` | Protected | Reporting foundation exists but remains lighter than statement-grade analytics. |

## Validation Notes

- Fresh migration path was validated against a temporary PostgreSQL database using `alembic upgrade head`.
- App import succeeded after migration completion.
- `GET /api/v1/health` returned `200 OK`.
- Registered `/api/v1/*` route count at validation time: `157`.
