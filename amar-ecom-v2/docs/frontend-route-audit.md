# Frontend Route Audit

Last reviewed: 2026-05-12

Status labels:
- `Working`
- `Partial`
- `Needs follow-up`

| Route | Status | Connected APIs | Known limitations |
| --- | --- | --- | --- |
| `/dashboard` | Partial | dashboard summary calls across products, customers, orders, inventory, shipments, returns, finance, tasks, HR, POS | Useful overview cards exist, but charting and dense operator storytelling are still below v1. |
| `/dashboard/pos` | Working | `/api/v1/pos/products`, `/api/v1/pos/checkout`, `/api/v1/pos/summary`, `/api/v1/customers`, `/api/v1/accounts`, `/api/v1/warehouses` | No barcode hardware, offline mode, or refund workflow yet. |
| `/dashboard/orders` | Partial | `/api/v1/orders`, `/api/v1/orders/duplicate-check`, supporting customer/warehouse data | Operational list is functional but lighter than the old dense dispatch workspace. |
| `/dashboard/orders/[id]` | Partial | `/api/v1/orders/{id}`, `/api/v1/orders/{id}/create-shipment`, `/api/v1/orders/{id}/mark-printed` | Good detail readability, but downstream ops still span multiple modules. |
| `/dashboard/orders/[id]/invoice` | Working | `/api/v1/orders/{id}/invoice-data`, `/api/v1/orders/{id}/mark-printed` | Browser print only; no PDF generation and no advanced live template preview. |
| `/dashboard/products` | Working | `/api/v1/products`, `/api/v1/categories`, `/api/v1/brands` | Functional CRUD page, but less dense than a full inventory admin hub. |
| `/dashboard/products/[id]` | Working | `/api/v1/products/{id}`, `/api/v1/products/{id}/variants/*` | Detail depth is practical, not a full merchandising workspace. |
| `/dashboard/customers` | Working | `/api/v1/customers` | CRM filters/export depth is still lighter than v1. |
| `/dashboard/customers/[id]` | Working | `/api/v1/customers/{id}`, `/api/v1/customers/{id}/activities` | Stronger CRM detail than early phases, but still not full segmentation/export parity. |
| `/dashboard/inventory` | Working | `/api/v1/inventory`, `/api/v1/warehouses`, `/api/v1/stock-transfers`, `/api/v1/wastage-logs` | Good internal hub, but inventory valuation and embedded report depth remain limited. |
| `/dashboard/stock-movements` | Working | `/api/v1/stock-movements` | Read-only ledger; export/reporting depth is still basic. |
| `/dashboard/returns` | Working | `/api/v1/returns`, `/api/v1/orders`, `/api/v1/customers` | Practical RMA flow, but not a full service-desk style returns workspace. |
| `/dashboard/returns/[id]` | Working | `/api/v1/returns/{id}` | Focused detail page; operational shortcuts are still limited. |
| `/dashboard/logistics` | Partial | `/api/v1/logistics/pending-dispatch`, `/api/v1/orders`, `/api/v1/shipments`, `/api/v1/couriers` | Internal dispatch and reconciliation foundation exists, but no external courier sync/config. |
| `/dashboard/couriers` | Working | `/api/v1/couriers` | Internal master-data only. |
| `/dashboard/shipments` | Working | `/api/v1/shipments`, `/api/v1/couriers`, `/api/v1/orders` | Reconciliation works, but partner-specific tooling is still light. |
| `/dashboard/shipments/[id]` | Working | `/api/v1/shipments/{id}` | Functional detail page; no external tracking sync. |
| `/dashboard/suppliers` | Working | `/api/v1/suppliers`, related supplier payments live under finance | Supplier directory works, but supplier ledger and deeper balance history are still missing. |
| `/dashboard/purchase-orders` | Working | `/api/v1/purchase-orders`, `/api/v1/suppliers`, `/api/v1/warehouses`, `/api/v1/products` | Receiving is operational, but procurement workflow depth is still moderate. |
| `/dashboard/purchase-orders/[id]` | Working | `/api/v1/purchase-orders/{id}` | Practical detail page; no complex approval chain. |
| `/dashboard/finance` | Working | `/api/v1/finance/summary`, `/api/v1/accounts`, `/api/v1/transactions`, `/api/v1/petty-cash`, `/api/v1/supplier-payments`, `/api/v1/suppliers` | Practical finance foundation with petty cash and supplier payments exists, but full accounting remains out of scope. |
| `/dashboard/tasks` | Working | `/api/v1/tasks`, `/api/v1/tasks/summary`, `/api/v1/users` | Kanban is status-based only; no drag/drop or deep collaboration tooling. |
| `/dashboard/hr` | Working | `/api/v1/hr/summary`, `/api/v1/designations`, `/api/v1/employees`, `/api/v1/attendance`, `/api/v1/salary-advances`, `/api/v1/salary-records`, `/api/v1/users` | HR foundation only; no payroll posting or advanced leave/payroll workflows. |
| `/dashboard/reports` | Working | `/api/v1/reports/*` | Stronger reporting base exists, but advanced charts/saved views remain limited. |
| `/dashboard/users` | Partial | `/api/v1/users`, `/api/v1/permissions`, `/api/v1/users/{id}/permissions`, `/api/v1/activity-logs` | Permission assignment exists, but full UI enforcement is still incomplete. |
| `/dashboard/activity-logs` | Working | `/api/v1/activity-logs` | Good audit visibility; filtering depth can still expand later. |
| `/dashboard/settings` | Working | `/api/v1/settings/business`, `/api/v1/invoice-templates`, `/api/v1/orders/{id}/invoice-data` for preview paths | Business/invoice coverage improved, but broader admin/settings parity is still missing. |

## Present But Outside Requested List

- `/dashboard/warehouses`
- `/dashboard/categories`
- `/dashboard/brands`

These are active supporting routes used by the broader inventory and product workflows.
