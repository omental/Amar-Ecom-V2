# Exact V1 Backend Gap Roadmap

Last reviewed: 2026-05-17

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

- Add any missing compatibility fields or summary payloads needed to rebuild the v1 all-in-one inventory hub.
- Decide whether product image upload parity will need backend storage support or a separate approved implementation path.
- Add missing inventory-adjacent support only where the v1 hub truly depends on it, especially around attributes if that tab remains in-scope for exact parity.

### 15F-support: CRM

- Expose customer summary and segment data in the exact shape required by the v1 split-pane CRM.
- Add any export support only if the v1 customer export behavior must be server-backed rather than client-derived.

### 15G-support: Logistics, Returns, Suppliers

- Map shipment, courier, and reconciliation statuses to the v1 logistics workspace language.
- Align return-status vocabulary with the v1 standalone returns flow.
- Add supplier-ledger style support if the exact supplier workspace requires backend-computed balances or joined payment history.
- Expose cross-module logistics payloads so the v1 single-screen command center can load from coherent backend surfaces.

### 15H-support: Settings, Team, Activity

- Add any missing per-user settings/profile data required by the v1 settings center.
- Shape team/user payloads around v1 activation and permission editing expectations.
- Support embedded activity views used inside settings and team without forcing the frontend to depend only on the standalone activity route.

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

## First Backend Support Phase

`15D-support`

Reason:

- Orders is now the next major exact-clone frontend target.
- The orders cockpit, modal detail loop, and dedicated new-order workflow depend on dense row data, duplicate warnings, action flags, and exact status vocabulary support.
- This compatibility layer lets the frontend restore the v1 orders experience without regressing the safer v2 backend model.

Status:

- Backend support for `15D-support` is complete.
- The next implementation dependency is frontend `15D` orders cockpit, modal detail, and dedicated new-order clone work.
