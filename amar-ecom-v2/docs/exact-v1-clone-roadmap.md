# Exact V1 Clone Roadmap

Last reviewed: 2026-05-17

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

## Phase 15C: Exact v1 Dashboard

Goals:

- Recreate v1 dashboard card order, hero panel, chart hierarchy, low-stock section, best sellers, recent orders, and team activity
- Match v1 filtering controls and operational emphasis

Primary targets:

- `frontend/app/dashboard/page.tsx`

Exit condition:

- Dashboard reads like the v1 landing screen, not a v2 summary console

## Phase 15D: Exact v1 Orders Workflow

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

## Phase 15E: Exact v1 Inventory Hub

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

## Phase 15F: Exact v1 CRM

Goals:

- Recreate the v1 split-pane CRM
- Restore left list / right detail interaction
- Restore segment badges, summary cards, and inline customer context behavior

Primary targets:

- `frontend/app/dashboard/customers/page.tsx`
- customer detail route may become secondary if needed

Exit condition:

- CRM feels like a single-screen relationship workspace, not a list-plus-detail route pair

## Phase 15G: Exact v1 Logistics

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

## Phase 15H: Exact v1 Settings / Team / Admin

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

## Risk Notes

- The biggest risk is preserving current v2 route modularity at the cost of exact v1 behavior.
- The inventory, CRM, logistics, settings, and team modules are the most likely places where exact parity will require v2 UX consolidation.
- WooCommerce needs one explicit confirmation step later because its exact routed role in v1 is not fully clear from `App.tsx`.
