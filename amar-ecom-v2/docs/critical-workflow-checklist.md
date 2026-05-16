# Critical Workflow Checklist

Last reviewed: 2026-05-12

Use this as a manual smoke pass after migrations and before release candidates.

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
16. Confirm external status and synced time update safely.
17. Open `API Logs`.
18. Filter by provider, action, and status.
19. Review at least one log entry or detail panel.
20. Open `/dashboard/admin-tools` and confirm the maintenance checklist includes courier integration readiness.

Expected:
- provider credentials are encrypted server-side and never returned raw
- connection testing creates a courier API log entry
- manual send creates an external courier event and API log entry
- external status sync updates safe shipment metadata only
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
