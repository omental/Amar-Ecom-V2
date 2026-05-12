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

### Reports Check

1. Open `/dashboard/reports`.
2. Review sales, logistics, finance, inventory, and product report widgets.
3. Export low-stock products and recent order activity as CSV.

Expected:
- report cards/tables load without runtime errors
- date-filtered finance summary responds correctly
- browser CSV exports succeed without adding chart dependencies
