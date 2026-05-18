# Exact V1 Clone Roadmap

Last reviewed: 2026-05-18

## Requirement Reset

- Previous UI passes were `v1-inspired modernization`.
- The client now requires an `exact v1 clone` for UI, UX, and workflows.
- This roadmap supersedes the previous visual roadmap where the two differ.

## Principles

- v1 is the source of truth for screen structure and operator flow.
- Do not modernize the UI during parity work.
- Do not invent improved workflows.
- Keep v2 backend work intact unless an exact v1 workflow later forces targeted backend adaptation.
- Prefer rebuilding v1 screen behavior on top of the v2 codebase rather than preserving v2 route modularity as the primary UX.

## Phase 15B: Restore Exact v1 Shell / Sidebar / Topbar

Status:

- Completed on `2026-05-17`

Goals:

- Clone `src/components/Layout.tsx` behavior and look
- Restore v1 grouped sidebar sections and submenu expansion
- Restore v1 topbar search, quick actions, notification behavior, theme toggle, profile block, and mobile drawer
- Match v1 sidebar collapse behavior, including POS-specific minimization behavior if still relevant

Primary targets:

- `frontend/app/dashboard/layout.tsx`
- `frontend/components/dashboard/sidebar.tsx`
- `frontend/components/dashboard/topbar.tsx`

Exit condition:

- Shell screenshots and interaction flow match v1 closely before page-level module work continues

Completion notes:

- v1 grouped sidebar sections, active states, collapse behavior, mobile drawer, topbar search, quick actions, notifications, theme toggle, and profile block are now cloned onto the v2 shell structure.
- Shell permission filtering now reads `legacy_permissions` from `/api/v1/auth/me`.
- Notifications now use live v2 API endpoints for list, unread count, mark-one-read, and mark-all-read behavior.
- Known deviations remain for the excluded `Inbox` route and for submenu entries that must currently map to existing v2 paths.

## Phase 15C: Exact v1 Dashboard

Status:

- Completed on `2026-05-17`

Goals:

- Recreate v1 dashboard card order, hero panel, chart hierarchy, low-stock section, best sellers, recent orders, and team activity
- Match v1 filtering controls and operational emphasis

Primary targets:

- `frontend/app/dashboard/page.tsx`

Exit condition:

- Dashboard reads like the v1 landing screen, not a v2 summary console

Completion notes:

- The dashboard now mirrors the v1 structure with the same top header rhythm, month filter popover, list/grid toggle, `New Order` CTA, six KPI cards, `Stock Alerts`, `Top Sellers`, `Recent Order`, `Store Performance`, and `Staff Performance` sections.
- v2 APIs now back the dashboard using existing report and order endpoints rather than new backend work.
- The staff-performance widget remains visually present but data-light because v2 does not yet expose safe per-staff order ownership data in the same shape as v1.
- `New Order` still maps to `/dashboard/orders` until the dedicated v1 workflow is restored in `15D`.

## Phase 15D: Exact v1 Orders Workflow

Backend support status:

- `15D-support` completed on `2026-05-17`

Status:

- Completed on `2026-05-17`

Goals:

- Restore v1 orders cockpit layout
- Restore v1 status tabs, view switching, summary cards, filter choreography, and row density
- Replace or faithfully emulate the v1 modal-first order detail workflow
- Recreate the dedicated v1 new-order workflow instead of relying on the current embedded form

Primary targets:

- `frontend/app/dashboard/orders/page.tsx`
- `frontend/app/dashboard/orders/[id]/page.tsx`
- supporting dashboard UI components

Exit condition:

- Orders list, create/edit flow, and detail inspection behave like v1

Backend readiness notes:

- Existing order APIs now expose dense v1-friendly list fields, modal-friendly detail helpers, duplicate-warning row data, and broader status-summary counts.
- The frontend orders clone can build on the current `/api/v1/orders`, `/api/v1/orders/{id}`, `/api/v1/orders/duplicate-check`, and `/api/v1/orders/operations-summary` endpoints without requiring separate `v1-compatible` routes.
- Remaining work is primarily frontend structure and workflow recreation, not missing backend order primitives.

Completion notes:

- `/dashboard/orders` now follows the v1 `Orders.tsx` cockpit more closely, with the v1 four-card summary strip, v1 status-tab order, search-first filter rhythm, table/grid toggle, denser row fields, and in-place action placement.
- Order inspection is now modal-first again, using `GET /api/v1/orders/{id}` for the primary UX while keeping `/dashboard/orders/[id]` as a fallback route.
- The dedicated create/edit workflow now opens as a v1-style full workflow overlay from the orders cockpit instead of acting like a simple embedded v2 card.
- Duplicate warnings, shipment creation, print actions, and guarded Woo refresh all stay inside the orders loop while preserving v2 backend safety rules.
- Known deviations remain for the lack of a distinct v1 print-label backend path and for edit-mode item mutation, which still stays limited to safe backend-supported fields.

## Phase 15E: Exact v1 Inventory Hub

Backend support status:

- `15E-support` completed on `2026-05-18`

Goals:

- Rebuild the v1 all-in-one inventory hub as the primary operator experience
- Restore tab set:
  `Products`, `Categories`, `Brands`, `Attributes`, `Warehouses`, `Stock`, `Transfers`, `Wastage`, `Purchases`, `Suppliers`, `Returns`, `Logs`, `Reports`
- Restore context-sensitive add actions and v1 modal loops

Primary targets:

- `frontend/app/dashboard/inventory/page.tsx`
- existing supporting routes may remain for implementation support, but the v1 hub should become primary UX

Exit condition:

- Inventory is once again a monolithic control center like v1

Backend readiness notes:

- `/api/v1/inventory/hub-summary` now provides the cross-tab counts needed by the v1 control-center header and summary cards.
- Existing inventory, product, stock-movement, supplier, purchase-order, transfer, wastage, return, category, brand, and warehouse APIs now expose the flatter alias fields needed by the v1 hub without forking into parallel legacy routes.
- No backend migration was required for Phase `15E-support`.
- Known backend deviations remain for exact attribute persistence, Firebase Storage-style image upload, and barcode/label printing, which are still either undecided or frontend-side flows.

Status:

- Completed on `2026-05-18`

Completion notes:

- `/dashboard/inventory` now follows the v1 `Inventory.tsx` control-center pattern with the restored tab order:
  `Products`, `Categories`, `Brands`, `Attributes`, `Warehouses`, `Stock`, `Transfers`, `Wastage`, `Purchases`, `Suppliers`, `Returns`, `Logs`, `Reports`
- The page now consumes the new inventory backend compatibility surface:
  `/api/v1/inventory/hub-summary`, `/api/v1/inventory`, `/api/v1/products`, `/api/v1/stock-movements`, `/api/v1/reports/inventory`, `/api/v1/reports/stock-movements-summary`, `/api/v1/reports/low-stock-products`, plus the existing category, brand, warehouse, supplier, transfer, wastage, purchase-order, and return routes with their new alias fields.
- Context-sensitive add actions, low-stock alert framing, modal-first CRUD, purchase receiving, transfer completion, return restock flow, and logs filtering now live inside the inventory hub rather than relying on the older five-tab v2 ops console.
- Known intentional deviations remain:
  attributes are frontend-local only
  image upload remains URL-based
  barcode and label output remains frontend-generated

## Phase 15F: Exact v1 CRM

Backend support status:

- `15F-support` completed on `2026-05-18`

Status:

- Completed on `2026-05-18`

Goals:

- Recreate the v1 split-pane CRM
- Restore left list / right detail interaction
- Restore segment badges, summary cards, and inline customer context behavior

Primary targets:

- `frontend/app/dashboard/customers/page.tsx`
- customer detail route may become secondary if needed

Exit condition:

- CRM feels like a single-screen relationship workspace, not a list-plus-detail route pair

Backend readiness notes:

- `/api/v1/customers/crm-summary` now provides the KPI counts and spend rollups needed by the v1 CRM header cards.
- `/api/v1/customers` now exposes split-pane-friendly aliases and computed CRM fields such as `segment`, `tagList`, `totalOrderCount`, `totalSpend`, `lastOrderAt`, `lastOrderNumber`, `activityCount`, and `openActivityCount`.
- `/api/v1/customers/{id}` now exposes richer profile aliases, order-history aliases, activity timeline aliases, `averageOrderValue`, `followUpState`, and a `stats` summary block for the right pane.
- Customer and activity create/update endpoints now accept the main v1-style alias inputs without requiring a new backend model or migration.
- CRM export remains frontend-generated because that matches the v1 implementation; no new backend export route was required in `15F-support`.

Completion notes:

- `/dashboard/customers` now follows the v1 `CRM.tsx` split-pane workspace with the restored left customer directory, right selected-customer detail pane, v1 header copy, four-card summary strip, row-selection loop, and modal-first add or edit customer flow.
- The page now consumes the CRM compatibility surface added in `15F-support`, including `/api/v1/customers/crm-summary`, enriched `/api/v1/customers` list rows, enriched `/api/v1/customers/{id}` profile and timeline payloads, and aliased customer/activity writes.
- CRM export remains frontend-generated CSV because that matches the v1 behavior.
- Known intentional deviations remain:
  points remain visual-only
  chat/message blocks remain placeholder-only
  `/dashboard/customers/[id]` remains a fallback detail route instead of the primary CRM interaction path

## Phase 15G: Exact v1 Logistics

Backend support status:

- `15G-support` completed on `2026-05-18`

Status:

- Completed on `2026-05-18`

Goals:

- Recreate the unified v1 logistics command center
- Pull couriers, shipments, pending dispatch, reconciliation, and API logs into one primary workspace
- Make courier integrations feel embedded inside logistics as in v1
- Align returns, suppliers, and purchase-order adjacency where v1 couples them operationally

Primary targets:

- `frontend/app/dashboard/logistics/page.tsx`
- possibly de-emphasize standalone `couriers`, `shipments`, and `courier-integrations` routes in favor of the v1 workspace pattern

Exit condition:

- Logistics behaves like the v1 command center first

Backend readiness notes:

- `/api/v1/logistics/command-summary` now provides the command-center counts and COD or courier totals needed by the v1 logistics header cards.
- `/api/v1/logistics/pending-dispatch` now exposes queue aliases and action flags such as `orderNumber`, `customerName`, `customerPhone`, `customerAddress`, `itemCount`, `totalAmount`, and `canCreateShipment`.
- `/api/v1/shipments` and `/api/v1/shipments/{id}` now expose v1-friendly aliases such as `shipmentNumber`, `orderNumber`, `customerName`, `courierName`, `trackingNumber`, `statusLabel`, `pendingAmount`, `sentToCourier`, event-log aliases, and safe action flags.
- Shipment create and update payloads now accept the main v1 camelCase alias inputs without adding a migration.
- `/api/v1/couriers` now exposes courier-card-friendly aliases and counts such as `courierName`, `contactPhone`, `status`, `activeShipmentCount`, `deliveredCount`, and `pendingReconciliationCount`.
- `/api/v1/courier-integrations/logs` now exposes `shipment_number`, `order_number`, `requestAt`, `createdAt`, and `response_summary` while preserving sanitized payloads and manual courier safety rules.

Known backend deviations:

- v1 `location` and `ETA` remain frontend-derived because they are not persisted as first-class shipment columns in v2
- external courier sync remains manual, conservative, and warning-first by design

Completion notes:

- `/dashboard/logistics` now follows the v1 `Logistics.tsx` command-center pattern with the restored tab order:
  `Shipments`, `Pending Ready-to-Ship`, `Courier Partners`, `Charge Reconciliation`, `API Logs`
- The page now restores the v1 header actions, four-card shipment summary strip, secondary logistics metrics, shipment-first default view, pending dispatch queue, courier cards, reconciliation table, and API log visibility inside one primary workspace.
- The route now consumes the logistics compatibility surface added in `15G-support`, including `/api/v1/logistics/command-summary`, `/api/v1/logistics/pending-dispatch`, `/api/v1/shipments`, `/api/v1/shipments/{id}`, `/api/v1/couriers`, and `/api/v1/courier-integrations/logs`.
- Modal-first shipment creation, bulk booking, status updates, reconciliation updates, courier add/edit, manual courier send, and guarded courier sync now happen inside `/dashboard/logistics` rather than requiring the older split-route workflow first.
- Known intentional deviations remain:
  location and ETA stay frontend-derived
  courier sync stays manual and warning-first
  no new supplier ledger or finance-grade balance block was added
  `/dashboard/shipments`, `/dashboard/shipments/[id]`, and `/dashboard/courier-integrations` remain fallback routes

## Phase 15H: Exact v1 Settings / Team / Admin

Backend support status:

- `15H-support` completed on `2026-05-18`

Status:

- Completed on `2026-05-18`

Goals:

- Rebuild the broad v1 settings center with grouped tab rows
- Restore v1 team management with members and activity tabs
- Bring activity logs back into the surrounding admin context where appropriate

Primary targets:

- `frontend/app/dashboard/settings/page.tsx`
- `frontend/app/dashboard/users/page.tsx`
- `frontend/app/dashboard/activity-logs/page.tsx`
- related admin surfaces

Exit condition:

- Admin workflows match the v1 central control-center model

Backend readiness notes:

- `/api/v1/settings/center-summary` now provides the grouped readiness and count cards needed by the v1 settings center.
- `/api/v1/settings/business` now exposes v1 aliases such as `companyName`, `businessName`, `logoUrl`, `invoicePrefix`, `invoiceTitle`, `paymentInstructions`, `taxRate`, `lowStockDefaultThreshold`, and camelCase timestamps.
- `/api/v1/users` and `/api/v1/users/{id}` now expose v1 team aliases such as `uid`, `displayName`, `fullName`, `active`, `isActive`, `status`, `pendingApproval`, `permissions`, `legacyPermissions`, `hasFullAccess`, `lastLogin`, `photoURL`, and camelCase timestamps.
- `/api/v1/permissions/legacy-matrix` and `/api/v1/users/{id}/legacy-permissions` now provide the boolean module-permission bridge needed by the exact v1 Team and Settings permission modals.
- `/api/v1/activity-logs` now supports the embedded v1 activity views with `action`, `search`, `date_from`, and `date_to` filters plus v1-friendly aliases.
- `/api/v1/invoice-templates` now exposes v1 aliases such as `templateName`, `accentColor`, `headerText`, `footerText`, `termsText`, `paymentInstructions`, `isDefault`, and `isActive`.

Known backend deviations:

- pending approval and inactive team states both still map to `is_active=false`
- `photoURL` remains placeholder-only because v2 still has no persisted avatar workflow
- broad per-user notification, security, mobile, and data-management preferences are still not first-class backend rows

Completion notes:

- `/dashboard/settings` now behaves like the v1 settings center again, with the restored tab order:
  `General`, `Company Info`, `Account`, `Notifications`, `Security`, `Integrations`, `SMS Settings`, `Data Management`, `Mobile App`, `Activity Logs`
- The settings screen now consumes `/api/v1/settings/center-summary`, `/api/v1/settings/business`, and the aliased invoice-template APIs while keeping team, admin, and activity adjacency inside the same broader control-center rhythm.
- `/dashboard/users` now restores the v1 team-management model with `Members` and `Activity` tabs, modal-first add/edit loops, role badges, activation flow, and the legacy boolean permission matrix powered by `/api/v1/permissions/legacy-matrix` and `/api/v1/users/{id}/legacy-permissions`.
- `/dashboard/activity-logs` now uses the denser v1-style admin audit table with module, action, user, date, and search filters based on the alias-friendly `/api/v1/activity-logs` response.
- `/dashboard/admin-tools` now fits back into the same v1-style admin control-center framing while preserving the current safe backend rules around backup guidance, maintenance review, and exports.
- Known intentional deviations remain:
  pending approval and inactive both map to the same backend `is_active=false` state
  `photoURL` remains placeholder-only
  destructive backup and restore execution is intentionally not implemented
  per-user notification, security, and mobile preferences remain represented visually rather than as first-class backend rows

## Phase 15I: Reports / Finance / HR / POS Exact Matching

Goals:

- Match v1 reports tab taxonomy and card composition
- Match v1 finance tab model and modal-based reporting flows
- Match v1 HR tab model and modal loops
- Match v1 POS retail workspace layout and modal sequence
- Resolve WooCommerce behavior against confirmed v1 exposure

Primary targets:

- `frontend/app/dashboard/reports/page.tsx`
- `frontend/app/dashboard/finance/page.tsx`
- `frontend/app/dashboard/hr/page.tsx`
- `frontend/app/dashboard/pos/page.tsx`
- `frontend/app/dashboard/woocommerce/page.tsx`

Exit condition:

- Lower-priority but still client-visible modules follow v1 exactly enough for side-by-side review

## Phase 15J: Final Exact Parity QA

Goals:

- Route-by-route and screen-by-screen v1 comparison
- Verify responsive shell behavior still matches v1 intent
- Verify workflow parity, modal loops, action placement, and terminology
- Identify any remaining backend adjustments required only for exact v1 behavior

QA checklist:

- screen composition
- navigation structure
- tab naming and order
- filters and search behavior
- badge and status language
- modal and drawer usage
- create/edit/detail workflow shape
- cross-screen shortcuts
- mobile drawer behavior

Exit condition:

- parity issues are reduced to minor polish or intentionally documented exceptions

## Recommended Execution Order

1. `15B`
2. `15C`
3. `15D`
4. `15E`
5. `15F`
6. `15G`
7. `15H`
8. `15I`
9. `15J`

## Current Next Phase

- Recommended next coding phase: `15I-support` if backend gaps are discovered during the remaining exact-clone passes, otherwise `15I`
- Focus: reports, finance, HR, POS, and any remaining cross-module exact-v1 backend shaping needed before those frontend rebuilds

## Risk Notes

- The biggest risk is preserving current v2 route modularity at the cost of exact v1 behavior.
- The inventory, CRM, logistics, settings, and team modules are the most likely places where exact parity will require v2 UX consolidation.
- WooCommerce needs one explicit confirmation step later because its exact routed role in v1 is not fully clear from `App.tsx`.
