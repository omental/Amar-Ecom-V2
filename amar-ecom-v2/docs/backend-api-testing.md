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

## Create Shipment For An Order

```powershell
$shipmentBody = @{
  shipment_number = "SHP-API-1001"
  order_id = $order.id
  courier_id = $courier.id
  tracking_number = "TRK-123456789"
  status = "ready_to_ship"
  delivery_charge = 120
  cod_amount = 300
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
