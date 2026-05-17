# Frontend Route Audit

Last reviewed: 2026-05-17

## Requirement Reset

- Previous UI passes were `v1-inspired modernization`.
- The client now requires `exact v1 clone behavior`.
- The exact clone roadmap in [exact-v1-clone-roadmap.md](/d:/Amar-eCom/amar-ecom-v2/docs/exact-v1-clone-roadmap.md) supersedes the previous visual roadmap where they conflict.
- Route health in this file still matters, but a `Working` route does not imply acceptable v1 parity anymore.
- Backend routes remain functionally strong, but exact shell parity now also depends on `/api/v1/auth/me` and notification endpoints for v1-compatible user context and topbar behavior.

Status labels:
- `Working`
- `Partial`
- `Needs follow-up`

| Route | Status | Connected APIs | Known limitations |
| --- | --- | --- | --- |
| `/dashboard` | Working | dashboard summary calls across products, customers, orders, inventory, shipments, returns, finance, tasks, HR, POS, plus order/logistics/integration summaries | Compact ops cards now surface ready-to-ship, need-shipment, Woo sync health, and courier sync health without introducing destructive automation. |
| `/dashboard/pos` | Working | `/api/v1/pos/products`, `/api/v1/pos/checkout`, `/api/v1/pos/summary`, `/api/v1/customers`, `/api/v1/accounts`, `/api/v1/warehouses` | No barcode hardware, offline mode, or refund workflow yet. |
| `/dashboard/finance` | Working | `/api/v1/finance/summary`, `/api/v1/accounts`, `/api/v1/transactions`, `/api/v1/petty-cash`, `/api/v1/supplier-payments`, `/api/v1/suppliers` | Phase 14H brings the finance route onto the denser v1-inspired shell with a stronger header, KPI strip, shared tab shell, grouped filters, and clearer petty-cash or supplier-payment warning text while preserving all existing finance behavior. |
| `/dashboard/hr` | Working | `/api/v1/hr/summary`, `/api/v1/designations`, `/api/v1/employees`, `/api/v1/attendance`, `/api/v1/salary-advances`, `/api/v1/salary-records`, `/api/v1/users` | Phase 14H upgrades the HR route with a stronger header, KPI strip, and shared tab shell so the people-ops workspace feels denser and closer to v1 without changing existing attendance or salary flows. |
| `/dashboard/orders` | Working | `/api/v1/orders`, `/api/v1/orders/operations-summary`, `/api/v1/orders/dispatch-export`, `/api/v1/orders/duplicate-check`, `/api/v1/orders/batch-actions`, supporting customer/warehouse/shipment data | Phase 14E now brings the v1-inspired shell language directly into the orders cockpit with richer ops headers, KPI strips, quick chips, grouped filters, denser row metadata, and clearer print or dispatch actions while keeping Woo refresh manual and safe. |
| `/dashboard/orders/[id]` | Working | `/api/v1/orders/{id}`, `/api/v1/orders/{id}/create-shipment`, `/api/v1/orders/{id}/mark-printed` | Detail readability is now stronger and more operation-focused, with a richer badge cluster, denser summary framing, shipment visibility, Woo refresh controls, and timeline emphasis, though workflow still spans related modules intentionally. |
| `/dashboard/orders/[id]/invoice` | Working | `/api/v1/orders/{id}/invoice-data`, `/api/v1/orders/{id}/mark-printed` | Browser print only; no PDF generation and no advanced live template preview. |
| `/dashboard/products` | Working | `/api/v1/products`, `/api/v1/categories`, `/api/v1/brands` | Phase 14F adds a denser product-admin header, KPI strip, local filter bar, richer Woo/source row metadata, and clearer direct actions while preserving the same product CRUD behavior. |
| `/dashboard/products/[id]` | Working | `/api/v1/products/{id}`, `/api/v1/products/{id}/variants/*` | Detail depth is practical and now visually denser, with a stronger header, badge cluster, safer Woo refresh framing, and clearer inventory/variant summary blocks. |
| `/dashboard/customers` | Working | `/api/v1/customers` | Phase 14G brings the shared ops shell into the CRM directory with a richer operations header, KPI strip, grouped search/filter bar, quick segment chips, and denser customer rows. It is still not a full v1 split-pane CRM. |
| `/dashboard/customers/[id]` | Working | `/api/v1/customers/{id}`, `/api/v1/customers/{id}/activities` | Phase 14G upgrades the CRM detail route with a stronger profile header, denser info cards, clearer activity timeline hierarchy, and a more obvious operator edit panel while keeping the same API behavior. |
| `/dashboard/inventory` | Working | `/api/v1/inventory`, `/api/v1/warehouses`, `/api/v1/stock-transfers`, `/api/v1/wastage-logs` | Phase 14F upgrades the route into a denser v1-style operations hub with a stronger KPI strip, ops tabs, overview row metadata, and grouped ledger filtering while keeping the same adjustment, transfer, wastage, and ledger behavior. |
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
| `/dashboard/tasks` | Working | `/api/v1/tasks`, `/api/v1/tasks/summary`, `/api/v1/users` | Kanban is status-based only; no drag/drop or deep collaboration tooling. |
| `/dashboard/reports` | Working | `/api/v1/reports/*`, `/api/v1/courier-integrations/logs`, `/api/v1/orders?source=woocommerce` | Phase 14G upgrades the reporting shell with a richer header, date filter/action bar, report-group tabs, stronger KPI cards, and a clearer `Integration Health` management widget while keeping existing report queries and browser CSV export behavior unchanged. Advanced charts and saved views remain limited. |
| `/dashboard/users` | Partial | `/api/v1/users`, `/api/v1/permissions`, `/api/v1/users/{id}/permissions`, `/api/v1/activity-logs` | Permission assignment exists, but full UI enforcement is still incomplete. |
| `/dashboard/activity-logs` | Working | `/api/v1/activity-logs` | Good audit visibility; filtering depth can still expand later. |
| `/dashboard/admin-tools` | Working | `/api/v1/admin/system-health`, `/api/v1/admin/backup-guidance`, `/api/v1/admin/maintenance-checklist`, `/api/v1/admin/exports/*` | Phase 14H gives admin tools a richer release-readiness shell with stronger health cards, clearer maintenance framing, and denser admin-console hierarchy. No actual backup execution and no deep permission engine yet. |
| `/dashboard/settings` | Working | `/api/v1/settings/business`, `/api/v1/invoice-templates`, `/api/v1/orders/{id}/invoice-data` for preview paths | Phase 14H upgrades settings into a denser admin console with stronger section framing, clearer invoice-preview warnings, and better adjacency to templates, logs, team permissions, and admin tools. |

## Phase 14H UI Parity Note

- Finance, HR, POS, Settings, Admin Tools, WooCommerce, and Courier Integrations now use the shared v1-inspired shell/header/tab/card language.
- This phase is visual polish only; backend behavior, sync safety rules, and existing data-fetching patterns were not changed.
- Remaining frontend parity work is primarily `14I` regression QA and any optional exact-v1 recreation passes.

## Phase 15A Exact Clone Note

- `15A` changes the success criteria from `v1-inspired modernization` to `exact v1 clone`.
- Existing route status in this document should now be read as `functional readiness`, not `client-acceptable frontend parity`.
- For screen-level clone requirements, use:
  - [exact-v1-clone-audit.md](/d:/Amar-eCom/amar-ecom-v2/docs/exact-v1-clone-audit.md)
  - [exact-v1-clone-roadmap.md](/d:/Amar-eCom/amar-ecom-v2/docs/exact-v1-clone-roadmap.md)

## Phase 15B Shell Clone Note

- `15B` is now completed for the global dashboard shell.
- `frontend/app/dashboard/layout.tsx`, `frontend/components/dashboard/sidebar.tsx`, and `frontend/components/dashboard/topbar.tsx` now follow the v1 shell model much more closely.
- Shell behavior now consumes:
  - `GET /api/v1/auth/me`
  - `GET /api/v1/notifications`
  - `GET /api/v1/notifications/unread-count`
  - `PATCH /api/v1/notifications/{id}/read`
  - `PATCH /api/v1/notifications/mark-all-read`
- Remaining route parity work is now page-level rather than shell-foundation work.

## Phase 15C Dashboard Clone Note

- `15C` is now completed for `/dashboard`.
- The route now follows the v1 dashboard structure instead of the broader Phase 14 summary-console layout.
- Current v2 dashboard API mapping for the v1 clone uses:
  - `/api/v1/settings/business`
  - `/api/v1/reports/sales-summary`
  - `/api/v1/reports/inventory`
  - `/api/v1/reports/customers`
  - `/api/v1/reports/top-products`
  - `/api/v1/reports/low-stock-products`
  - `/api/v1/reports/recent-order-activity`
  - `/api/v1/reports/revenue-by-date`
  - `/api/v1/orders`
- No new backend endpoint was required for the dashboard pass.
- Remaining dashboard deviation is mainly the `Staff Performance` data source, which stays visually cloned but backend-light for now.

## Exact Clone Priority Overrides

- Highest structural mismatch routes are now:
  - `/dashboard/orders`
  - `/dashboard/inventory`
  - `/dashboard/customers`
  - `/dashboard/logistics`
  - `/dashboard/settings`
  - `/dashboard/users`
- Shell/sidebar/topbar has moved from primary mismatch to near-match status, with only documented deviations remaining.
- `/dashboard` has also moved to near-match status after the Phase `15C` pass.
- Several currently separate v2 routes map to embedded tabs or modal loops inside v1 parent screens. That means route coverage alone is no longer enough to judge parity.

## Phase 14I Consistency Note

- Shared primitives now give lower-priority routes more consistent page-header, badge, loading, empty, error, and batch-action treatment.
- The invoice print page, activity logs, tasks, users, returns, and purchase-order flows are functionally stable but still somewhat lower parity than the highest-priority ops modules.
- A dedicated responsive/layout cleanup is still pending, especially for shell/content horizontal overflow on narrower widths.

## Phase 14J Responsive Layout Note

- The dashboard shell now uses stricter `min-w-0`, `max-w-full`, and `overflow-x-hidden` containment across the root layout, sidebar, topbar, and main content wrappers.
- Sidebar width is now treated as a proper non-shrinking column, while the main content column is explicitly allowed to shrink without pushing the page wider than the viewport.
- Table-heavy pages may still use intentional internal horizontal scrolling inside the table container. This is expected for dense data views and is not considered a shell overflow regression.

## Final UI Parity Status

- shell: improved
- orders and logistics: improved
- inventory and products: improved
- CRM and reports: improved
- finance, HR, POS, settings, admin, WooCommerce, and courier integrations: improved
- responsive containment: completed at code level in `14J`
- browser verification: still manual unless explicitly executed in a live browser session

## Remaining Lower-Parity Routes

- `/dashboard/orders/[id]/invoice`
- `/dashboard/activity-logs`
- `/dashboard/tasks`
- `/dashboard/users`
- `/dashboard/returns`
- `/dashboard/purchase-orders`

These routes are stable and visually aligned better than before, but they are still lighter than the strongest ops modules.

## Present But Outside Requested List

- `/dashboard/warehouses`
- `/dashboard/categories`
- `/dashboard/brands`

These are active supporting routes used by the broader inventory and product workflows.

## Release Candidate Notes

- Current route validation remains clean for the requested v2 scope.
- Frontend lint and TypeScript checks passed during the 2026-05-16 release-candidate audit.
- Current local build failure in this environment is the Windows `.next` file-lock issue, not a dashboard route regression.
- Use [ui-release-candidate-checklist.md](/d:/Amar-eCom/amar-ecom-v2/docs/ui-release-candidate-checklist.md) for the final manual viewport/browser pass.

## UI Parity Notes

These notes track legacy v1 React UI parity only. They are planning markers for phased redesign work and do not imply backend gaps.

| Route / Module | Current UI parity status | Priority | Target phase |
| --- | --- | --- | --- |
| `/dashboard` shell and landing page | Improved. The shell, cards, topbar, and responsive containment are much closer to the intended ops-console feel, though final browser verification is still manual. | High | `14D-14J` completed |
| `/dashboard/orders` and `/dashboard/orders/[id]` | Improved. Strong first-pass cockpit parity is now in place, with only refinement-level QA remaining. | High | `14E` completed |
| `/dashboard/logistics`, `/dashboard/shipments`, `/dashboard/shipments/[id]`, `/dashboard/courier-integrations` | Improved. The shared ops visual language and responsive containment now cover the main logistics surfaces. | High | `14E` completed |
| `/dashboard/products`, `/dashboard/products/[id]` | Improved. Product-admin parity is much closer, though still not a literal v1 recreation. | High | `14F` completed |
| `/dashboard/inventory`, `/dashboard/stock-movements`, supporting inventory routes | Improved. The inventory hub now behaves much more like the v1 admin hub while keeping v2 route boundaries. | High | `14F` completed |
| `/dashboard/customers`, `/dashboard/customers/[id]` | Improved. CRM is much closer visually, though still not a true split-pane v1 master-detail clone. | High | `14G` completed |
| `/dashboard/returns` and `/dashboard/returns/[id]` | Partial. Stable and visually aligned better, but still lighter than the top-priority ops modules. | Medium | post-`14K` optional |
| `/dashboard/suppliers`, `/dashboard/purchase-orders`, `/dashboard/purchase-orders/[id]` | Partial. Procurement remains functional but visually lighter than the stronger ops modules. | Medium | post-`14K` optional |
| `/dashboard/reports` | Improved. Management framing and visual hierarchy are much stronger now, though chart density is still lighter than v1. | High | `14G` completed |
| `/dashboard/finance` | Improved. Finance now sits inside the same ops-shell language and feels materially closer to v1. | Medium | `14H` completed |
| `/dashboard/hr` | Improved. HR now uses the same stronger header, KPI, and tab shell language. | Medium | `14H` completed |
| `/dashboard/tasks` | Partial. Functional and more consistent, but still lighter than the most polished routes. | Medium | post-`14K` optional |
| `/dashboard/pos` | Improved. POS now reads more like a dense selling workspace while keeping the same behavior. | Medium | `14H` completed |
| `/dashboard/settings` | Improved. The settings/admin shell is much closer to the intended v1-inspired control-center feel. | Medium | `14H` completed |
| `/dashboard/users` | Partial. More consistent now, but still lighter than the strongest ops routes. | Medium | post-`14K` optional |
| `/dashboard/activity-logs` | Partial / Better in v2 functionally. The route is useful, but still visually lighter than the main parity targets. | Low | post-`14K` optional |
| Cross-app regression pass | Completed at code level for consistency and responsive containment; browser viewport verification remains a manual checklist step. | High | `14I-14K` completed |
