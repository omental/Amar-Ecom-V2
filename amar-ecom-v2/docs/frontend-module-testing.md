# Frontend Module Testing

## Phase 15B Shell Clone Checks

1. Open `http://localhost:3000/login` and confirm login succeeds without breaking the existing token flow.
2. After login, confirm the dashboard shell loads using `/api/v1/auth/me` and that the sidebar visibility follows `legacy_permissions`.
3. Confirm the sidebar groups now follow the v1 order:
   - `Overview`
   - `Operations`
4. Confirm the `Orders` and `Inventory` parent nav items expand and collapse correctly and auto-open when visiting matching routes.
5. Confirm the desktop sidebar collapse toggle switches between the v1-like `240px` expanded rail and compact icon rail without causing page overflow.
6. Open `http://localhost:3000/dashboard/pos` and confirm the sidebar auto-minimizes in the v1 style.
7. Confirm the topbar shows:
   - search input
   - quick POS action
   - quick actions button
   - theme toggle
   - notifications button with unread badge
   - user profile summary
8. Open the notifications panel and confirm:
   - notifications load from the backend
   - unread count loads
   - filter chips render
   - `mark read` updates a single row
   - `mark all read` updates the full list and unread badge
9. Open the quick actions panel and confirm it overlays cleanly, supports search, and does not cause horizontal overflow.
10. Open the mobile view and confirm:
   - the mobile menu button opens the drawer
   - the overlay closes the drawer
   - the drawer keeps the same grouped nav order
   - navigation closes the drawer after selection
11. Confirm the sidebar footer still exposes the profile block and logout action.
12. Confirm there is no full-page horizontal overflow on:
   - `/dashboard`
   - `/dashboard/orders`
   - `/dashboard/inventory`
13. Note these intentional deviations:
   - `Inbox` is still excluded
   - `New Order` and `Add Product` submenu entries map to the nearest existing v2 route
   - v2-only routes remain under a secondary nav group until later exact-clone phases

## Phase 15C Dashboard Clone Checks

1. Open `http://localhost:3000/dashboard` and confirm the Phase `15B` shell still loads correctly around the dashboard page.
2. Confirm the page header now follows the v1 dashboard layout with:
   - `Dashboard` title
   - welcome subtitle
   - month filter button
   - list/grid toggle
   - `New Order` CTA
3. Open the month filter popover and confirm:
   - `All Time` and `By Month` options render
   - month chips render
   - year adjusters render
   - `Reset` and `Apply` work without breaking the layout
4. Confirm the six KPI cards render in the v1 order:
   - `TOTAL ORDERS`
   - `TOTAL SALES`
   - `TOTAL PRODUCTS`
   - `TOTAL CUSTOMERS`
   - `TOTAL COLLECTION`
   - `OUTSTANDING`
5. Confirm the middle three cards render in the v1 order:
   - `Stock Alerts`
   - `Top Sellers`
   - `Recent Order`
6. Confirm the bottom row renders in the v1 order:
   - `Store Performance`
   - `Staff Performance`
7. Confirm the year toggle updates the `Store Performance` chart without causing shell overflow.
8. Confirm `Stock Alerts` uses low-stock data from the backend and shows `Inventory healthy` when no rows are returned.
9. Confirm `Top Sellers` uses top-product report data and `Recent Order` uses recent-order report data.
10. Confirm `New Order` navigates safely to `/dashboard/orders` for now.
11. Confirm `View All` links navigate safely to:
   - `/dashboard/inventory`
   - `/dashboard/products`
   - `/dashboard/orders`
   - `/dashboard/users`
12. Confirm the `Staff Performance` card stays visually intact even when the widget shows `Awaiting Data`.
13. Confirm loading state shows `Syncing Dashboard...` and that empty or sparse data does not break any card height or grid alignment.
14. Confirm there is no full-page horizontal overflow at desktop or tablet widths.

## Phase 15D Orders Clone Checks

1. Open `http://localhost:3000/dashboard/orders` and confirm the Phase `15B` shell still loads correctly around the orders page.
2. Confirm the header now follows the v1 orders cockpit with:
   - `Order Flows` title
   - v1 subtitle
   - date filter control
   - export button
   - table/grid toggle
   - `New Order` CTA
3. Confirm the four top summary cards render in the v1 order:
   - `Total Orders`
   - `Completed Orders`
   - `Pending Orders`
   - `Cancelled Orders`
4. Confirm the status tabs render in the v1 order:
   - `All Orders`
   - `Urgent`
   - `Hold`
   - `Pending`
   - `Confirmed`
   - `Processing`
   - `Shipped`
   - `Delivered`
   - `Partial Delivered`
   - `Cancelled`
   - `Returned`
5. Confirm the search-first filter rhythm works without breaking layout:
   - search input
   - payment filter
   - source filter
   - warehouse filter
   - print-state filter
   - shipment-state filter
6. Toggle between table and grid view and confirm both modes show v1-style dense order metadata without horizontal shell overflow.
7. In table view, confirm rows show the v1-style dense fields:
   - order number
   - date
   - customer name
   - customer phone
   - item count
   - first item summary
   - total and due
   - status and payment state
   - shipment number or tracking context
8. Confirm row actions surface the v1 workflow loop safely:
   - `View`
   - `A5 Invoice`
   - `Ship Order`
   - `Edit`
9. Click an order number or `View` and confirm a modal opens instead of forcing the primary workflow onto `/dashboard/orders/{id}`.
10. In the detail modal, confirm the v1-style sections appear:
   - order header with order number and status
   - status stepper
   - item list
   - logistics block
   - customer details
   - totals summary
   - recent history
   - action cluster
11. In the detail modal action cluster, confirm these appear safely when allowed:
   - `Close`
   - `A5 Invoice`
   - `Print Label`
   - `Edit`
   - `Ship Order`
   - `Refresh Woo`
12. Confirm `Open Full Page` still exists only as a fallback path, not the primary workflow.
13. Click `New Order` and confirm a dedicated v1-style create workflow overlay opens from `/dashboard/orders` rather than a small embedded card.
14. In the create flow, confirm these v1-style sections are present:
   - customer and phone block
   - address and location fields
   - duplicate-warning area
   - product/items section
   - workflow fields for status, payment, and channel
   - courier and dispatch helper fields
   - totals, notes, tags, and save actions
15. Enter an 11-digit phone number and confirm the duplicate-warning panel appears when matching rows exist, but does not block order creation.
16. Create a new order and confirm:
   - the row appears in the orders list
   - totals and status render correctly
   - the shell does not overflow
17. Open an editable non-Woo order and confirm edit mode uses the same dedicated workflow overlay.
18. Confirm edit mode clearly warns that item mutation is still limited to safe backend-supported fields in this pass.
19. Create a shipment from the row action or modal action and confirm it still uses the safe internal shipment-creation path rather than destructive external courier automation.
20. For WooCommerce-sourced orders, confirm any refresh action remains guarded and manual, and that no automatic stock deduction or push-back behavior is introduced.
21. Confirm there is no full-page horizontal overflow on `/dashboard/orders` while the table itself may still scroll locally when needed.

## Phase 15E Inventory Clone Checks

1. Open `http://localhost:3000/dashboard/inventory` and confirm the Phase `15B` shell still loads correctly around the inventory page.
2. Confirm the page header now follows the v1 inventory hub with:
   - `Inventory Management` title
   - v1 subtitle
   - low-stock warning block when applicable
   - dense summary card strip
   - context-sensitive add action
3. Confirm the tab order matches v1 exactly:
   - `Products`
   - `Categories`
   - `Brands`
   - `Attributes`
   - `Warehouses`
   - `Stock`
   - `Transfers`
   - `Wastage`
   - `Purchases`
   - `Suppliers`
   - `Returns`
   - `Logs`
   - `Reports`
4. Confirm the active-tab add button changes label and behavior by tab:
   - `Add Product`
   - `Add Category`
   - `Add Brand`
   - `Add Attribute`
   - `Add Warehouse`
   - `Add Stock` or `Adjust Stock`
   - `Add Transfer`
   - `Add Wastage`
   - `Add Purchase`
   - `Add Supplier`
   - `Add Return`
5. In `Products`, confirm rows show the dense v1-style fields:
   - image
   - product name
   - type
   - SKU and barcode context
   - category and brand
   - market value
   - stock badge
   - print, edit, add-stock, and delete actions
6. Click `Print` on a product and confirm barcode or label output remains frontend-generated rather than backend-served.
7. In `Categories` and `Brands`, confirm the modal add/edit flow works and that delete actions still use the existing safe CRUD routes.
8. In `Attributes`, confirm the UI is present and usable, and that the page clearly communicates the current frontend-local persistence deviation.
9. In `Warehouses`, confirm v1-style cards or list blocks show name, location, code, status, and edit/delete controls.
10. In `Stock`, confirm rows show:
   - product name
   - SKU
   - warehouse name or code
   - quantity
   - alert level
   - stock status
   - adjustment, transfer, and wastage actions
11. Open `Adjust Stock` and confirm it still submits through `/api/v1/inventory/{id}/adjust` without bypassing stock safety rules.
12. Create a stock row if safe and confirm the row appears in the stock list without shell overflow.
13. In `Transfers`, create a transfer if safe and confirm `Complete Transfer` still relies on the guarded backend status update flow.
14. In `Wastage`, create a wastage row if safe and confirm stock deduction still uses the protected wastage backend path.
15. In `Purchases`, create a purchase order if safe and confirm `Receive Stock` still updates inventory only through the purchase-order backend status change.
16. In `Suppliers`, confirm supplier add/edit still works and that active or inactive state badges render cleanly.
17. In `Returns`, confirm rows show return number, order, customer, warehouse, refund or restock state, and that `Restock Items` still respects the existing return safety path.
18. In `Logs`, confirm all filters work without layout breakage:
   - `product_id`
   - `variant_id`
   - `warehouse_id`
   - `movement_type`
   - `date_from`
   - `date_to`
   - local search
19. In `Reports`, confirm these v1-style report sections appear:
   - `Inventory Value (Cost)`
   - `Potential Revenue`
   - `Potential Profit`
   - low stock items
   - stock movement summary
20. Confirm there is no full-page horizontal overflow on `/dashboard/inventory`, while local tab-strip scrolling remains acceptable.
21. Note these intentional Phase `15E` deviations:
   - attributes are frontend-local only
   - image input remains URL-based
   - barcode or label output remains frontend-generated

## Phase 15F CRM Clone Checks

1. Open `http://localhost:3000/dashboard/customers` and confirm the Phase `15B` shell still loads correctly around the CRM page.
2. Confirm the page header now follows the v1 CRM layout with:
   - `Customer CRM` title
   - v1 subtitle
   - `Export CRM` button
   - `Add Customer` button
3. Confirm the four top summary cards render in the v1 rhythm:
   - `Total Customers`
   - `Repeat Customers`
   - `Avg. Customer Value`
   - `Active Chats`
4. Confirm any extra CRM readiness metrics remain secondary rather than replacing the v1 primary four-card strip.
5. Confirm the main body uses the v1 split-pane structure:
   - left customer list pane
   - right selected customer detail pane
6. In the left pane, confirm the top controls match the v1 feel:
   - `All Customers` heading
   - small search field
   - `All`
   - `New`
   - `Regular`
7. Confirm the selected customer row gets the v1-style highlighted state with stronger active emphasis.
8. Confirm customer rows show the denser v1 context:
   - initials/avatar circle
   - name
   - email or fallback contact line
   - created date
   - segment badge
9. Confirm additional CRM filters work without breaking the v1 layout feel:
   - segment
   - follow-up due
   - tag
   - city
10. Select a customer and confirm the right pane updates in place without requiring route navigation.
11. In the right pane profile header, confirm these v1-style areas are present:
   - customer name
   - segment badge
   - email
   - address
   - member-since text
   - phone/contact block
   - edit and delete actions
12. Confirm the stats strip in the right pane shows:
   - total orders
   - total spend
   - average order value
   - follow-up state
13. Confirm the detail blocks show:
   - contact
   - location
   - follow-up state
   - tags
   - notes
14. Confirm `Bills` and `Order History` sections render and consume the CRM-compatible order aliases from the customer detail payload.
15. Confirm the `CRM Activities` section allows:
   - add note
   - add follow-up
   - add call
   - add message
   - mark complete
16. Confirm `Export CRM` generates frontend CSV from the currently loaded customer rows.
17. Open the add/edit customer modal and confirm it follows the v1 modal loop with fields for:
   - full name
   - phone
   - email
   - segment
   - follow-up date
   - tags
   - notes
   - address
   - city
18. Confirm the modal saves through the existing customer endpoints and that the split-pane list updates afterward.
19. Confirm the `Messages` area is visibly placeholder-only and does not imply a real backend inbox workflow.
20. Confirm `/dashboard/customers/[id]` still works as a fallback detail route, but the main CRM workflow stays on `/dashboard/customers`.
21. Confirm there is no full-page horizontal overflow on `/dashboard/customers`, while local table scrolling remains acceptable.

## Prerequisites

1. Start the backend:

```powershell
cd D:\Amar-eCom\amar-ecom-v2\backend
venv\Scripts\alembic.exe upgrade head
venv\Scripts\uvicorn.exe app.main:app --reload
```

2. Start the frontend:

```powershell
cd D:\Amar-eCom\amar-ecom-v2\frontend
npm run dev
```

3. Open `http://localhost:3000`
4. Log in with an existing backend user

## Phase 14H UI Polish Checks

1. Open `/dashboard/finance` and confirm the richer header, KPI strip, shared tabs, and warning text render without changing transaction behavior.
2. Open `/dashboard/hr` and confirm the richer header, KPI strip, and shared tab shell render while designation, employee, attendance, and salary flows still submit normally.
3. Open `/dashboard/pos` and confirm the denser KPI/header workspace renders while product search, cart updates, checkout, and success links still work.
4. Open `/dashboard/settings` and `/dashboard/admin-tools` and confirm the richer admin shell renders without changing save, export, health, or maintenance behavior.
5. Open `/dashboard/woocommerce` and `/dashboard/courier-integrations` and confirm the new shared shell styling appears while all safety warnings and manual-only behavior remain intact.

## Phase 14I Consistency Checks

1. Review `/dashboard`, `/dashboard/orders`, `/dashboard/logistics`, `/dashboard/inventory`, `/dashboard/customers`, and `/dashboard/reports` and confirm headers, KPI cards, tabs, badges, and filter bars still feel visually aligned.
2. Review `/dashboard/tasks`, `/dashboard/users`, `/dashboard/activity-logs`, `/dashboard/returns`, and `/dashboard/purchase-orders` and confirm the updated shared header, loading, empty, and error states render consistently.
3. Check common badges across finance, HR, WooCommerce, courier, order, and shipment pages for consistent tones on paid/unpaid, active/inactive, pending/processing, shipped/delivered, cancelled/returned, success/failed, and source badges.
4. Confirm batch action bars on orders and shipments still render and behave correctly after the shared styling update.
5. Note separately that a dedicated responsive/layout cleanup is still pending for shell/content horizontal overflow; do not treat that as a regression in this phase unless a route becomes unusable.

## Phase 14J Responsive Checks

1. Open `/dashboard` at `1280px` and `1024px` widths and confirm there is no full-page horizontal scrollbar and no right-side dashboard cards are clipped.
2. Open `/dashboard/orders` and confirm the page shell does not overflow horizontally while dense order tables still scroll only inside their own table region if needed.
3. Open `/dashboard/inventory` and confirm the tab strip and stock/ledger areas stay inside the page shell, with any horizontal scrolling limited to the local control or table container.
4. Open `/dashboard/woocommerce` or `/dashboard/courier-integrations` and confirm the sticky topbar, page header, tab strip, and warning cards stay within the viewport without cutting off the right edge.
5. Confirm the sidebar remains usable at tablet widths and that the topbar search/actions shrink or wrap instead of forcing shell overflow.

## Create Product

1. Open `http://localhost:3000/dashboard/products`
2. Fill in:
   - `name`
   - `slug`
   - `sku`
   - `price`
   - `cost price`
3. Select an existing category
4. Select an existing brand
5. Submit the form
6. Confirm the product appears in the table

## Edit Product

1. Open `http://localhost:3000/dashboard/products`
2. Click `Edit` on a product row for a quick update
3. Change one or more fields:
   - `name`
   - `slug`
   - `sku`
   - `price`
   - `cost price`
   - `status`
4. Save changes
5. Confirm the product table refreshes with the updated values

## Verify Product Detail Page

1. Open `http://localhost:3000/dashboard/products`
2. Click `Manage Variants` for a product
3. Confirm the detail page shows:
   - product summary
   - editable product form
   - variants section
   - inventory summary for that product

## Create Variant

1. On `/dashboard/products/{product_id}`
2. In `Create variant`, enter:
   - `name`
   - `sku`
   - `price`
   - `stock quantity`
3. Submit the form
4. Confirm the variant appears in the variants table

## Edit Variant

1. On `/dashboard/products/{product_id}`
2. Click `Edit` for a variant
3. Change `name`, `sku`, `price`, or `stock quantity`
4. Save changes
5. Confirm the row refreshes with the updated values

## Delete Variant

1. On `/dashboard/products/{product_id}`
2. Click `Delete` for a variant
3. Confirm the variant disappears from the table

## Create Warehouse

1. Open `http://localhost:3000/dashboard/warehouses`
2. Fill in:
   - `name`
   - `code`
   - optional `address`
3. Leave `is active` checked if desired
4. Submit the form
5. Confirm the warehouse appears in the table

## Create Inventory Item

1. Open `http://localhost:3000/dashboard/inventory`
2. Select a product
3. Select a warehouse
4. Enter:
   - `quantity`
   - `low stock threshold`
5. Submit the form
6. Confirm the inventory row appears in the table
7. Verify the status badge:
   - `In Stock` when quantity is above threshold
   - `Low Stock` when quantity is at or below threshold
   - `Out of Stock` when quantity is `0`
8. Click `View Stock Movements`
9. Confirm a new `stock_in` movement exists for the created inventory item

## Use Inventory Hub Tabs

1. Open `http://localhost:3000/dashboard/inventory`
2. Confirm the page shows tabs for:
   - `Stock Overview`
   - `Adjustments`
   - `Transfers`
   - `Wastage`
   - `Movement Ledger`
3. Confirm the summary cards show:
   - low-stock count
   - out-of-stock count
   - movement count

## Adjust Stock From Inventory Hub

1. Open `http://localhost:3000/dashboard/inventory`
2. In `Stock Overview`, click `Adjust Stock` on an inventory row
3. Confirm the page switches to the `Adjustments` tab
4. Choose either:
   - `New quantity`
   - `Quantity delta`
5. Enter a note
6. Submit the form
7. Confirm the stock overview table refreshes
8. Open the `Movement Ledger` tab
9. Confirm a new `adjustment` movement exists

## Create And Complete Stock Transfer

1. Open `http://localhost:3000/dashboard/inventory`
2. Go to the `Transfers` tab
3. Fill in:
   - `transfer number`
   - `from warehouse`
   - `to warehouse`
   - optional `notes`
4. Add at least one item:
   - choose a product
   - enter quantity
5. Submit the form
6. Confirm the transfer appears in the transfer list with `Not moved`
7. Click `Complete Transfer`
8. Confirm the success state appears
9. Confirm the row shows `Moved`
10. Return to `Stock Overview`
11. Confirm source stock decreased and destination stock increased

## Create Wastage Log

1. Open `http://localhost:3000/dashboard/inventory`
2. Go to the `Wastage` tab
3. Fill in:
   - `wastage number`
   - `product`
   - `warehouse`
   - `quantity`
   - optional `reason`
   - optional `note`
4. Confirm the warning explains stock will be deducted immediately
5. Submit the form
6. Confirm the new wastage log appears
7. Return to `Stock Overview`
8. Confirm the matching inventory row quantity is lower

## Verify Movement Ledger Filters

1. Open `http://localhost:3000/dashboard/inventory`
2. Go to the `Movement Ledger` tab
3. Filter by:
   - product
   - warehouse
   - movement type
4. Confirm the table narrows correctly
5. Confirm you can see records such as:
   - `stock_in`
   - `adjustment`
   - `transfer_out`
   - `transfer_in`
   - `wastage`

## Create Customer

1. Open `http://localhost:3000/dashboard/customers`
2. Fill in:
   - `name`
   - `phone`
3. Add optional:
   - `email`
   - `address`
   - `city`
   - `customer type`
   - `tags`
   - `notes`
   - `follow-up date`
4. Submit the form
5. Confirm the customer appears in the table with:
   - `customer type`
   - follow-up indicator when a date is present
   - tags/notes indicator in the CRM column

## Filter Customer Directory

1. Open `http://localhost:3000/dashboard/customers`
2. Confirm the page now shows:
   - a richer CRM operations header
   - KPI cards for customer mix and follow-up
   - quick filter chips
   - grouped search and filter controls
3. Use the search field to find the customer by name, phone, email, tags, or notes
4. Change the customer type filter
5. Confirm the list refreshes with the expected matching records

## Open Customer CRM Detail

1. From `/dashboard/customers`, click `View CRM`
2. Confirm `/dashboard/customers/{id}` loads
3. Confirm the page shows:
   - premium CRM profile header
   - badge cluster for type and follow-up
   - customer profile summary
   - total orders
   - total spend
   - pending follow-ups
   - editable CRM fields
   - recent order history
   - activity timeline

## Update Customer CRM Fields

1. On `/dashboard/customers/{id}`
2. Update one or more fields:
   - `customer type`
   - `tags`
   - `notes`
   - `follow-up date`
   - `address`
   - `city`
3. Click `Save Customer CRM`
4. Confirm the success message appears
5. Confirm the updated values remain visible after refresh

## Create Customer Activity

1. On `/dashboard/customers/{id}`
2. In the activity form, choose:
   - `activity type`
   - optional `due date`
3. Enter a title
4. Optionally add a description
5. Submit the form
6. Confirm the activity appears in the timeline
7. Confirm the customer detail summary updates if the activity affects follow-ups

## Complete Customer Activity

1. On `/dashboard/customers/{id}`
2. Find an incomplete activity
3. Click `Mark completed`
4. Confirm the activity now shows as completed
5. Open `http://localhost:3000/dashboard/activity-logs`
6. Confirm a `customers` activity entry exists

## Confirm Customer Order History

1. Create an order linked to an existing customer
2. Open that customer CRM page
3. Confirm the order appears in the recent order history section
4. Click `View order`
5. Confirm it opens `/dashboard/orders/{order_id}`

## Create Team Member

1. Open `http://localhost:3000/dashboard/users`
2. In the create form, enter:
   - `full name`
   - `email`
   - `password`
   - `role`
   - `is active`
3. Submit the form
4. Confirm the new user appears in the team table

## Seed Default Permissions

1. Open `http://localhost:3000/dashboard/users`
2. In `Permission foundation`, click `Seed Default Permissions`
3. Confirm a success message appears

## Assign Team Permissions

1. Open `http://localhost:3000/dashboard/users`
2. Click `Permissions` for a non-admin user
3. Confirm permissions are grouped by module
4. Enable a few actions such as:
   - `Orders / View`
   - `Customers / View`
   - `Shipments / Update`
5. Click `Save Permissions`
6. Confirm the success message appears

## View Activity Logs

1. Open `http://localhost:3000/dashboard/activity-logs`
2. Confirm the page loads a table with:
   - `date`
   - `user`
   - `module`
   - `action`
   - `entity`
   - `entity id`
   - `message`
3. Change the module filter
4. Confirm the table refreshes with matching entries
5. Change the user filter if desired
6. Confirm the table narrows to that user’s activity

## Create Supplier

1. Open `http://localhost:3000/dashboard/suppliers`
2. Fill in:
   - `name`
   - optional `contact person`
   - optional `phone`
   - optional `email`
   - optional `address`
   - optional `notes`
3. Leave `Supplier is active` checked if desired
4. Submit the form
5. Confirm the supplier appears in the table

## Create Purchase Order

1. Open `http://localhost:3000/dashboard/purchase-orders`
2. Fill in:
   - `PO number`
   - optional `supplier`
   - `warehouse`
   - `status`
   - optional `order date`
   - optional `expected date`
   - optional `discount`
   - optional `notes`
3. In `Purchase items`, add at least one item:
   - select a product
   - confirm `product name`, `sku`, and `unit cost` auto-fill
   - adjust `quantity` if needed
4. Confirm `subtotal` and `total` update automatically
5. Submit the form
6. Confirm the purchase order appears in the table

## Open Purchase Order Detail

1. Open `http://localhost:3000/dashboard/purchase-orders`
2. Click the purchase order number or `View`
3. Confirm the detail page shows:
   - supplier summary
   - warehouse summary
   - purchase items
   - subtotal, discount, and total
   - `stock received` state

## Mark Purchase Order As Received

1. On the purchase order detail page, change the status to `Received`
2. Confirm the warning appears:
   - `This will increase inventory and create purchase_received stock movements.`
3. Click `Update Purchase Order`
4. Confirm success message appears
5. Verify the purchase order now shows `Stock received`

## Verify Purchase Receiving Inventory Increase

1. Open `http://localhost:3000/dashboard/inventory`
2. Confirm the matching inventory row exists for the purchase order product and warehouse
3. Confirm the quantity increased by the received quantity
4. Open `http://localhost:3000/dashboard/stock-movements`
5. Confirm a `purchase_received` movement exists

## Edit Role

1. On `http://localhost:3000/dashboard/users`
2. Click `Edit` for a team member
3. Change `full name` or `role`
4. Save changes
5. Confirm the table reflects the update

## Deactivate / Reactivate User

1. On `http://localhost:3000/dashboard/users`
2. Click `Deactivate` for an active user
3. Confirm the badge changes to `Inactive`
4. Click `Activate` for an inactive user
5. Confirm the badge changes back to `Active`
6. Open `http://localhost:3000/dashboard/activity-logs`
7. Confirm `team` activity entries were created

## Test Inactive Login

1. Deactivate a non-current test user from the Team page
2. Log out from the current session
3. Attempt to log in with the inactive user
4. Confirm backend access is blocked for inactive users
5. Sign back in with an active admin user

## Create Order

1. Open `http://localhost:3000/dashboard/orders`
2. Enter an `order number` or leave it blank to let the backend generate one
3. Select a customer if needed
4. Confirm the customer phone auto-fills if the selected customer has a saved phone and the phone field is still empty
5. Select a warehouse
6. Enter:
   - optional `customer phone`
   - optional `shipping address`
   - optional `notes`
   - optional `tags`
7. Click out of the phone field if a phone is present
8. Confirm the duplicate warning panel appears with recent matching orders when applicable, but does not block order creation
9. Choose:
   - `status`
   - `payment status`
   - `source`
10. In `Order items`, add at least one item:
   - select a product
   - confirm `product name`, `sku`, and `unit price` auto-fill
   - adjust `quantity` if needed
11. Enter optional `discount`
12. Enter optional `delivery charge`
13. Confirm `subtotal` and `total` update automatically
14. Submit the form
15. Confirm the order appears in the table with badges, total, warehouse, and print count
16. Confirm any notes/tags indicator appears in the `Ops` column

## Create Return

1. Open `http://localhost:3000/dashboard/returns`
2. Select an existing order
3. Confirm the warehouse defaults from the order if available
4. Choose:
   - `resolution`
   - `refund amount`
   - `restock items` if the return should go back into inventory later
5. Add at least one return item:
   - select product
   - confirm `product name` and `sku` auto-fill
   - set quantity
   - optionally record condition
6. Submit the form
7. Confirm the return appears in the table

## Create Courier

1. Open `http://localhost:3000/dashboard/couriers`
2. Fill in:
   - `name`
   - `code`
   - optional `contact phone`
   - optional `website`
3. Leave active enabled
4. Submit the form
5. Confirm the courier appears in the table

## Use Logistics Workspace

1. Open `http://localhost:3000/dashboard/logistics`
2. Confirm tabs exist for:
   - `Pending Dispatch`
   - `Shipments`
   - `Couriers`
   - `Reconciliation`
3. Confirm the performance cards show:
   - total shipments
   - pending shipments
   - delivered shipments
   - unsettled reconciliation count

## Create Shipment From Pending Dispatch

1. Create or update an order so its status is `Confirmed`, `Processing`, or `Ready to Ship`
2. Open `http://localhost:3000/dashboard/logistics`
3. In `Pending Dispatch`, confirm the order appears
4. Click `Create Shipment`
5. Fill in:
   - `courier`
   - optional `tracking number`
   - optional `shipment number`
   - `courier charge`
   - `COD amount`
   - optional `notes`
   - optional `update order status`
6. Submit the form
7. Confirm the order disappears from pending dispatch
8. Switch to the `Shipments` tab
9. Confirm the new shipment appears with recipient and reconciliation details

## Open Reports Dashboard

1. Open `http://localhost:3000/dashboard/reports`
2. Confirm the page now shows:
   - a richer reporting header
   - a grouped date filter bar
   - report-group tabs
   - a KPI strip at the top
3. Confirm the page loads sections for:
   - `Sales Summary`
   - `Order Status`
   - `Payment Status`
   - `Inventory Value`
   - `Customer CRM`
   - `Logistics`
   - `Top Products`
   - `Low Stock Products`
   - `Revenue Overview`
   - `Recent Order Activity`
   - `Stock Movement Summary`
4. Confirm the top date filters appear with:
   - `start date`
   - `end date`
   - `refresh`

## Refresh Reports By Date

1. On `/dashboard/reports`, set a `date from`
2. Optionally set a `date to`
3. Click `Refresh`
4. Confirm the reports reload without leaving the page
5. Confirm at least `Sales Summary` and `Stock Movement Summary` respond to the selected date range
6. Confirm `Revenue Overview`, `Order Status`, `Payment Status`, `Top Products`, and `Recent Order Activity` also respond to the selected date range

## Export Reports CSV

1. Open `/dashboard/reports`
2. In `Order Status`, click `Export CSV`
3. Confirm a CSV file downloads
4. In `Top Products`, click `Export CSV`
5. Confirm a CSV file downloads
6. In `Stock Movement Summary`, click `Export CSV`
7. Confirm a CSV file downloads
8. Open any exported file and confirm the column headers match the visible report table

## Review Enhanced Report Sections

1. Open `/dashboard/reports`
2. Confirm `Revenue Overview` shows date-grouped rows with visual bars
3. Confirm `Order Status` shows visual count bars plus amount totals
4. Confirm `Payment Status` shows visual count bars plus amount totals
5. Confirm `Low Stock Products` shows:
   - product
   - warehouse
   - quantity
   - threshold
   - status
6. Confirm `Recent Order Activity` shows:
   - order number
   - customer
   - status
   - payment
   - total
   - created date

## Create Shipment

1. Open `http://localhost:3000/dashboard/shipments`
2. Fill in:
   - `shipment number`
   - `order`
   - `courier`
   - optional `tracking number`
   - `status`
   - `delivery charge`
   - `cod amount`
   - optional `notes`
3. Submit the form
4. Confirm the shipment appears in the table

## Open Shipment Detail

1. Open `http://localhost:3000/dashboard/shipments`
2. Click the shipment number or `View`
3. Confirm the detail page shows:
   - `shipment number`
   - linked `order`
   - `courier`
   - `recipient name`
   - `recipient phone`
   - `delivery address`
   - `tracking number`
   - `status`
   - `delivery charge`
   - `courier charge`
   - `cod amount`
   - `collected amount`
   - `reconciliation status`
   - `shipped at`
   - `delivered at`
   - event timeline
   - `notes`
   - `created at`
4. Click `Open Linked Order`
5. Confirm it opens `/dashboard/orders/{order_id}`

## Open Order Detail

1. From `/dashboard/orders`, click the order number or `View`
2. Confirm the detail page shows:
   - customer information
   - shipping/contact section
   - warehouse information
   - shipments related to the order if any exist
   - recipient and delivery summary if a shipment exists
   - order items
   - subtotal, discount, delivery charge, and total
   - status and payment badges
   - stock deduction state
   - tags and notes
   - print count and last printed time
   - event timeline if backend events are available

## Fulfill Order and Verify Stock Deduction

1. On the order detail page, change the status to `Shipped` or `Delivered`
2. Confirm the warning appears about stock deduction
3. Click `Update Order Status`
4. Confirm success message appears
5. Verify the order now shows `Stock deducted`
6. Confirm the event timeline includes a `status_changed` entry
7. Go back to `/dashboard/inventory`
8. Confirm the matching inventory quantity has been reduced for the warehouse assigned to the order
9. Open `http://localhost:3000/dashboard/activity-logs`
10. Confirm an `orders` activity entry exists for the status change

## Print Invoice

1. Open `/dashboard/orders`
2. Click `Print` on any order row, or open the order detail page and click `Print Invoice`
3. Confirm `/dashboard/orders/{id}/invoice` loads
4. Confirm the page shows:
   - invoice title from settings or template override
   - company name plus logo when enabled
   - business address only when enabled
   - phone and email when business settings exist
   - order number and date
   - customer phone only when enabled
   - payment status only when enabled
   - warehouse information only when enabled
   - customer and shipping address
   - line items
   - subtotal, discount, delivery charge, and total
   - footer note, terms, payment instructions, and signature label when configured
   - accent color on the print UI when configured
5. Click `Print`
6. Confirm the browser print dialog opens
7. Return to the order detail page
8. Confirm `printed_count` increased and `last printed` updated
9. Confirm the event timeline includes `order_printed`
10. Open `http://localhost:3000/dashboard/activity-logs`
11. Confirm an `orders` activity entry exists for printing

## Open Return Detail

1. From `/dashboard/returns`, click the return number
2. Confirm the detail page shows:
   - order summary
   - customer summary
   - warehouse summary
   - return items
   - refund amount
   - stock restocked state

## Restock a Return and Verify Inventory Increase

1. On the return detail page, enable `Restock eligible items`
2. Change status to `Restocked`
3. Confirm the warning appears:
   - `This will increase inventory and create stock movement records.`
4. Click `Update Return`
5. Confirm success message appears
6. Go to `/dashboard/inventory`
7. Confirm the matching inventory quantity has increased for the selected warehouse
8. Go to `/dashboard/stock-movements`
9. Confirm a `return_restocked` movement exists

## Update Shipment Status

1. Create a shipment from `/dashboard/shipments`
2. Open the shipment detail page
3. Update:
   - `courier`
   - `tracking number`
   - `status`
   - `delivery charge`
   - `cod amount`
   - `notes`
4. Change status to `Shipped`
5. Save and confirm `shipped at` is now populated
6. Change status to `Delivered`
7. Save and confirm `delivered at` is now populated
8. Open `/dashboard/orders/{id}`
9. Confirm the shipment appears in the order detail shipment section and links back to shipment detail
10. Open `http://localhost:3000/dashboard/activity-logs`
11. Confirm a `shipments` activity entry exists for the status change

## Update Shipment Reconciliation

1. Open `http://localhost:3000/dashboard/logistics`
2. Go to the `Reconciliation` tab
3. Pick a shipment and click `Update`
4. Change:
   - `courier charge`
   - `collected amount`
   - `reconciliation status`
5. Save the update
6. Confirm the row refreshes with the new reconciliation badge
7. Open the shipment detail page
8. Confirm `reconciled at` updates when status is `Matched` or `Settled`
9. Confirm the event timeline includes a reconciliation event

## Verify Stock Movement History

1. Open `http://localhost:3000/dashboard/stock-movements`
2. Confirm the latest table includes:
   - initial `stock_in` for inventory creation
   - `order_fulfilled` for the shipped or delivered order
   - `return_restocked` for a restocked return
3. Verify:
   - `product`
   - `warehouse`
   - `quantity`
   - `previous quantity`
   - `new quantity`
   - `order id`
   - `note`

## Verify Dashboard Stats

1. Open `http://localhost:3000/dashboard`
2. Confirm the cards load counts for:
   - `Orders`
   - `Purchase Orders`
   - `Shipments`
   - `Suppliers`
   - `Products`
   - `Customers`
   - `Inventory`
3. After creating records, refresh the page
4. Confirm the counts reflect the latest backend data
5. Confirm the logistics widget shows:
   - `Pending shipments`
   - `Delivered shipments`
   - `Pending dispatch`
   - `Unsettled reconciliation`
6. Confirm the CRM card shows:
   - `Customers with follow-up dates`
7. Confirm the inventory pulse area shows:
   - `Low-stock watch`
   - `Out-of-stock count`
   - `Recent movements`
8. Confirm the dashboard includes a link to:
   - `Open Reports`

## Test Settings Page

1. Apply the latest backend migration:
   - `venv\Scripts\alembic.exe upgrade head`
2. Open `http://localhost:3000/dashboard/settings`
3. Confirm the page loads current business settings from the API
4. Update:
   - `company name`
   - `business email`
   - `business phone`
   - `business address`
   - `website`
   - `currency`
   - `timezone`
   - `invoice prefix`
   - `order prefix`
   - `invoice title`
   - `footer note`
   - `terms`
   - `payment instructions`
   - `selected template`
   - `accent color`
   - `signature label`
   - invoice visibility toggles
   - `default low stock threshold`
   - `tax rate`
   - `logo URL`
5. Save the form
6. Confirm the success message appears
7. Open the `Invoice Templates` tab
8. Create a template with:
   - `name`
   - `slug`
   - `description`
   - `accent color`
   - `header text`
   - `footer text`
   - `terms text`
   - `payment instructions`
9. Confirm the template appears in the active list
10. Click `Set default`
11. Confirm the template shows the `Default` badge
12. Use the `Preview Invoice` link if available
13. Confirm the latest order invoice reflects the saved settings and template values
14. Open `http://localhost:3000/dashboard`
15. Confirm the dashboard intro text now reflects the updated `company name`
16. Confirm the quick links area includes:
   - `Activity Logs`
   - `Team Permissions`
   - `Preview Invoice` when at least one order exists

## Test Finance Workspace

1. Apply the latest backend migration:
   - `venv\Scripts\alembic.exe upgrade head`
2. Open `http://localhost:3000/dashboard/finance`
3. Confirm the page loads tabs for:
   - `Overview`
   - `Accounts`
   - `Transactions`
   - `Petty Cash`
   - `Supplier Payments`
4. In `Accounts`, create:
   - one `cash` account
   - one `bank` account
5. Confirm both accounts appear with opening and current balances
6. In `Transactions`, create:
   - one `income` transaction with direction `in`
   - one `expense` transaction with direction `out`
   - one `transfer` with a destination account
7. Confirm insufficient-balance validation appears if a cash/bank/mobile-banking account would go negative
8. In `Petty Cash`, create an entry and save it as `pending` or `approved`
9. Update at least one petty cash row to `approved`, `rejected`, or `settled`
10. In `Supplier Payments`, create a payment using an existing supplier and finance account
11. Confirm the success message notes that a linked transaction was recorded automatically
12. In `Transactions`, filter by:
   - account
   - transaction type
   - direction
   - date from
   - date to
   - search
13. Click `Refresh`
14. Confirm the list narrows correctly and includes linked `supplier_payment` or `petty_cash` transactions when relevant
15. Click `Clear filters`
16. Confirm the full list returns
17. In `Petty Cash`, approve or settle a pending entry with a linked account
18. Confirm the warning explains that approving/settling will create a petty cash transaction and reduce the selected account balance
19. Confirm the petty cash row shows that a transaction was created
20. Use the export buttons for:
   - `Accounts CSV`
   - `Transactions CSV`
   - `Petty Cash CSV`
   - `Supplier Payments CSV`
21. Confirm each CSV downloads and includes visible row data
22. Return to `Overview`
23. Set `date from` and `date to`
24. Click `Refresh`
25. Confirm the cards show:
   - `Cash / Bank Balance`
   - `Total Income`
   - `Total Expense`
   - `Net Cash Flow`
   - `Pending Petty Cash`
   - `Supplier Payments`
26. Confirm the recent transactions list updates after transaction creation
27. Open `http://localhost:3000/dashboard`
28. Confirm the dashboard includes:
   - a `Finance Cash` summary card
   - an `Open Finance` link

## Notes

- The frontend reads the API base URL from `NEXT_PUBLIC_API_BASE_URL`
- Protected dashboard pages use the JWT token stored in `localStorage`
- Order stock is deducted when status moves from `pending`, `confirmed`, `processing`, or `ready_to_ship` into a fulfilled state such as `shipped` or `delivered`
- New orders can be assigned to a warehouse so fulfillment deducts from that warehouse-specific inventory row
- Older orders without a warehouse still use the fallback inventory selection behavior
- Duplicate checking is warning-only and currently uses phone matching against `orders.customer_phone` and linked customer phone values
- Print tracking uses a browser-print flow and increments `printed_count` through the backend when the print action is used from the invoice page or order detail
- Invoice rendering now uses `/api/v1/orders/{id}/invoice-data` so business settings and the selected/default template shape the print payload together
- Customer CRM detail includes recent order history and a manual activity timeline
- Customer follow-up counts on the dashboard are currently based on customers with `follow_up_date` set
- Inventory operations now run from the inventory hub, but transfers only move stock when a transfer is explicitly completed
- Wastage logs deduct stock immediately and do not currently support reversal from the UI
- Team permissions are assignment-based and do not yet hide every page or button in the UI
- Activity logs currently cover selected high-value actions rather than every route in the system
- Pending dispatch excludes orders that already have an active shipment unless that shipment was cancelled or returned
- Reports in this phase are operational summaries and enhancements, not full finance reports or accounting statements
- Finance in this phase is a practical operational foundation only: accounts, transactions, petty cash, supplier payments, and summary visibility
- Finance polish in this phase adds linked supplier-payment and petty-cash transactions, browser CSV export, transaction filtering, and date-filtered summary totals
- HR in this phase is a practical foundation only: designations, employees, attendance, salary advances, salary records, and summary visibility without payroll posting

## Test Tasks Workspace

1. Apply the latest backend migration:
   - `venv\Scripts\alembic.exe upgrade head`
2. Open `http://localhost:3000/dashboard/tasks`
3. Confirm the top cards show:
   - `Total`
   - `Todo`
   - `In Progress`
   - `Review`
   - `Completed`
   - `Overdue`
   - `Urgent`
   - `My Open`
4. In the task form, create a task with:
   - `title`
   - optional `description`
   - `status`
   - `priority`
   - optional `assigned user`
   - optional related module/entity values
   - optional `due date`
5. Confirm the task appears in the list view
6. Use filters for:
   - status
   - priority
   - assigned user
   - search
7. Click `Apply filters`
8. Confirm the task list narrows correctly
9. Click `Clear filters`
10. Click `Edit` on a task and change:
   - status
   - priority
   - assignee
11. Save the task
12. Confirm the list refreshes
13. Switch to `Kanban View`
14. Confirm columns exist for:
   - `Todo`
   - `In Progress`
   - `Review`
   - `Completed`
15. Use the quick status dropdown on a kanban card
16. Confirm the card moves to the matching column after refresh
17. Open `http://localhost:3000/dashboard`
18. Confirm the dashboard includes:
   - a `Tasks` count card
   - a task workload snapshot
   - an `Open Tasks` link

## Test HR Workspace

1. Apply the latest backend migration:
   - `venv\Scripts\alembic.exe upgrade head`
2. Open `http://localhost:3000/dashboard/hr`
3. Confirm the page loads tabs for:
   - `Overview`
   - `Designations`
   - `Employees`
   - `Attendance`
   - `Salary Advances`
   - `Salary Records`
4. In `Designations`, create a designation and confirm it appears in the list
5. In `Employees`, create an employee with:
   - employee code
   - full name
   - optional email/phone/address
   - designation
   - optional linked user
   - joining date
   - salary
   - employment status
6. Confirm the employee appears in the list
7. In `Attendance`, create an attendance record
8. Confirm duplicate attendance for the same employee and date shows a clean error
9. Use attendance filters for:
   - employee
   - status
   - date range
10. Confirm the list refreshes correctly
11. In `Salary Advances`, create an advance
12. Confirm the warning explains approval does not post a finance transaction yet
13. Change the advance status to `Approved`
14. Confirm the row shows approved timing and approver information when available
15. In `Salary Records`, create a salary record
16. Confirm the net salary preview updates before save
17. Save the salary record and confirm the backend-calculated `net salary` appears in the list
18. Mark the salary record `Paid`
19. Confirm the row shows `paid at`
20. Open `http://localhost:3000/dashboard`
21. Confirm the dashboard includes:
   - an `Employees` card
   - an HR snapshot
   - an `Open HR` link

## Test POS Workspace

1. Apply the latest backend migration:
   - `venv\Scripts\alembic.exe upgrade head`
2. Open `http://localhost:3000/dashboard/pos`
3. Confirm the top cards show:
   - `Today POS Orders`
   - `Today POS Sales`
   - `Today Paid`
   - `Today Due`
4. Select a warehouse in `Product search`
5. Search by product name or SKU
6. Confirm each result shows:
   - product name
   - SKU
   - price
   - available stock
   - `Add` button
7. Add one or more in-stock items to the cart
8. Confirm the cart supports:
   - quantity increase/decrease
   - direct quantity entry
   - item removal
9. Confirm the cart totals update for:
   - `Subtotal`
   - `Discount`
   - `Total`
   - `Paid amount`
   - `Due amount`
   - `Change amount`
10. In `Checkout`, optionally select an existing customer or leave it as walk-in
11. Enter:
   - optional walk-in customer name
   - optional phone
   - payment method
   - optional finance account
   - discount
   - paid amount
   - optional notes
12. Submit the checkout
13. Confirm a success message appears with the created order number
14. Confirm the success area shows:
   - `View Order`
   - `Print Receipt/Invoice`
15. Click `View Order`
16. Confirm the order detail shows:
   - source `POS`
   - walk-in customer name when used
   - payment method
   - paid and due totals
17. Click `Print Receipt/Invoice`
18. Confirm the invoice page opens and uses the stored walk-in customer name
19. Open `http://localhost:3000/dashboard/inventory`
20. Confirm the selected warehouse stock decreased immediately
21. Open `http://localhost:3000/dashboard/stock-movements`
22. Confirm a `pos_sale` movement exists
23. If a finance account was selected, open `http://localhost:3000/dashboard/finance`
24. Confirm a `customer_payment` transaction exists for the POS order
25. Open `http://localhost:3000/dashboard`
26. Confirm the dashboard includes:
   - a `POS Sales` summary card
   - a POS snapshot
   - an `Open POS` link
- CSV export is browser-generated from the currently loaded report data
- Charts are implemented with lightweight CSS-based bars rather than a new chart dependency
- Return restocking increases inventory only when status moves to `restocked` and `restock_items` is enabled
- Logistics in this phase is internal-only tracking; no external courier API integration is performed
- Purchase receiving can create a missing inventory row safely for the selected warehouse when stock is first received from a purchase order
- POS in this phase is a practical internal counter-sale foundation only: warehouse-first product search, walk-in customer capture, immediate stock deduction, optional finance transaction capture, and invoice/receipt handoff without barcode hardware or offline mode

## Stabilization Checks

1. Run `npm run lint`
2. Run `npm run build`
3. If build fails with a Windows `.next` `EPERM` lock:
   - run `taskkill /F /IM node.exe`
   - run `Remove-Item -Recurse -Force .next`
   - run `npm run build` again

Expected result:

- lint should pass cleanly
- build should pass once locked `.next` artifacts are released
- if build fails because `next/font` cannot download Google-hosted fonts such as `Geist`, treat that as an environment issue rather than a courier feature failure

Release-candidate audit result on 2026-05-16:

- `npm run lint` passed
- `npx tsc --noEmit` passed
- `npm run build` failed only because `next/font/google` could not fetch `Geist` and `Geist Mono` in the current environment

## Workflow Hardening Checks

1. Sign in as an admin user and confirm the full sidebar is still visible
2. If you have a non-admin user with explicit limited permissions, sign in and confirm the sidebar hides unrelated modules lightly without blocking admins
3. Open `http://localhost:3000/dashboard/orders`
4. Confirm recent orders now show clearer indicators for:
   - stock deducted
   - shipment linked
   - notes/tags
   - printed count
5. Confirm dispatch-ready orders show a clearer `Create Shipment` path and shipped-linked rows show `View Shipment`
6. Open `http://localhost:3000/dashboard/logistics`
7. In `Pending Dispatch`, test:
   - search by order/customer/phone
   - status filter
   - warehouse filter
   - order-detail quick link
8. In `Reconciliation`, test:
   - reconciliation status filter
   - courier filter
9. Open `http://localhost:3000/dashboard/settings`
10. Confirm:
   - invoice preview tips are visible
   - default template state is clearer
   - preview fails gracefully when no orders exist
11. Open `http://localhost:3000/dashboard/reports`
12. Confirm `Low Stock Products` and `Recent order activity` now export CSV in the browser

## Admin Tools Checks

1. Open `http://localhost:3000/dashboard/admin-tools`
2. Confirm the page loads sections for:
   - `System Health`
   - `Data Export`
   - `Backup Guidance`
   - `Maintenance Checklist`
3. In `System Health`, click `Refresh`
4. Confirm API status, database status, environment, migration state, and record counts render without runtime errors
5. In `Data Export`, download at least one CSV and confirm the browser starts the file download
6. In `Backup Guidance`, confirm the page shows:
   - `pg_dump` command template
   - folders to back up
   - restore checklist
   - `.env` warning
7. In `Maintenance Checklist`, confirm pass/warning/fail badges, recommended action text, and module links render correctly
8. Open `http://localhost:3000/dashboard/settings`
9. Confirm there is now an `Admin Tools` link for backup/export operations

## WooCommerce Workspace Checks

1. Apply the latest backend migration:
   - `venv\Scripts\alembic.exe upgrade head`
2. Open `http://localhost:3000/dashboard/woocommerce`
3. Confirm `backend/.env` includes `FERNET_SECRET_KEY` or `APP_SECRET_KEY` if you want the dedicated encryption warning to clear
4. In `Connection Settings`, enter:
   - `store URL`
   - `consumer key`
   - `consumer secret`
   - `api version`
5. Save the settings
6. Confirm the page indicates keys are never displayed after save
7. Confirm the page shows:
   - saved key state
   - saved secret state
   - masked key value when available
   - encryption warning only when needed
8. Click `Test connection`
9. Confirm the page shows the last test status, message, and timestamp
10. Open `Sync Schedule`
11. Confirm the page shows:
   - ready or needs-review state
   - auto-sync enabled state
   - product sync enabled state
   - order sync enabled state
   - interval minutes
   - last product sync
   - last order sync
   - last sync status and message
   - failed recent sync count
12. Confirm warnings appear when the connection has not been tested successfully or when auto-sync is enabled without a worker
13. Toggle one or more schedule settings and save
14. Confirm the page keeps credentials hidden and updates the schedule values
15. Use `Run manual sync`
16. Confirm the page shows:
   - loading state while the sync is running
   - status
   - started and finished timestamps
   - product and order result summaries
   - row-level messages when rows are returned
17. Confirm `since last sync` can be toggled without showing any write-back behavior
18. Confirm the sync schedule note explains that manual sync now refreshes existing WooCommerce products and orders, then imports new changed rows
19. Open `Product Import`
20. Load a WooCommerce product preview
21. Confirm the table shows:
   - select checkbox
   - external id
   - name
   - sku
   - duplicate status badge
   - local product link when matched
   - price
   - Woo stock when available
   - status
   - category
22. Confirm existing product matches are disabled by default unless `Include existing matches` is enabled
23. If no rows are returned, confirm the page shows a clear empty state instead of a blank table
24. Select one or more products and click `Import selected`
25. Confirm the import summary shows:
   - imported
   - skipped
   - failed
   - compact row-level messages
26. Use `Refresh imported products`
27. Confirm the panel allows:
   - since last sync
   - per page
   - search
28. Run a product refresh and confirm the result summary shows:
   - refreshed
   - imported
   - skipped
   - failed
   - row-level messages
29. Open a WooCommerce-sourced product in `/dashboard/products/{id}`
30. Confirm the detail page shows:
   - WooCommerce source badge
   - external status
   - external synced timestamp when available
   - external stock quantity when available
   - `Refresh from WooCommerce` button
   - warning that refresh does not overwrite local inventory
31. Open `Order Import`
32. Load a WooCommerce order preview with or without a status filter
33. Confirm the table shows:
   - select checkbox
   - external id
   - number
   - customer
   - duplicate status badge
   - local order link when matched
   - status
   - total
   - created at
34. Confirm existing order matches are disabled by default unless `Include existing matches` is enabled
35. If no rows are returned, confirm the page shows a clear empty state instead of a blank table
36. Select one or more orders and click `Import selected`
37. Confirm the import summary shows:
   - imported
   - skipped
   - failed
   - compact row-level messages
38. Use `Refresh imported orders`
39. Confirm the result summary shows:
   - refreshed
   - imported
   - skipped
   - failed
   - row-level messages
40. Confirm imported WooCommerce orders remain informational imports and do not deduct local stock automatically in this phase
41. Open `Sync Logs`
42. Confirm the log table shows:
   - date
   - sync type
   - status
   - external id
   - local entity
   - message
   - user
   - `View details` button
43. Apply filters for:
   - sync type
   - status
   - external id
44. Confirm the sync type filter includes `product_refresh`, `products_bulk_refresh`, `order_refresh`, and `orders_bulk_refresh`
45. Open a log detail view and confirm the safe payload snapshot renders in a preformatted block without any WooCommerce key or secret value
46. Confirm local product or order links appear when the log references a local entity
47. Open a WooCommerce-sourced order in `/dashboard/orders/{id}`
48. Confirm the detail page shows:
   - WooCommerce source badge
   - external status
   - external synced timestamp
   - `Refresh from WooCommerce` button
   - warning that refresh does not deduct stock automatically

## Courier Integrations Workspace Checks

1. Apply the latest backend migration:
   - `venv\Scripts\alembic.exe upgrade head`
2. Open `http://localhost:3000/dashboard/courier-integrations`
3. Confirm the page loads tabs for:
   - `Provider Settings`
   - `Send Shipments`
   - `API Logs`
4. In `Provider Settings`, choose one of:
   - `manual`
   - `steadfast`
   - `pathao`
   - `redx`
   - `paperfly`
5. Save settings with display name, base URL, and any needed credentials
6. Confirm the page shows saved or missing credential state without revealing raw values
7. Confirm the note says credentials are stored server-side and never displayed after saving
8. If `Steadfast` is selected, confirm the page shows:
   - `Confirm endpoint/base URL with Steadfast before production.`
   - `Sandbox mode only changes labeling unless your base URL points to sandbox.`
9. Click `Test connection`
10. Confirm the page shows status, message, and last-tested timing
11. For Steadfast, confirm a configuration-check message appears cleanly when live test endpoint verification is still pending
12. Open `Send Shipments`
13. Confirm recent shipments load without runtime errors
14. Confirm shipment rows can show:
   - shipment number
   - order number
   - courier
   - recipient
   - local status
   - external provider
   - external consignment or tracking
   - external status
15. If `Steadfast` is selected, confirm the page warns about required fields:
   - recipient name
   - recipient phone
   - delivery address
   - COD amount carried from the shipment
16. Use `Send to provider` on one shipment
17. Confirm the warning explains this sends shipment data to the selected courier provider and does not change WooCommerce or local inventory
18. If send succeeds, confirm the result summary shows:
   - consignment id
   - tracking number
   - external status
   - message
19. If send fails because required shipment fields are missing, confirm the UI shows a clean error instead of pretending the send succeeded
20. Use `Sync external status` on a shipment that already has external linkage
21. Confirm the single-sync panel can opt into:
   - `Apply safe delivered status locally`
22. Confirm external status and external synced timing update safely
23. If the checkbox stays off, confirm a remote `delivered` result does not change local shipment status automatically
24. If the shipment is already in a shipped-ready local state and the checkbox is on, confirm the local shipment can move to `delivered`
25. Confirm any conflict or warning text is shown clearly in the result summary
26. Run `Bulk Status Sync`
27. Confirm filters exist for:
   - provider
   - internal status
   - limit
   - apply safe delivered status locally
28. Confirm the bulk result summary shows synced, skipped, and failed counts plus row-level warnings
29. Open `/dashboard/shipments/{id}`
30. Confirm the detail page shows external provider, consignment, tracking, and status fields when available
31. Confirm `Sync External Status` only appears when the shipment has usable external linkage
32. Confirm the detail page shows the safe delivered checkbox and warning text before sync
33. Open `/dashboard/logistics`
34. Confirm courier-linked shipments show external provider or status context without cluttering rows that have no external data
35. Confirm the top summary includes:
   - external delivered but reconciliation pending
   - external failed or returned shipments
36. Open `API Logs`
37. Filter by:
   - provider
   - action
   - status
   - shipment or external id search if available
   - message search
38. Confirm the table shows:
   - date
   - provider
   - action
   - status
   - shipment
   - external id
   - message
39. Open a log detail panel if present
40. Confirm request and response snapshots remain sanitized
41. Confirm no raw tokens, passwords, secrets, or auth headers appear anywhere in the UI

## Orders Operations Cockpit Checks

1. Open `http://localhost:3000/dashboard/orders`
2. Confirm the page now uses the denser Phase `14E` operations shell with:
   - richer operations header
   - summary card strip
   - quick filter chips
   - grouped filter bar
   - batch action bar styling
3. Confirm the top cards show:
   - `Open Orders`
   - `Ready to Ship`
   - `Need Shipment`
   - `Woo Orders`
   - `Need Woo Refresh`
   - `Unprinted`
4. Use filters for:
   - status tabs
   - payment status
   - source
   - warehouse
   - stock deducted
   - has shipment
   - printed
   - search
5. Confirm the list reloads without runtime errors
6. Confirm WooCommerce-sourced rows show:
   - source badge
   - external status when present
   - external synced timestamp when present
7. Confirm rows show:
   - shipment linked or missing
   - stock deducted indicator
   - printed count
   - courier external status when a shipment exists
8. Confirm actions now surface:
   - `View`
   - `Print`
   - `Create Shipment` when dispatch-ready
   - `Refresh Woo` only for WooCommerce-linked rows with `external_id`
   - `Open Logistics`
9. Select one or more visible rows
10. Confirm a batch action bar appears
11. Test:
   - `Print selected`
   - `Copy print links`
   - `Mark selected printed`
   - `Export selected CSV`
   - `Update selected status`
12. Confirm browser print may open multiple tabs and the warning text is clear
13. Confirm `Export filtered CSV` and `Export dispatch-ready CSV` both download browser-generated files

## Order Detail UI Checks

1. Open `http://localhost:3000/dashboard/orders/{id}`
2. Confirm the detail page now shows a denser operations header with:
   - status cluster
   - payment cluster
   - source or Woo state
   - print or sync metadata
3. Confirm the page still surfaces:
   - customer and shipping cards
   - warehouse card
   - shipment section
   - print tracking
   - totals
   - event timeline
4. For WooCommerce-sourced orders, confirm the refresh warning and action remain visible and unchanged functionally

## Inventory Hub UI Checks

1. Open `http://localhost:3000/dashboard/inventory`
2. Confirm the page now uses the denser Phase `14F` inventory shell with:
   - richer inventory header
   - KPI strip
   - stronger tabbed hub framing
3. Confirm the KPI strip shows:
   - total inventory items
   - low stock
   - out of stock
   - recent movements
   - transfers
   - wastage
4. Confirm the tabs still work for:
   - `Stock Overview`
   - `Adjustments`
   - `Transfers`
   - `Wastage`
   - `Movement Ledger`
5. In `Stock Overview`, confirm each row now makes these easier to scan:
   - product name
   - SKU
   - warehouse and code
   - quantity
   - low stock threshold
   - status badge
   - adjust action
6. Confirm adjustment, transfer, wastage, and ledger workflows still behave the same as before

## Products Admin UI Checks

1. Open `http://localhost:3000/dashboard/products`
2. Confirm the page now uses the denser Phase `14F` product-admin shell with:
   - richer header
   - KPI strip
   - grouped local filter bar
3. Confirm the KPI strip shows:
   - total products
   - active products
   - Woo products
   - variant rows
4. Use the local search and status filter
5. Confirm the visible product table narrows without runtime errors
6. Confirm rows now make these easier to scan:
   - product name
   - SKU
   - category
   - brand
   - price
   - source or Woo badge
   - external status when present
   - synced hint when present
   - variants count
7. Confirm actions still work for:
   - `Edit`
   - `Manage Variants`
   - `Refresh Woo` when applicable

## Product Detail UI Checks

1. Open `http://localhost:3000/dashboard/products/{id}`
2. Confirm the header now shows a denser summary cluster for:
   - SKU
   - price
   - active status
   - Woo stock when available
3. For WooCommerce-sourced products, confirm the refresh button and safety note still appear
4. Confirm the page still shows:
   - edit product form
   - variants section
   - inventory summary
   - category and brand detail
5. Confirm no inventory values are changed by the UI pass itself

## Categories / Brands / Warehouses UI Checks

1. Open:
   - `http://localhost:3000/dashboard/categories`
   - `http://localhost:3000/dashboard/brands`
   - `http://localhost:3000/dashboard/warehouses`
2. Confirm each page now inherits the new shell language with:
   - stronger header framing
   - improved card language
   - denser list presentation
3. Confirm create flows still work exactly as before

## Logistics Operations Cockpit Checks

1. Open `http://localhost:3000/dashboard/logistics`
2. Confirm the page now uses the denser Phase `14E` logistics shell with:
   - richer hub header
   - semantic KPI strip
   - stronger operations tabs
3. Confirm the top cards show:
   - `Pending Dispatch`
   - `Sent to Courier`
   - `External Delivered Unsettled`
   - `External Failed or Returned`
   - `Missing Tracking`
   - `Needs Status Sync`
4. Confirm shipment rows can show:
   - quick order link
   - quick shipment link
   - quick courier integrations link
   - external provider
   - external status
   - tracking or consignment context
   - reconciliation status
5. Open the `Reconciliation` tab
6. Confirm filters now support:
   - courier
   - reconciliation status
   - external status
   - date range
7. Confirm the filtered totals show:
   - COD
   - collected
   - courier charge
   - pending amount
8. Confirm `Export current CSV` and `Export unsettled CSV` both download browser-generated files

## Shipments Workspace Batch Checks

1. Open `http://localhost:3000/dashboard/shipments`
2. Confirm the page now uses the denser Phase `14E` shipment list shell with:
   - richer header
   - summary strip
   - quick filter chips
   - batch action bar
3. Confirm quick filters exist for:
   - `All`
   - `Missing tracking`
   - `Needs sync`
   - `Delivered`
   - `Reconciliation pending`
4. Select one or more visible shipments
5. Confirm the page allows:
   - `Export filtered CSV`
   - `Export selected CSV`
   - batch status update for selected shipments
6. Confirm the batch status update stays internal-only and does not trigger courier API calls

## Shipment Detail UI Checks

1. Open `http://localhost:3000/dashboard/shipments/{id}`
2. Confirm the header now shows clearer:
   - internal status
   - recipient summary
   - reconciliation state
   - linked order metadata
3. If the shipment has external linkage, confirm the safe apply checkbox and `Sync External Status` action remain visible
4. Confirm the right-side summary still shows:
   - external provider
   - external tracking or consignment
   - external status
   - external synced time
   - reconciliation values
   - event timeline

## Reports Integration Health Checks

1. Open `http://localhost:3000/dashboard/reports`
2. Confirm the `Integration Health` section shows:
   - WooCommerce orders count
   - WooCommerce products count
   - Woo recent sync failures
   - Woo last product sync
   - Woo last order sync
   - courier sent count
   - courier recent failures
   - external delivered count
   - external failed or returned count
   - pending integration actions
3. Confirm browser CSV export works for:
   - integration summary
   - courier failures
   - WooCommerce imported orders
4. Confirm the management widget shows last Woo sync timestamps clearly and uses semantic badges or KPI styling for failure and pending-action counts

## Dashboard Ops Snapshot Checks

1. Open `http://localhost:3000/dashboard`
2. Confirm the dashboard now surfaces:
   - `Ready to Ship`
   - `Need Shipment`
   - `Woo Sync Health`
   - `Courier Sync Health`
3. Confirm the cards stay compact and do not crowd out the existing dashboard content
