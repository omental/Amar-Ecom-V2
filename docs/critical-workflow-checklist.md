# Critical Workflow Checklist

Last reviewed: 2026-05-16

Use this as a manual smoke pass after migrations and before release candidates.

Release-candidate audit status on 2026-05-16:

- backend tests passed with `30 passed`
- frontend lint passed
- frontend type-check passed
- frontend build remained environment-sensitive because of Windows `.next` locking or Google Fonts fetch restrictions

## Setup

1. Apply backend migrations with `venv\Scripts\alembic.exe upgrade head`.
2. Start the backend API.
3. Start the frontend app.
4. Log in with an active admin-capable user.

## Workflow Checks

### Login

1. Open the login screen.
2. Sign in with a valid user.
3. Confirm redirect to `/dashboard`.
4. If testing a non-admin user with explicit permissions, confirm the sidebar only shows the allowed module links.

Expected:
- auth succeeds
- dashboard loads without console-blocking errors
- light permission-aware navigation does not hide modules accidentally for admins or users without an explicit permission list

### Create Product, Category, Brand

1. Create a category.
2. Create a brand.
3. Create a product using that category and brand.

Expected:
- product appears in product list
- product detail opens successfully

### Create Warehouse and Inventory

1. Create a warehouse.
2. Create an inventory row for a product in that warehouse.

Expected:
- inventory quantity is visible in the inventory hub

### Stock Adjustment

1. Run an inventory adjustment on an item.

Expected:
- quantity updates
- stock movement log receives an adjustment entry

### Stock Transfer

1. Create a transfer between two warehouses.
2. Move it through the available status flow.

Expected:
- source and destination quantities change correctly
- transfer appears in transfer history

### Wastage

1. Record wastage against an inventory item.

Expected:
- stock decreases correctly
- wastage log and stock movement entries are visible

### Create Customer and CRM Activity

1. Create a customer.
2. Add an activity on the customer detail page.

Expected:
- customer detail shows the activity timeline update

### Create Order

1. Create an order with one or more line items.

Expected:
- order list shows the new order
- order detail shows line items and totals

### Fulfill Order and Deduct Stock

1. Move the order into a stock-deducting fulfillment status.

Expected:
- `stock_deducted` becomes true
- inventory decreases
- stock movement entry is created

### Print Invoice

1. Open `/dashboard/orders/{id}/invoice`.
2. Print from the browser.

Expected:
- invoice title, template text, toggles, and styling reflect settings/template configuration
- mark-printed flow increments print count

### Create Shipment From Logistics

1. Open `/dashboard/logistics`.
2. Create a shipment from a pending dispatch order.
3. Use pending-dispatch filters for search, status, and warehouse.

Expected:
- shipment record is created
- order/shipment linkage appears on detail pages
- filtered dispatch list stays usable and links back to order detail

### Reconcile Shipment

1. Update shipment status and reconciliation fields.
2. Filter reconciliation rows by status and courier.

Expected:
- shipment detail reflects new status
- logistics report totals update appropriately
- reconciliation filtering stays internal-only and does not imply external courier sync

### Create Return and Restock

1. Create a return request.
2. Move it into a restocked path when appropriate.

Expected:
- return status updates
- stock is restored only when restock action is used

### Create Finance Account and Transaction

1. Create a finance account.
2. Create an income transaction.
3. Create an expense transaction.

Expected:
- account balance updates correctly
- finance overview updates

### Supplier Payment Creates Transaction

1. Create a supplier payment using an active account.

Expected:
- supplier payment is stored
- linked `supplier_payment` transaction appears
- account balance decreases

### Petty Cash Approval Creates Transaction

1. Create a petty cash entry with an account.
2. Approve or settle it.

Expected:
- linked `petty_cash` transaction appears once
- account balance decreases once

### Create Task and Complete It

1. Create a task.
2. Assign it.
3. Mark it completed.

Expected:
- task summary updates
- completed timestamp is set
- activity log entry is visible

### Create HR Employee, Attendance, Salary Record

1. Create a designation.
2. Create an employee.
3. Create attendance.
4. Create a salary advance and approve it.
5. Create a salary record and mark it paid.

Expected:
- HR summary cards update
- duplicate attendance is blocked
- salary record net salary is calculated correctly

### POS Checkout

1. Open `/dashboard/pos`.
2. Select a warehouse.
3. Search a product and add to cart.
4. Complete checkout with paid amount and optional finance account.

Expected:
- POS order is created
- stock is deducted immediately
- `pos_sale` stock movement is created
- optional `customer_payment` transaction is created
- invoice/receipt link opens correctly

### WooCommerce Manual Sync

1. Open `/dashboard/woocommerce`.
2. Confirm `backend/.env` includes `FERNET_SECRET_KEY` or `APP_SECRET_KEY` if you want the dedicated encryption warning to clear.
3. Save WooCommerce connection settings.
4. Confirm the page shows saved-key state and a masked key value, and that keys are never displayed after saving.
5. Run `Test connection`.
6. Open the `Sync Schedule` tab.
7. Confirm readiness warnings and last-sync metadata render without exposing credentials.
8. Save schedule settings such as auto-sync preference, entity toggles, and interval minutes.
9. Run `Run manual sync`.
10. Confirm the manual sync result shows timestamps plus product/order summaries.
11. Load product preview and confirm duplicate badges appear before import.
12. Confirm existing product matches are disabled by default unless `Include existing matches` is enabled.
13. Import one or more selected products.
14. Confirm the import result includes imported, skipped, and failed totals plus row-level messages.
15. Load order preview and confirm duplicate badges appear before import.
16. Confirm existing order matches are disabled by default unless `Include existing matches` is enabled.
17. Import one or more selected orders.
18. Confirm the import result includes imported, skipped, and failed totals plus row-level messages.
19. Use `Refresh imported products` and confirm existing WooCommerce-linked products refresh safely while changed-but-missing WooCommerce products import as new rows.
20. Open one WooCommerce-sourced local product in `/dashboard/products/{id}` and use `Refresh from WooCommerce`.
21. Use `Refresh imported orders` and confirm existing WooCommerce orders refresh safely while changed-but-missing WooCommerce orders import as new rows.
22. Open one WooCommerce-sourced local order in `/dashboard/orders/{id}` and use `Refresh from WooCommerce`.
23. Open the `Sync Logs` tab, apply filters, and review at least one `View details` panel.

Expected:
- connection test succeeds or returns a clean error
- preview endpoints stay read-only against WooCommerce
- credentials are never returned raw by the API
- sync schedule fields are stored safely but do not start a background worker by themselves
- manual run-sync stays import-only and does not push local changes back to WooCommerce
- product import creates or skips local rows safely by SKU or slug
- imported WooCommerce products store external reference metadata for later refresh
- WooCommerce product refresh updates safe lifecycle fields only and keeps Woo stock external-only
- order import creates or skips local rows safely by `WC-{id}` style order numbers
- imported WooCommerce orders store external reference metadata for later refresh
- WooCommerce refresh updates safe lifecycle fields only and logs warnings instead of force-overwriting conflict-prone local changes
- sync log detail stays safe and does not expose WooCommerce credentials
- imported WooCommerce orders do not deduct local stock automatically in this phase

### Courier Integration Foundation

1. Open `/dashboard/courier-integrations`.
2. Save provider settings for `manual` or `steadfast`.
3. Confirm the UI shows saved credential state without revealing raw values.
4. Run `Test connection`.
5. Confirm success, failed, or skipped messaging appears cleanly.
6. For Steadfast, confirm the UI explains:
   - endpoint or base URL should be confirmed before production
   - sandbox mode only changes labeling unless the configured base URL is actually sandbox
7. If credentials are missing, confirm test connection fails cleanly without exposing secrets.
8. Open `Send Shipments`.
9. Confirm the page highlights Steadfast send requirements such as recipient name, recipient phone, and delivery address.
10. Send a shipment to a selected provider manually.
11. Confirm the shipment stores external provider, consignment or tracking, external status, payload snapshot, and sent timestamp when the provider returns success.
12. If required shipment fields are missing, confirm the API returns a clean error before any remote send is treated as successful.
13. Open `/dashboard/shipments/{id}` for a linked shipment.
14. Confirm external provider and status metadata are visible when values exist.
15. Use `Sync External Status` on a shipment with external linkage.
16. Confirm the sync UI offers `Apply safe delivered status locally` and that it defaults to off.
17. Confirm external status and synced time update safely.
18. If the external result is `delivered` while the checkbox is off, confirm the local shipment status does not auto-change.
19. If the shipment is already in a shipped-ready local state and the checkbox is on, confirm a safe `delivered` sync can update local shipment status.
20. Run `Bulk Status Sync`.
21. Confirm the summary shows synced, skipped, and failed counts plus row-level warnings where relevant.
22. Open `API Logs`.
23. Filter by provider, action, status, and message search.
24. Review at least one log entry or detail panel.
25. Open `/dashboard/admin-tools` and confirm the maintenance checklist includes courier integration readiness.

Expected:
- provider credentials are encrypted server-side and never returned raw
- connection testing creates a courier API log entry
- manual send creates an external courier event and API log entry
- external status sync updates safe shipment metadata only
- external delivered can map to local delivered only when explicitly allowed and conflict-free
- returned, cancelled, and failed external states do not auto-apply destructively by default
- sync warnings remain visible in shipment events and courier API logs
- local WooCommerce, inventory, and unrelated order fields are not modified by courier API actions
- request and response snapshots are sanitized and do not expose tokens, passwords, keys, or auth headers
- no background courier worker is running in this phase
- provider adapters are still manual-only, and Steadfast endpoint mapping plus live base URL should still be confirmed before production rollout

### Reports Check

1. Open `/dashboard/reports`.
2. Review sales, logistics, finance, inventory, and product report widgets.
3. Export low-stock products and recent order activity as CSV.

Expected:
- report cards/tables load without runtime errors
- date-filtered finance summary responds correctly
- browser CSV exports succeed without adding chart dependencies

### Cross-Module Operations Cockpit

1. Open `/dashboard/orders`.
2. Confirm the summary cards show open orders, ready-to-ship, need shipment, Woo orders, need Woo refresh, and unprinted counts.
3. Use filters for source, warehouse, stock deducted, has shipment, printed, payment status, status tab, and search.
4. Confirm WooCommerce-linked rows show source, external status, and synced timing safely.
5. Confirm `Refresh Woo` only appears for WooCommerce-linked rows with external identifiers.
6. Confirm dispatch-ready orders can jump to logistics without destructive auto-actions.
7. Open `/dashboard/logistics`.
8. Confirm summary cards show pending dispatch, sent to courier, external delivered unsettled, external failed or returned, missing tracking, and needs status sync.
9. Confirm shipment rows include quick links to the linked order, shipment detail, and courier integrations workspace where available.
10. Open `/dashboard/reports`.
11. Confirm the `Integration Health` section shows WooCommerce and courier counts, recent failures, last sync timings, and pending integration actions.
12. Export integration summary, courier failures, and WooCommerce imported orders CSV files.
13. Open `/dashboard`.
14. Confirm the compact ops cards show ready-to-ship, need-shipment, Woo sync health, and courier sync health without crowding the main dashboard.

Expected:

- cross-module visibility is clearer for day-to-day operators
- WooCommerce and courier states remain surfaced as read-only or manual-action context
- no background worker is implied by the UI
- no destructive external update path is introduced

### Order Batch Print And Dispatch Workflow

1. Open `/dashboard/orders`.
2. Filter to a manageable set of dispatch-ready or unprinted orders.
3. Select one or more rows.
4. Use:
   - `Print selected`
   - `Copy print links`
   - `Mark selected printed`
   - `Export selected CSV`
5. If needed, choose a safe target status and run `Update selected status`.
6. Confirm dispatch-ready rows still use a manual `Create Shipment in Logistics` handoff rather than automation.

Expected:

- print workflow stays browser-based only
- browser may block multiple print tabs, but the UI explains that clearly
- mark-printed updates print counts safely
- safe batch status changes preserve stock-deduction rules
- no background printing, PDF generation, or automated shipment creation is introduced

### Shipment And Reconciliation Operator Finish

1. Open `/dashboard/shipments`.
2. Use quick filters for:
   - missing tracking
   - needs sync
   - delivered
   - reconciliation pending
3. Select one or more visible rows and run a safe internal batch status update.
4. Export filtered or selected shipment CSV.
5. Open `/dashboard/logistics`, then the `Reconciliation` tab.
6. Filter by courier, reconciliation status, external status, and date range.
7. Confirm filtered totals for COD, collected, courier charge, and pending amount.
8. Export current and unsettled reconciliation CSV files.

Expected:

- shipment batch updates remain internal-only
- no courier API call is triggered by shipment batch status update
- reconciliation remains manual and visible
- no destructive courier-driven shipment or order mutation is introduced

### Admin Tools Check

1. Open `/dashboard/admin-tools`.
2. Refresh system health.
3. Download at least one CSV export.
4. Review backup guidance.
5. Review the maintenance checklist and follow one module link if a warning item is present.

Expected:
- system health returns API, database, environment, migration, and record-count data
- CSV downloads succeed with the active authenticated session
- backup guidance shows a safe `pg_dump` template without exposing secrets
- maintenance checklist shows pass/warning/fail states with useful next actions
