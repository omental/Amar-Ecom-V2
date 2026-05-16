# Frontend Route Audit

Last reviewed: 2026-05-16

Status labels:
- `Working`
- `Partial`
- `Needs follow-up`

| Route | Status | Connected APIs | Known limitations |
| --- | --- | --- | --- |
| `/dashboard` | Working | dashboard summary calls across products, customers, orders, inventory, shipments, returns, finance, tasks, HR, POS, plus order/logistics/integration summaries | Compact ops cards now surface ready-to-ship, need-shipment, Woo sync health, and courier sync health without introducing destructive automation. |
| `/dashboard/pos` | Working | `/api/v1/pos/products`, `/api/v1/pos/checkout`, `/api/v1/pos/summary`, `/api/v1/customers`, `/api/v1/accounts`, `/api/v1/warehouses` | No barcode hardware, offline mode, or refund workflow yet. |
| `/dashboard/orders` | Working | `/api/v1/orders`, `/api/v1/orders/operations-summary`, `/api/v1/orders/dispatch-export`, `/api/v1/orders/duplicate-check`, `/api/v1/orders/batch-actions`, supporting customer/warehouse/shipment data | Phase 14E now brings the v1-inspired shell language directly into the orders cockpit with richer ops headers, KPI strips, quick chips, grouped filters, denser row metadata, and clearer print or dispatch actions while keeping Woo refresh manual and safe. |
| `/dashboard/orders/[id]` | Working | `/api/v1/orders/{id}`, `/api/v1/orders/{id}/create-shipment`, `/api/v1/orders/{id}/mark-printed` | Detail readability is now stronger and more operation-focused, with a richer badge cluster, denser summary framing, shipment visibility, Woo refresh controls, and timeline emphasis, though workflow still spans related modules intentionally. |
| `/dashboard/orders/[id]/invoice` | Working | `/api/v1/orders/{id}/invoice-data`, `/api/v1/orders/{id}/mark-printed` | Browser print only; no PDF generation and no advanced live template preview. |
| `/dashboard/products` | Working | `/api/v1/products`, `/api/v1/categories`, `/api/v1/brands` | Functional CRUD page, but less dense than a full inventory admin hub. |
| `/dashboard/products/[id]` | Working | `/api/v1/products/{id}`, `/api/v1/products/{id}/variants/*` | Detail depth is practical, not a full merchandising workspace. |
| `/dashboard/customers` | Working | `/api/v1/customers` | CRM filters/export depth is still lighter than v1. |
| `/dashboard/customers/[id]` | Working | `/api/v1/customers/{id}`, `/api/v1/customers/{id}/activities` | Stronger CRM detail than early phases, but still not full segmentation/export parity. |
| `/dashboard/inventory` | Working | `/api/v1/inventory`, `/api/v1/warehouses`, `/api/v1/stock-transfers`, `/api/v1/wastage-logs` | Good internal hub, but inventory valuation and embedded report depth remain limited. |
| `/dashboard/stock-movements` | Working | `/api/v1/stock-movements` | Read-only ledger; export/reporting depth is still basic. |
| `/dashboard/returns` | Working | `/api/v1/returns`, `/api/v1/orders`, `/api/v1/customers` | Practical RMA flow, but not a full service-desk style returns workspace. |
| `/dashboard/returns/[id]` | Working | `/api/v1/returns/{id}` | Focused detail page; operational shortcuts are still limited. |
| `/dashboard/logistics` | Working | `/api/v1/logistics/pending-dispatch`, `/api/v1/logistics/operations-summary`, `/api/v1/logistics/reconciliation-export`, `/api/v1/orders`, `/api/v1/shipments`, `/api/v1/couriers` | Internal dispatch and reconciliation workspace now uses a stronger v1-style console shell with a denser KPI strip, clearer operations tabs, and more cohesive dispatch-versus-reconciliation framing while staying manual-first and non-destructive. |
| `/dashboard/couriers` | Working | `/api/v1/couriers` | Internal master-data only. |
| `/dashboard/shipments` | Working | `/api/v1/shipments`, `/api/v1/shipments/batch-status-update`, `/api/v1/couriers`, `/api/v1/orders` | Reconciliation works, shipment rows surface external courier metadata when available, and Phase 14E adds a stronger ops header, summary strip, denser filters, and clearer batch-action presentation without changing the internal-only batch update behavior. |
| `/dashboard/shipments/[id]` | Working | `/api/v1/shipments/{id}`, `/api/v1/courier-integrations/shipments/{shipment_id}/sync-status` | Functional detail page with external courier metadata, last external sync time, safe-status apply control, warning visibility, and a guarded manual status-sync action. Phase 14E also strengthens the visual hierarchy around status, linked order, and external sync framing. |
| `/dashboard/courier-integrations` | Working | `/api/v1/courier-integrations/providers`, `/api/v1/courier-integrations/providers/{provider}/settings`, `/api/v1/courier-integrations/providers/{provider}/test-connection`, `/api/v1/courier-integrations/shipments/{shipment_id}/send`, `/api/v1/courier-integrations/shipments/{shipment_id}/sync-status`, `/api/v1/courier-integrations/status-sync/bulk`, `/api/v1/courier-integrations/logs` | External courier workspace with encrypted provider settings, manual send and sync flows, bulk status sync, sanitized API logs, and operator-facing warning/result summaries. Phase 13C keeps local updates non-destructive by default, adds explicit `apply safe delivered status locally` controls, and still requires Steadfast endpoint/base URL confirmation before live deployment. No background worker exists yet. |
| `/dashboard/suppliers` | Working | `/api/v1/suppliers`, related supplier payments live under finance | Supplier directory works, but supplier ledger and deeper balance history are still missing. |
| `/dashboard/purchase-orders` | Working | `/api/v1/purchase-orders`, `/api/v1/suppliers`, `/api/v1/warehouses`, `/api/v1/products` | Receiving is operational, but procurement workflow depth is still moderate. |
| `/dashboard/purchase-orders/[id]` | Working | `/api/v1/purchase-orders/{id}` | Practical detail page; no complex approval chain. |
| `/dashboard/woocommerce` | Working | `/api/v1/woocommerce/settings`, `/api/v1/woocommerce/test-connection`, `/api/v1/woocommerce/sync-status`, `/api/v1/woocommerce/run-sync`, `/api/v1/woocommerce/products-preview`, `/api/v1/woocommerce/products-import`, `/api/v1/woocommerce/products-refresh`, `/api/v1/woocommerce/products/{local_product_id}/refresh`, `/api/v1/woocommerce/orders-preview`, `/api/v1/woocommerce/orders-import`, `/api/v1/woocommerce/orders-refresh`, `/api/v1/woocommerce/orders/{local_order_id}/refresh`, `/api/v1/woocommerce/sync-logs`, `/api/v1/woocommerce/sync-logs/{id}` | Manual sync plus scheduled-sync configuration and WooCommerce lifecycle refresh foundation. The page stores auto-sync preferences, shows readiness warnings and last-sync state, allows safe manual run-sync, supports bulk imported-product and imported-order refresh, keeps encrypted credentials hidden, preserves duplicate-aware previews and row-level summaries, surfaces Woo stock as external-only visibility metadata, and remains read-only against WooCommerce with no worker-driven background sync, no stock auto-deduction during order refresh, no write-back, and no destructive updates. |
| `/dashboard/products` and `/dashboard/products/[id]` | Working | `/api/v1/products`, `/api/v1/products/{id}`, `/api/v1/woocommerce/products/{local_product_id}/refresh` | WooCommerce-sourced products now surface external source/status/synced metadata and a guarded `Refresh from WooCommerce` action. Refresh updates safe Woo metadata only, logs warnings for conflicts, and does not overwrite local inventory. |
| `/dashboard/orders` and `/dashboard/orders/[id]` | Working | `/api/v1/orders`, `/api/v1/orders/{id}`, `/api/v1/woocommerce/orders/{local_order_id}/refresh` | WooCommerce-sourced orders now surface external source/status/synced metadata, and the detail screen offers a guarded `Refresh from WooCommerce` action that updates safe lifecycle fields without deducting stock automatically or pushing data back to WooCommerce. |
| `/dashboard/finance` | Working | `/api/v1/finance/summary`, `/api/v1/accounts`, `/api/v1/transactions`, `/api/v1/petty-cash`, `/api/v1/supplier-payments`, `/api/v1/suppliers` | Practical finance foundation with petty cash and supplier payments exists, but full accounting remains out of scope. |
| `/dashboard/tasks` | Working | `/api/v1/tasks`, `/api/v1/tasks/summary`, `/api/v1/users` | Kanban is status-based only; no drag/drop or deep collaboration tooling. |
| `/dashboard/hr` | Working | `/api/v1/hr/summary`, `/api/v1/designations`, `/api/v1/employees`, `/api/v1/attendance`, `/api/v1/salary-advances`, `/api/v1/salary-records`, `/api/v1/users` | HR foundation only; no payroll posting or advanced leave/payroll workflows. |
| `/dashboard/reports` | Working | `/api/v1/reports/*`, `/api/v1/courier-integrations/logs`, `/api/v1/orders?source=woocommerce` | Adds an `Integration Health` section for WooCommerce and courier visibility plus browser CSV exports for integration summary, courier failures, and WooCommerce imported orders. Advanced charts and saved views remain limited. |
| `/dashboard/users` | Partial | `/api/v1/users`, `/api/v1/permissions`, `/api/v1/users/{id}/permissions`, `/api/v1/activity-logs` | Permission assignment exists, but full UI enforcement is still incomplete. |
| `/dashboard/activity-logs` | Working | `/api/v1/activity-logs` | Good audit visibility; filtering depth can still expand later. |
| `/dashboard/admin-tools` | Working | `/api/v1/admin/system-health`, `/api/v1/admin/backup-guidance`, `/api/v1/admin/maintenance-checklist`, `/api/v1/admin/exports/*` | Admin-only release-readiness workspace; no actual backup execution and no deep permission engine yet. |
| `/dashboard/settings` | Working | `/api/v1/settings/business`, `/api/v1/invoice-templates`, `/api/v1/orders/{id}/invoice-data` for preview paths | Business/invoice coverage improved, but broader admin/settings parity is still missing. |

## Present But Outside Requested List

- `/dashboard/warehouses`
- `/dashboard/categories`
- `/dashboard/brands`

These are active supporting routes used by the broader inventory and product workflows.

## Release Candidate Notes

- Current route validation remains clean for the requested v2 scope.
- Frontend lint and TypeScript checks passed during the 2026-05-16 release-candidate audit.
- Production build failure in this environment was caused by Google Fonts fetch restrictions, not by dashboard route regressions.

## UI Parity Notes

These notes track legacy v1 React UI parity only. They are planning markers for phased redesign work and do not imply backend gaps.

Phase `14D` status:
- global shell and dashboard design foundation completed
- grouped sidebar, richer topbar, shared ops components, and v1-inspired tokens are now in place

Phase `14E` status:
- Orders + Logistics first-pass UI match completed
- the shared ops shell now covers orders, order detail, logistics, shipments, and shipment detail
- remaining work is module-level parity for inventory, products, CRM, reports, and lower-priority admin screens

| Route / Module | Current UI parity status | Priority | Target phase |
| --- | --- | --- | --- |
| `/dashboard` shell and landing page | Partial. Functional summaries are strong, but shell chrome, dashboard hierarchy, and visual density are still behind v1. | High | `14D` then `14G` |
| `/dashboard/orders` and `/dashboard/orders/[id]` | Partial. The first-pass cockpit redesign is now in place, but there is still room for deeper v1-style density, especially around detail-page timeline and print-workflow refinement. | High | `14E` completed, then `14I` QA |
| `/dashboard/logistics`, `/dashboard/shipments`, `/dashboard/shipments/[id]`, `/dashboard/courier-integrations` | Partial. The shared ops visual language now covers the main logistics routes, but courier-integrations and reconciliation analytics can still be made denser later. | High | `14E` completed, then `14I` QA |
| `/dashboard/products`, `/dashboard/products/[id]` | Partial. Product workflows work well, but they do not yet match the denser v1 inventory-admin presentation. | High | `14F` |
| `/dashboard/inventory`, `/dashboard/stock-movements`, supporting inventory routes | Needs redesign. v1 inventory behaved like a broad admin hub, while v2 is still more distributed and lighter visually. | High | `14F` |
| `/dashboard/customers`, `/dashboard/customers/[id]` | Needs redesign. v2 lacks the v1 split-pane CRM directory/detail experience. | High | `14F` |
| `/dashboard/returns` and `/dashboard/returns/[id]` | Partial. Safe and usable, but not yet integrated into a denser v1-style operations surface. | Medium | `14F` |
| `/dashboard/suppliers`, `/dashboard/purchase-orders`, `/dashboard/purchase-orders/[id]` | Partial. Procurement works, but UI parity with the v1 inventory/procurement hub is still limited. | Medium | `14F` |
| `/dashboard/reports` | Partial. Functional reporting is broad, but visual analytics parity and chart hierarchy are behind v1. | High | `14G` |
| `/dashboard/finance` | Partial. Good foundation, but lacks the richer v1 finance workspace treatment. | Medium | `14H` |
| `/dashboard/hr` | Partial. Practical module, but still lighter than the v1 tabbed HR management surface. | Medium | `14H` |
| `/dashboard/tasks` | Partial. Task workflow exists, but the board/list polish and collaboration feel lag v1. | Medium | `14H` |
| `/dashboard/pos` | Partial. Checkout flow is solid, but the retail workspace styling and speed cues are behind v1. | Medium | `14H` |
| `/dashboard/settings` | Partial. Business/invoice settings work, but broader admin/settings shell parity is incomplete. | Medium | `14H` |
| `/dashboard/users` | Partial. Team and permissions are functional, but the admin control surface is less polished than v1. | Medium | `14H` |
| `/dashboard/activity-logs` | Better in v2 functionally, but still should inherit the final shared visual language. | Low | `14H` |
| Cross-app regression pass | Not started. Shared component convergence and responsive QA still need a dedicated pass. | High | `14I` |
