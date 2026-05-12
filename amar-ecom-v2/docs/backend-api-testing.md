# Backend API Testing

## Prerequisites

- Backend path: `D:\Amar-eCom\amar-ecom-v2\backend`
- PostgreSQL is running
- `backend/.env` contains a working `DATABASE_URL`
- Dependencies are installed from `requirements.txt`

## Setup

From `D:\Amar-eCom\amar-ecom-v2\backend`:

```powershell
venv\Scripts\pip.exe install -r requirements.txt
```

## Run Migrations

Apply all backend migrations, including the stock movement migration:

```powershell
venv\Scripts\alembic.exe upgrade head
```

This phase adds a new migration for business settings:

- `4cdb8dc1a6f1_add_business_settings`

This phase also adds the warehouse-aware order migration:

- `36f3f4b72fa9_add_order_warehouse`

This phase adds the returns foundation migration:

- `c1d9e7d4b3a2_add_returns_foundation`

This phase adds the logistics basics migration:

- `e2a8f53b1d90_add_couriers_and_shipments`

This phase adds the supplier and purchase receiving foundation migration:

- `9ddd2d6bfef8_add_suppliers_and_purchase_orders`

This phase adds the orders parity completion migration:

- `f4a1b2c3d4e5_add_order_events_and_print_fields`

This phase adds the customer CRM parity migration:

- `a5c6d7e8f9a0_add_customer_crm_fields_and_activities`

This phase adds the team permissions and activity log migration:

- `b6d7e8f9a0b1_add_permissions_and_activity_logs`

This phase adds the inventory operations hub migration:

- `c7e8f9a0b1c2_add_stock_transfers_and_wastage_logs`

This phase adds the logistics workflow completion migration:

- `d8f9a0b1c2d3_add_logistics_shipment_events_and_reconciliation`

This phase adds the advanced invoice settings and invoice templates migration:

- `e6f7a8b9c0d1_add_advanced_invoice_settings_and_templates`

This phase adds the finance foundation migration:

- `f7a8b9c0d1e2_add_finance_foundation`

This phase adds the finance transaction-link polish migration:

- `0f1e2d3c4b5a_add_finance_transaction_links`

Reports foundation adds endpoints only and does not require a new migration.

## Start API

```powershell
venv\Scripts\uvicorn.exe app.main:app --reload
```

API base URL:

- `http://127.0.0.1:8000`

## Get Business Settings

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/settings/business `
  -Headers $headers
```

Expected result:

- returns one settings row
- creates a default row automatically if none exists yet

## Update Business Settings

```powershell
$settingsBody = @{
  company_name = "Amar eCom HQ"
  business_email = "ops@amarecom.com"
  business_phone = "+8801700000000"
  business_address = "Dhaka, Bangladesh"
  website = "https://amarecom.com"
  currency = "BDT"
  timezone = "Asia/Dhaka"
  invoice_prefix = "INV"
  order_prefix = "ORD"
  invoice_title = "Tax Invoice"
  invoice_footer_note = "Thank you for your business."
  invoice_terms = "Goods sold are non-refundable after delivery."
  payment_instructions = "Pay to bKash merchant 01XXXXXXXXX"
  invoice_template = "standard"
  invoice_accent_color = "#0f172a"
  invoice_signature_label = "Authorized Signature"
  show_logo_on_invoice = $true
  show_business_address_on_invoice = $true
  show_customer_phone_on_invoice = $true
  show_payment_status_on_invoice = $true
  show_warehouse_on_invoice = $false
  low_stock_default_threshold = 7
  tax_rate = 5
  logo_url = "https://example.com/logo.png"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/settings/business `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $settingsBody
```

Expected result:

- updated invoice configuration fields are returned in the response
- a `business_settings_updated` activity log entry is created

## Create Invoice Template

```powershell
$templateBody = @{
  name = "Bold Commercial"
  slug = "bold-commercial"
  description = "Reusable invoice wording and accent color"
  accent_color = "#123456"
  header_text = "Commercial Invoice"
  footer_text = "Template footer copy"
  terms_text = "Template terms"
  payment_instructions = "Template payment instructions"
  is_active = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/invoice-templates `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $templateBody
```

## Set Invoice Template Default

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/invoice-templates/{templateId}/set-default `
  -Method Post `
  -Headers $headers
```

Expected result:

- selected template returns with `is_default = true`
- any previous default template becomes `false`
- a `invoice_template_default_changed` activity log entry is created

## Get Order Invoice Data

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/orders/{orderId}/invoice-data `
  -Headers $headers
```

Expected result:

- response contains `order`
- response contains `business_settings`
- response contains `default_invoice_template`
- response contains `computed_invoice_metadata`
- selected or default template values override invoice title/footer/terms/payment instructions when applicable

## Create Finance Account

```powershell
$accountBody = @{
  name = "Main Cash"
  code = "CASH-001"
  account_type = "cash"
  opening_balance = 1000
  notes = "Primary operations cash"
  is_active = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/accounts `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $accountBody
```

## Create Income Transaction

```powershell
$incomeBody = @{
  transaction_number = "TXN-IN-001"
  account_id = "{accountId}"
  transaction_type = "income"
  category = "sales"
  amount = 250
  direction = "in"
  description = "Cash sale"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/transactions `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $incomeBody
```

## Create Expense Transaction

```powershell
$expenseBody = @{
  transaction_number = "TXN-OUT-001"
  account_id = "{accountId}"
  transaction_type = "expense"
  category = "office"
  amount = 100
  direction = "out"
  description = "Office supplies"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/transactions `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $expenseBody
```

## Create Transfer

```powershell
$transferBody = @{
  transaction_number = "TXN-TRF-001"
  account_id = "{sourceAccountId}"
  related_account_id = "{destinationAccountId}"
  transaction_type = "transfer"
  category = "internal_transfer"
  amount = 150
  direction = "out"
  description = "Cash to bank transfer"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/transactions `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $transferBody
```

Expected result:

- source account balance decreases
- destination account balance increases
- transfer does not inflate income or expense totals

## Create Petty Cash Entry

```powershell
$pettyCashBody = @{
  entry_number = "PC-001"
  account_id = "{accountId}"
  entry_type = "expense"
  amount = 50
  purpose = "Courier expenses"
  spent_by = "Ops"
  status = "approved"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/petty-cash `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $pettyCashBody
```

Expected result:

- if `status` is `approved` or `settled` and `account_id` is present, `transaction_created` becomes `true`
- the response includes `transaction_id`
- the selected account balance is reduced once only

## Approve Petty Cash And Verify Transaction

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/petty-cash/{entryId}" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ status = "approved" } | ConvertTo-Json)
```

Then verify:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/transactions?transaction_type=petty_cash&search=PC-001" `
  -Headers $headers
```

## Create Supplier Payment

```powershell
$supplierPaymentBody = @{
  supplier_id = "{supplierId}"
  account_id = "{accountId}"
  payment_number = "SP-001"
  amount = 200
  payment_method = "bank_transfer"
  reference = "BTRX-1001"
  notes = "Partial supplier settlement"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/supplier-payments `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $supplierPaymentBody
```

Expected result:

- supplier payment reduces the selected account balance
- response includes `transaction_id`
- a linked `supplier_payment` transaction is created automatically

## Verify Supplier Payment Transaction

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/transactions?transaction_type=supplier_payment&direction=out&search=SP-001" `
  -Headers $headers
```

## Filter Transactions

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/transactions?account_id={accountId}&transaction_type=expense&direction=out&date_from=2026-01-01T00:00:00Z&date_to=2026-12-31T23:59:59Z&search=office" `
  -Headers $headers
```

## View Finance Summary

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/finance/summary `
  -Headers $headers

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/reports/finance-summary `
  -Headers $headers

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/finance/summary?date_from=2026-01-01T00:00:00Z&date_to=2026-12-31T23:59:59Z" `
  -Headers $headers

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/finance-summary?start_date=2026-01-01T00:00:00Z&end_date=2026-12-31T23:59:59Z" `
  -Headers $headers
```

Expected result:

- total cash/bank balance reflects live account balances
- total income and expense come from non-transfer transactions, including linked supplier-payment and petty-cash transactions
- net cash flow equals income minus expense
- supplier payment total is returned separately
- date filters change income, expense, net cash flow, and supplier payment totals without changing live account balances

## Health Check

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
```

## Register

```powershell
$registerBody = @{
  full_name = "Admin User"
  email = "admin@example.com"
  password = "StrongPass123"
  role = "admin"
  is_active = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/auth/register `
  -Method Post `
  -ContentType "application/json" `
  -Body $registerBody
```

## Login

```powershell
$loginBody = @{
  email = "admin@example.com"
  password = "StrongPass123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/auth/login `
  -Method Post `
  -ContentType "application/json" `
  -Body $loginBody
```

## Store Token in PowerShell Variable

```powershell
$token = $loginResponse.access_token
$headers = @{
  Authorization = "Bearer $token"
}
```

## Create Category

```powershell
$categoryBody = @{
  name = "Electronics"
  slug = "electronics"
  description = "Electronics category"
} | ConvertTo-Json

$category = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/categories `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $categoryBody
```

## Create Brand

```powershell
$brandBody = @{
  name = "Acme"
  slug = "acme"
  description = "Acme brand"
} | ConvertTo-Json

$brand = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/brands `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $brandBody
```

## Create Product

```powershell
$productBody = @{
  name = "Sample Product"
  slug = "sample-product"
  sku = "SKU-1001"
  description = "Sample product for API test"
  category_id = $category.id
  brand_id = $brand.id
  price = 999.99
  cost_price = 650.00
  image_url = $null
  status = "active"
  variants = @()
} | ConvertTo-Json -Depth 5

$product = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/products `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $productBody
```

## Update Product

```powershell
$productUpdateBody = @{
  name = "Sample Product Updated"
  price = 1099.99
  cost_price = 700.00
  status = "active"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/products/$($product.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $productUpdateBody
```

## Create Variant

```powershell
$variantBody = @{
  name = "Blue / Large"
  sku = "SKU-1001-BL-L"
  price = 1049.99
  stock_quantity = 8
} | ConvertTo-Json

$variant = Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/products/$($product.id)/variants" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $variantBody
```

## List Variants

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/products/$($product.id)/variants" `
  -Headers $headers
```

## Update Variant

```powershell
$variantUpdateBody = @{
  name = "Blue / XL"
  price = 1079.99
  stock_quantity = 10
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/products/$($product.id)/variants/$($variant.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $variantUpdateBody
```

## Delete Variant

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/products/$($product.id)/variants/$($variant.id)" `
  -Method Delete `
  -Headers $headers
```

## Create Customer

```powershell
$customerBody = @{
  name = "Rahim Uddin"
  phone = "01700000000"
  email = "rahim@example.com"
  address = "Dhaka"
  city = "Dhaka"
  customer_type = "vip"
  tags = "repeat,priority"
  notes = "Test customer"
  follow_up_date = "2026-05-15"
} | ConvertTo-Json

$customer = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/customers `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $customerBody
```

Expected result:

- CRM fields such as `customer_type`, `tags`, and `follow_up_date` are saved
- the detail payload includes `total_order_count`, `total_spend`, and `activities`

## Filter Customers

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/customers?search=Rahim&customer_type=vip&has_follow_up=true" `
  -Headers $headers
```

Expected result:

- the filtered response includes the matching CRM customer

## Update Customer CRM Fields

```powershell
$customerUpdateBody = @{
  customer_type = "wholesale"
  tags = "priority,account"
  notes = "Moved to wholesale segment"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/customers/$($customer.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $customerUpdateBody
```

## Create Customer Activity

```powershell
$activityBody = @{
  activity_type = "follow_up"
  title = "Call customer about repeat order"
  description = "Confirm preferred delivery slot"
  due_date = "2026-05-16T10:00:00Z"
} | ConvertTo-Json

$activity = Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/customers/$($customer.id)/activities" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $activityBody
```

Expected result:

- a new activity is created for the customer
- `created_by` is included in the response
- `last_contacted_at` is updated on the customer record

## Mark Customer Activity Completed

```powershell
$activityUpdateBody = @{
  completed_at = "2026-05-16T11:00:00Z"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/customers/$($customer.id)/activities/$($activity.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $activityUpdateBody
```

## View Customer CRM Detail

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/customers/$($customer.id)" `
  -Headers $headers
```

Expected result:

- customer profile fields are returned
- recent `orders` are included when the customer is linked to orders
- `activities` are included
- `total_order_count` and `total_spend` are populated

## Create Warehouse

```powershell
$warehouseBody = @{
  name = "Main Warehouse"
  code = "MAIN-WH"
  address = "Dhaka"
  is_active = $true
} | ConvertTo-Json

$warehouse = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/warehouses `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $warehouseBody
```

## Create Inventory Item

```powershell
$inventoryBody = @{
  product_id = $product.id
  variant_id = $null
  warehouse_id = $warehouse.id
  quantity = 25
  low_stock_threshold = 5
} | ConvertTo-Json

$inventoryItem = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/inventory `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $inventoryBody
```

## Verify Initial Stock Movement

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/stock-movements?product_id=$($product.id)" `
  -Headers $headers
```

You should see a `stock_in` movement from initial inventory creation.

## Adjust Inventory Stock

```powershell
$adjustmentBody = @{
  quantity_delta = 5
  note = "Manual recount after receiving shelf stock"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/inventory/$($inventoryItem.id)/adjust" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $adjustmentBody
```

Expected result:

- the inventory quantity increases by `5`
- a stock movement is created with `movement_type` = `adjustment`
- an inventory activity log entry is created when activity logs are enabled

## Create Destination Warehouse For Transfer Tests

```powershell
$secondaryWarehouseBody = @{
  name = "Overflow Warehouse"
  code = "OVR-WH"
  address = "Gazipur"
  is_active = $true
} | ConvertTo-Json

$secondaryWarehouse = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/warehouses `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $secondaryWarehouseBody
```

## Create Stock Transfer

```powershell
$transferBody = @{
  transfer_number = "TRF-API-1001"
  from_warehouse_id = $warehouse.id
  to_warehouse_id = $secondaryWarehouse.id
  status = "pending"
  notes = "Move overflow stock closer to dispatch zone"
  items = @(
    @{
      product_id = $product.id
      variant_id = $null
      product_name = "Sample Product"
      sku = "SKU-1001"
      quantity = 3
    }
  )
} | ConvertTo-Json -Depth 5

$stockTransfer = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/stock-transfers `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $transferBody
```

Expected result:

- the transfer is created in `pending` state
- `stock_moved` is `false`

## Complete Stock Transfer

```powershell
$transferUpdateBody = @{
  status = "completed"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/stock-transfers/$($stockTransfer.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $transferUpdateBody
```

Expected result:

- source warehouse stock decreases by the transfer quantity
- destination warehouse stock increases by the transfer quantity
- `stock_moved` becomes `true`
- movement rows are created with `transfer_out` and `transfer_in`

## Create Wastage Log

```powershell
$wastageBody = @{
  wastage_number = "WST-API-1001"
  product_id = $product.id
  variant_id = $null
  warehouse_id = $warehouse.id
  quantity = 2
  reason = "Damaged packaging"
  note = "Pulled from sellable inventory after QC"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/wastage-logs `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $wastageBody
```

Expected result:

- stock is deducted immediately from the selected warehouse
- `stock_deducted` becomes `true`
- a movement row is created with `movement_type` = `wastage`
- an inventory activity log entry is created when activity logs are enabled

## Verify Transfer And Wastage Movement Records

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/stock-movements?product_id=$($product.id)&warehouse_id=$($warehouse.id)" `
  -Headers $headers
```

Expected result:

- movement history includes `adjustment`
- movement history includes `transfer_out`
- movement history includes `wastage`
- destination warehouse history includes `transfer_in`

## Create Order

```powershell
$orderBody = @{
  order_number = "ORD-API-1001"
  customer_id = $customer.id
  warehouse_id = $warehouse.id
  customer_phone = "01700000000"
  shipping_address = "House 10, Road 12, Dhaka"
  notes = "Call before delivery"
  tags = "repeat,priority"
  status = "pending"
  payment_status = "unpaid"
  source = "manual"
  subtotal = 999.99
  discount = 0
  delivery_charge = 60
  total = 1059.99
  items = @(
    @{
      product_id = $product.id
      variant_id = $null
      product_name = "Sample Product"
      sku = "SKU-1001"
      quantity = 1
      unit_price = 999.99
      total_price = 999.99
    }
  )
} | ConvertTo-Json -Depth 5

$order = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/orders `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $orderBody
```

This order is now explicitly assigned to the selected warehouse.

Expected result:

- `customer_phone`, `shipping_address`, `notes`, and `tags` are saved
- `printed_count` starts at `0`
- the order detail payload includes an `order_created` event

## Duplicate Order Check

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/orders/duplicate-check?phone=01700000000&limit=5" `
  -Headers $headers
```

Expected result:

- recent matching orders are returned
- the result is warning-only and does not block order creation

## Verify Order Detail Before Fulfillment

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/orders/$($order.id)" `
  -Headers $headers
```

At this stage:

- `status` should be `pending`
- `stock_deducted` should be `false`
- `warehouse.id` should match the selected warehouse
- `events` should include `order_created`

## Update Order to Shipped

```powershell
$orderStatusBody = @{
  status = "shipped"
} | ConvertTo-Json

$fulfilledOrder = Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/orders/$($order.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $orderStatusBody
```

Expected result:

- `status` becomes `shipped`
- `stock_deducted` becomes `true`
- an `events` entry is added with `event_type` = `status_changed`
- the event message includes the old and new statuses

## Mark Order As Printed

```powershell
$printedOrder = Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/orders/$($order.id)/mark-printed" `
  -Method Post `
  -Headers $headers
```

Expected result:

- `printed_count` increments
- `last_printed_at` is set
- an `events` entry is added with `event_type` = `order_printed`

## Verify Order Event Timeline

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/orders/$($order.id)" `
  -Headers $headers
```

Expected result:

- the detail payload includes `events`
- timeline entries should include `order_created`
- after status update, timeline entries should include `status_changed`
- after print tracking, timeline entries should include `order_printed`

## Verify Stock Reduced

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/inventory/$($inventoryItem.id)" `
  -Headers $headers
```

The inventory quantity should now be lower by the order item quantity.

This reduction should occur on the inventory row for the warehouse assigned to the order.

## Verify Stock Movement Created

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/stock-movements?order_id=$($order.id)" `
  -Headers $headers
```

Expected movement:

- `movement_type` should include `order_fulfilled`
- `order_id` should match the fulfilled order
- `warehouse_id` should match the warehouse assigned to the order

## Create Return Request

```powershell
$returnBody = @{
  return_number = "RMA-API-1001"
  order_id = $order.id
  warehouse_id = $warehouse.id
  reason = "Customer changed mind"
  resolution = "refund"
  refund_amount = 999.99
  restock_items = $true
  items = @(
    @{
      order_item_id = $order.items[0].id
      product_id = $product.id
      variant_id = $null
      product_name = "Sample Product"
      sku = "SKU-1001"
      quantity = 1
      condition = "good"
    }
  )
} | ConvertTo-Json -Depth 5

$returnRequest = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/returns `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $returnBody
```

## Update Return to Restocked

```powershell
$returnUpdateBody = @{
  status = "restocked"
  restock_items = $true
} | ConvertTo-Json

$restockedReturn = Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/returns/$($returnRequest.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $returnUpdateBody
```

Expected result:

- `status` becomes `restocked`
- `stock_restocked` becomes `true`

## Verify Inventory Increased

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/inventory/$($inventoryItem.id)" `
  -Headers $headers
```

The inventory quantity should increase by the returned quantity for the selected warehouse.

## Verify Return Stock Movement Created

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/stock-movements?order_id=$($order.id)&movement_type=return_restocked" `
  -Headers $headers
```

Expected movement:

- `movement_type` should be `return_restocked`
- `warehouse_id` should match the return warehouse
- quantity should match the returned quantity

## Create Courier

```powershell
$courierBody = @{
  name = "Steadfast"
  code = "STDF"
  contact_phone = "01700000000"
  website = "https://courier.example.com"
  is_active = $true
} | ConvertTo-Json

$courier = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/couriers `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $courierBody
```

## Check Pending Dispatch

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/logistics/pending-dispatch?skip=0&limit=20" `
  -Headers $headers
```

Expected result:

- orders in `confirmed`, `processing`, or `ready_to_ship` status appear
- orders with an active shipment are excluded
- order payload includes customer phone, shipping address, total, and warehouse summary

## Create Shipment From Order Helper

```powershell
$shipmentFromOrderBody = @{
  courier_id = $courier.id
  tracking_number = "TRK-123456789"
  delivery_charge = 120
  courier_charge = 80
  cod_amount = 300
  collected_amount = 0
  notes = "Prepared for internal dispatch"
  order_status = "ready_to_ship"
} | ConvertTo-Json

$shipment = Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/orders/$($order.id)/create-shipment" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $shipmentFromOrderBody
```

Expected result:

- shipment is created and linked to the order
- recipient fields are prefilled from order/customer values
- shipment events include `shipment_created`
- if `order_status` is provided, the order status is updated accordingly

## Create Shipment For An Order

```powershell
$shipmentBody = @{
  shipment_number = "SHP-API-1001"
  order_id = $order.id
  courier_id = $courier.id
  recipient_name = "Rahim Uddin"
  recipient_phone = "01700000000"
  delivery_address = "House 10, Road 12, Dhaka"
  tracking_number = "TRK-123456789"
  status = "ready_to_ship"
  delivery_charge = 120
  courier_charge = 80
  cod_amount = 300
  collected_amount = 0
  reconciliation_status = "pending"
  notes = "Prepared for courier handoff"
} | ConvertTo-Json

$shipment = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/shipments `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $shipmentBody
```

## Update Shipment To Shipped

```powershell
$shipmentShippedBody = @{
  status = "shipped"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/shipments/$($shipment.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $shipmentShippedBody
```

Expected result:

- `status` becomes `shipped`
- `shipped_at` is set if it was empty
- shipment events include `status_changed`

## Update Shipment To Delivered

```powershell
$shipmentDeliveredBody = @{
  status = "delivered"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/shipments/$($shipment.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $shipmentDeliveredBody
```

Expected result:

- `status` becomes `delivered`
- `delivered_at` is set if it was empty
- if `collected_amount` was `0` and `cod_amount` is present, `collected_amount` is set automatically

## Update Shipment Reconciliation

```powershell
$shipmentReconciliationBody = @{
  courier_charge = 95
  collected_amount = 300
  reconciliation_status = "settled"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/shipments/$($shipment.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $shipmentReconciliationBody
```

Expected result:

- `courier_charge` and `collected_amount` are updated
- `reconciliation_status` becomes `settled`
- `reconciled_at` is set
- shipment events include `reconciliation_updated`

## Verify Shipment Event Timeline

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/shipments/$($shipment.id)" `
  -Headers $headers
```

Expected result:

- detail payload includes `events`
- events include `shipment_created`
- after updates, events include `status_changed`
- after reconciliation update, events include `reconciliation_updated`

## Reports: Sales Summary

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/sales-summary?start_date=2026-05-01&end_date=2026-05-31" `
  -Headers $headers
```

Expected result:

- returns `total_orders`
- returns `total_sales`
- returns `average_order_value`
- returns paid, unpaid, cancelled, and returned counts

## Reports: Order Status

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/order-status?start_date=2026-05-01&end_date=2026-05-31" `
  -Headers $headers
```

Expected result:

- grouped rows by order `status`
- each row includes `count` and `total_amount`

## Reports: Payment Status

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/payment-status?start_date=2026-05-01&end_date=2026-05-31" `
  -Headers $headers
```

Expected result:

- grouped rows by `payment_status`
- each row includes `count` and `total_amount`

## Reports: Inventory

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/inventory" `
  -Headers $headers
```

Expected result:

- returns inventory totals
- returns `low_stock_count`
- returns `out_of_stock_count`
- returns `inventory_value_at_cost`

## Reports: Stock Movement Summary

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/stock-movements-summary?start_date=2026-05-01&end_date=2026-05-31" `
  -Headers $headers
```

Expected result:

- grouped rows by `movement_type`
- each row includes `movement_count` and `total_quantity`

## Reports: Customers

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/customers" `
  -Headers $headers
```

Expected result:

- returns total customer count
- returns follow-up count
- returns counts for `vip`, `wholesale`, `reseller`, and `blocked`

## Reports: Logistics

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/logistics" `
  -Headers $headers
```

Expected result:

- returns shipment status totals
- returns unsettled reconciliation count
- returns `total_cod_amount`, `total_collected_amount`, and `total_courier_charge`

## Reports: Top Products

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/top-products?start_date=2026-05-01&end_date=2026-05-31&limit=10" `
  -Headers $headers
```

Expected result:

- returns top products by ordered quantity and revenue
- each row includes `product_name`, `sku`, `total_quantity`, and `total_revenue`
- supports optional `start_date`, `end_date`, and `limit`

## Reports: Low Stock Products

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/low-stock-products?limit=10" `
  -Headers $headers
```

Expected result:

- returns inventory rows at or below threshold
- each row includes `product_name`, `warehouse_name`, `quantity`, `low_stock_threshold`, and `stock_status`

## Reports: Revenue By Date

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/revenue-by-date?start_date=2026-05-01&end_date=2026-05-31&limit=14" `
  -Headers $headers
```

Expected result:

- returns grouped rows by report date
- each row includes `order_count` and `total_sales`

## Reports: Recent Order Activity

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/reports/recent-order-activity?limit=10" `
  -Headers $headers
```

Expected result:

- returns most recent order rows
- each row includes `order_number`, `status`, `payment_status`, `total`, `customer_name`, and `created_at`

## Create Supplier

```powershell
$supplierBody = @{
  name = "Acme Sourcing Ltd."
  contact_person = "Shahriar Ahmed"
  phone = "01700000000"
  email = "supplier@example.com"
  address = "Dhaka"
  notes = "Preferred supplier"
  is_active = $true
} | ConvertTo-Json

$supplier = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/suppliers `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $supplierBody
```

## Create Purchase Order

```powershell
$purchaseOrderBody = @{
  po_number = "PO-API-1001"
  supplier_id = $supplier.id
  warehouse_id = $warehouse.id
  status = "ordered"
  order_date = "2026-05-11"
  expected_date = "2026-05-15"
  discount = 25
  notes = "Replenishment order for low stock items"
  items = @(
    @{
      product_id = $product.id
      variant_id = $null
      product_name = "Sample Product"
      sku = "SKU-1001"
      quantity = 10
      received_quantity = 0
      unit_cost = 650.00
      total_cost = 6500.00
    }
  )
} | ConvertTo-Json -Depth 5

$purchaseOrder = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/purchase-orders `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $purchaseOrderBody
```

## Mark Purchase Order As Received

```powershell
$purchaseOrderReceiveBody = @{
  status = "received"
} | ConvertTo-Json

$receivedPurchaseOrder = Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/purchase-orders/$($purchaseOrder.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $purchaseOrderReceiveBody
```

Expected result:

- `status` becomes `received`
- `stock_received` becomes `true`
- `received_date` is set if it was empty

## Verify Inventory Increased After Purchase Receiving

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/inventory?skip=0&limit=100" `
  -Headers $headers
```

Expected result:

- an inventory row exists for the purchase order product and selected warehouse
- quantity increases by `received_quantity` if it is greater than `0`
- otherwise quantity increases by the line `quantity`

## Verify Purchase Received Stock Movement

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/stock-movements?product_id=$($product.id)&warehouse_id=$($warehouse.id)&movement_type=purchase_received" `
  -Headers $headers
```

Expected movement:

- `movement_type` should be `purchase_received`
- `warehouse_id` should match the purchase order warehouse
- quantity should match the received stock quantity

## Stock Movement Detail Endpoint

Use an ID from the list response above:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/stock-movements/PUT_MOVEMENT_UUID_HERE" `
  -Headers $headers
```

## Run Automated Tests

```powershell
venv\Scripts\pytest.exe -q
```

## Seed Default Permissions

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/permissions/seed-defaults `
  -Method Post `
  -Headers $headers
```

Expected result:

- missing standard permissions are created
- repeated calls only create missing entries

## List Permissions

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/permissions `
  -Headers $headers
```

## Assign Permissions To User

Use IDs from the permission list response above:

```powershell
$permissionUpdateBody = @{
  permission_ids = @(
    "PUT_ORDERS_VIEW_PERMISSION_UUID_HERE",
    "PUT_CUSTOMERS_VIEW_PERMISSION_UUID_HERE"
  )
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/users/PUT_USER_UUID_HERE/permissions" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $permissionUpdateBody
```

Expected result:

- `assigned_permission_keys` includes values such as `orders.view`
- admin users still report `has_full_access = true`

## Check Login Response Permissions

```powershell
$teamLoginBody = @{
  email = "staff.user@example.com"
  password = "StrongPass123"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/auth/login `
  -Method Post `
  -ContentType "application/json" `
  -Body $teamLoginBody
```

Expected result:

- login response includes top-level `permissions`
- explicit users receive only assigned permission keys
- admin and super admin users receive full default access keys

## View Activity Logs

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/activity-logs?module=team&limit=20" `
  -Headers $headers
```

Expected result:

- recent team and permission changes are listed
- each row includes `user`, `action`, `module`, `entity_type`, `entity_id`, and `message`

## Verify Activity Logs After Key Actions

Check after these actions:

- create or update a user
- activate or deactivate a user
- update user permissions
- change an order status
- mark an order as printed
- create a customer activity
- update a shipment status

Example:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/activity-logs?module=orders&limit=20" `
  -Headers $headers
```
