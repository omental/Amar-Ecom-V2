# Frontend Module Testing

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
2. Use the search field to find the customer by name, phone, email, tags, or notes
3. Change the customer type filter
4. Confirm the list refreshes with the expected matching records

## Open Customer CRM Detail

1. From `/dashboard/customers`, click `View CRM`
2. Confirm `/dashboard/customers/{id}` loads
3. Confirm the page shows:
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
   - `tracking number`
   - `status`
   - `delivery charge`
   - `cod amount`
   - `shipped at`
   - `delivered at`
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

## Print Invoice

1. Open `/dashboard/orders`
2. Click `Print` on any order row, or open the order detail page and click `Print Invoice`
3. Confirm `/dashboard/orders/{id}/invoice` loads
4. Confirm the page shows:
   - company name, address, phone, and email when business settings exist
   - order number and date
   - customer and shipping address
   - line items
   - subtotal, discount, delivery charge, and total
5. Click `Print`
6. Confirm the browser print dialog opens
7. Return to the order detail page
8. Confirm `printed_count` increased and `last printed` updated
9. Confirm the event timeline includes `order_printed`

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
6. Confirm the CRM card shows:
   - `Customers with follow-up dates`

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
   - `default low stock threshold`
   - `tax rate`
   - `logo URL`
5. Save the form
6. Confirm the success message appears
7. Open `http://localhost:3000/dashboard`
8. Confirm the dashboard intro text now reflects the updated `company name`

## Notes

- The frontend reads the API base URL from `NEXT_PUBLIC_API_BASE_URL`
- Protected dashboard pages use the JWT token stored in `localStorage`
- Order stock is deducted when status moves from `pending`, `confirmed`, `processing`, or `ready_to_ship` into a fulfilled state such as `shipped` or `delivered`
- New orders can be assigned to a warehouse so fulfillment deducts from that warehouse-specific inventory row
- Older orders without a warehouse still use the fallback inventory selection behavior
- Duplicate checking is warning-only and currently uses phone matching against `orders.customer_phone` and linked customer phone values
- Print tracking uses a browser-print flow and increments `printed_count` through the backend when the print action is used from the invoice page or order detail
- Customer CRM detail includes recent order history and a manual activity timeline
- Customer follow-up counts on the dashboard are currently based on customers with `follow_up_date` set
- Return restocking increases inventory only when status moves to `restocked` and `restock_items` is enabled
- Logistics in this phase is internal-only tracking; no external courier API integration is performed
- Purchase receiving can create a missing inventory row safely for the selected warehouse when stock is first received from a purchase order
