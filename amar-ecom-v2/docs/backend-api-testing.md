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

This phase adds the tasks foundation migration:

- `1a2b3c4d5e6f_add_tasks_foundation`

This phase adds the HR foundation migration:

- `2b3c4d5e6f7a_add_hr_foundation`

This phase adds the POS order-fields migration:

- `3c4d5e6f7a8b_add_pos_order_fields`

Reports foundation adds endpoints only and does not require a new migration.

Phase 11C adds admin tooling endpoints only and does not require a new migration.

Phase 12A adds the WooCommerce sync foundation migration:

- `4d5e6f7a8b9c_add_woocommerce_sync_foundation`

Phase 12B WooCommerce sync hardening adds no new migration.

Phase 12D WooCommerce scheduled-sync foundation adds a new migration:

- `5e6f7a8b9c0d_add_woocommerce_sync_schedule_fields`

Phase 12E WooCommerce order lifecycle sync adds a new migration:

- `6f7a8b9c0d1e_add_order_external_sync_fields`

Phase 12F WooCommerce product lifecycle sync adds a new migration:

- `7a8b9c0d1e2f_add_product_external_sync_fields`

Phase 13A external courier API foundation adds a new migration:

- `8b9c0d1e2f3a_add_courier_integrations_foundation`

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

## Create Task

```powershell
$taskBody = @{
  title = "Review blocked orders"
  description = "Check pending order blockers and update the ops team"
  status = "todo"
  priority = "high"
  assigned_to_id = "{userId}"
  related_module = "orders"
  related_entity_type = "order"
  related_entity_id = "{orderId}"
  due_date = "2026-05-20T09:00:00Z"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/tasks `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $taskBody
```

## Filter Tasks

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/tasks?status=todo&priority=high&assigned_to_id={userId}&search=blocked" `
  -Headers $headers
```

## Change Task Status

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/tasks/{taskId}" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ status = "completed" } | ConvertTo-Json)
```

Expected result:

- `completed_at` is set when status becomes `completed`
- changing away from `completed` clears `completed_at`

## View Tasks Summary

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/tasks/summary `
  -Headers $headers
```

Expected result:

- returns total, todo, in-progress, review, completed, overdue, urgent, and my-open counts

## Verify Task Activity Logs

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/activity-logs?module=tasks&limit=20" `
  -Headers $headers
```

Expected result:

- includes `task_created`
- includes `task_updated`
- includes `task_status_changed`
- includes `task_assigned`
- includes `task_cancelled` when cancelled through delete

## Create Designation

```powershell
$designationBody = @{
  title = "Operations Executive"
  description = "Handles order and warehouse operations"
  is_active = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/designations `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $designationBody
```

## Create Employee

```powershell
$employeeBody = @{
  employee_code = "EMP-1001"
  full_name = "Rahim Ops"
  email = "rahim.ops@example.com"
  phone = "01711111111"
  address = "Dhaka"
  designation_id = "{designationId}"
  user_id = "{userId}"
  joining_date = "2026-05-01"
  salary = 25000
  employment_status = "active"
  notes = "Core operations team"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/employees `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $employeeBody
```

## Create Attendance

```powershell
$attendanceBody = @{
  employee_id = "{employeeId}"
  attendance_date = "2026-05-12"
  status = "present"
  notes = "On time"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/attendance `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $attendanceBody
```

Expected result:

- duplicate attendance for the same employee and date returns a clean `409`

## Create Salary Advance And Approve

```powershell
$advanceBody = @{
  employee_id = "{employeeId}"
  amount = 5000
  reason = "Emergency expense"
  status = "pending"
} | ConvertTo-Json

$advance = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/salary-advances `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $advanceBody

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/salary-advances/$($advance.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ status = "approved" } | ConvertTo-Json)
```

Expected result:

- `approved_at` is set
- `approved_by_id` is set to the current user when available

## Create Salary Record And Mark Paid

```powershell
$salaryRecordBody = @{
  employee_id = "{employeeId}"
  salary_month = "2026-05"
  basic_salary = 25000
  advance_deduction = 3000
  bonus = 2000
  other_deductions = 500
  status = "generated"
} | ConvertTo-Json

$salaryRecord = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/salary-records `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $salaryRecordBody

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/salary-records/$($salaryRecord.id)" `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ status = "paid" } | ConvertTo-Json)
```

Expected result:

- `net_salary` is calculated as `basic_salary + bonus - advance_deduction - other_deductions`
- `paid_at` is set when status becomes `paid`

## Verify HR Summary

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/hr/summary `
  -Headers $headers
```

Expected result:

- returns total and active employee counts
- returns today attendance counts
- returns pending advance count
- returns salary-record totals for the current month and unpaid records

## Search POS Products

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/pos/products?warehouse_id={warehouseId}&search=SKU-1001&limit=20" `
  -Headers $headers
```

Expected result:

- warehouse-filtered product rows are returned
- each row includes `product_id`, `variant_id`, `name`, `sku`, `price`, `stock_quantity`, and `image_url`

## Create POS Checkout

```powershell
$posCheckoutBody = @{
  customer_id = $null
  customer_name = "Walk-in Buyer"
  customer_phone = "01777777777"
  warehouse_id = "{warehouseId}"
  payment_method = "cash"
  account_id = "{accountId}"
  discount = 50
  paid_amount = 500
  notes = "Counter sale"
  items = @(
    @{
      product_id = "{productId}"
      variant_id = $null
      product_name = "POS Counter Product"
      sku = "POS-1001"
      quantity = 2
      unit_price = 300
      total_price = 600
    }
  )
} | ConvertTo-Json -Depth 5

$posCheckout = Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/pos/checkout `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $posCheckoutBody
```

Expected result:

- response returns `order`, `payment_status`, `change_amount`, `due_amount`, and `order_id`
- order source is `pos`
- order status is `delivered`
- order `customer_name`, `payment_method`, and `paid_amount` are stored
- stock is deducted immediately from the selected warehouse
- `stock_deducted` becomes `true`
- an order event exists with `event_type = pos_checkout_created`
- if `account_id` is provided and `paid_amount > 0`, a linked `customer_payment` transaction is created

## Verify POS Stock Deduction

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/inventory/{inventoryItemId}" `
  -Headers $headers
```

Expected result:

- inventory quantity is reduced by the sold quantity for the selected warehouse

## Verify POS Stock Movement

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/stock-movements?order_id={orderId}&movement_type=pos_sale" `
  -Headers $headers
```

Expected result:

- movement history includes `pos_sale`
- movement `order_id` matches the POS order

## Verify POS Finance Transaction

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/transactions?transaction_type=customer_payment&search={orderNumber}" `
  -Headers $headers
```

Expected result:

- a `customer_payment` transaction exists
- `reference_type = order`
- `reference_id` matches the POS order id

## View POS Summary

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/pos/summary `
  -Headers $headers
```

Expected result:

- response includes `today_pos_orders`
- response includes `today_pos_sales`
- response includes `today_paid_amount`
- response includes `today_due_amount`

## Health Check

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
```

## Admin System Health

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/admin/system-health `
  -Headers $headers
```

Expected result:

- returns API and database service status
- returns environment
- returns migration head/current information when available
- returns record counts for users, products, orders, inventory, customers, finance accounts, tasks, and employees

## Admin Backup Guidance

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/admin/backup-guidance `
  -Headers $headers
```

Expected result:

- returns a safe `pg_dump` command template without a password
- returns folders to back up
- returns a restore checklist
- reminds operators not to commit `.env` files

## Admin Maintenance Checklist

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/admin/maintenance-checklist `
  -Headers $headers
```

Expected result:

- returns pass/warning/fail checklist items
- includes readiness checks for migrations, admin access, warehouses, finance account setup, invoice templates, permissions, low-stock workload, shipments, reconciliation, and pending tasks

## Admin CSV Export: Products

```powershell
Invoke-WebRequest `
  -Uri http://127.0.0.1:8000/api/v1/admin/exports/products `
  -Headers $headers `
  -OutFile .\products-export.csv
```

Expected result:

- response content type is `text/csv`
- filename header is set
- downloaded CSV contains compact operational columns

Repeat the same pattern for:

- `/api/v1/admin/exports/customers`
- `/api/v1/admin/exports/orders`
- `/api/v1/admin/exports/inventory`
- `/api/v1/admin/exports/stock-movements`
- `/api/v1/admin/exports/transactions`
- `/api/v1/admin/exports/suppliers`
- `/api/v1/admin/exports/purchase-orders`

## Configure WooCommerce Settings

Recommended `backend/.env` additions before saving production-like WooCommerce credentials:

```env
FERNET_SECRET_KEY=YOUR_FERNET_KEY_HERE
```

or:

```env
APP_SECRET_KEY=YOUR_APP_SECRET_KEY_HERE
```

If neither is set, the backend falls back to `SECRET_KEY`, but the WooCommerce UI will continue warning that a dedicated credential-encryption key is not configured.

```powershell
$wooSettingsBody = @{
  store_url = "https://store.example.com"
  consumer_key = "ck_xxxxxxxxxxxxxxxxxxxx"
  consumer_secret = "cs_xxxxxxxxxxxxxxxxxxxx"
  api_version = "wc/v3"
  is_active = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/woocommerce/settings `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $wooSettingsBody
```

Expected result:

- secret values are accepted for save
- read response does not expose the saved secret values
- `has_consumer_key` and `has_consumer_secret` reflect whether server-side values exist
- `consumer_key_masked` is returned when a key is stored
- raw `consumer_key` and `consumer_secret` are never returned in read responses
- `credentials_encrypted` reports whether stored credentials are already encrypted
- `encryption_warning` is returned when a dedicated env key is missing or when legacy plaintext credentials still need re-save

## Test WooCommerce Connection

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/woocommerce/test-connection `
  -Method Post `
  -Headers $headers
```

Expected result:

- returns `success`, `message`, and `tested_at`
- creates a WooCommerce sync log row
- returns clear user-facing errors for invalid URL, missing credentials, timeout, invalid credentials, unreadable WooCommerce responses, or upstream unavailability

## Review WooCommerce Sync Status

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/woocommerce/sync-status `
  -Headers $headers
```

Expected result:

- returns schedule fields without exposing secrets
- returns `ready_to_sync`, `failed_sync_count`, and `readiness_warnings`
- returns last product/order sync timestamps and overall last sync status/message
- returns imported Woo product/order counts plus recent product/order refresh failure counts
- warns clearly when credentials are missing, connection tests have not succeeded, or auto-sync is enabled without a worker

## Preview WooCommerce Products

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/woocommerce/products-preview?page=1&per_page=20&search=shirt" `
  -Headers $headers
```

Expected result:

- returns preview rows only
- includes `external_id`, `name`, `sku`, `price`, `status`, and category summary
- each row also includes `duplicate_status`, `local_product_id`, and `external_stock_quantity` when available
- does not create or update local products

## Import Selected WooCommerce Products

```powershell
$wooProductImportBody = @{
  external_ids = @("101", "102")
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/woocommerce/products-import `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $wooProductImportBody
```

Expected result:

- returns `imported_count`, `skipped_count`, and `failed_count`
- returns row-level `rows[]` entries with `external_id`, `status`, `local_entity_id`, and `message`
- imports new products into the local catalog only
- skips duplicates safely by SKU or slug
- imported WooCommerce products store `source`, `external_id`, `external_slug`, `external_status`, `external_synced_at`, and a sanitized `external_payload_snapshot`
- Woo stock quantity remains external-only metadata and does not overwrite local inventory

## Refresh One Imported WooCommerce Product

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/woocommerce/products/PUT_LOCAL_PRODUCT_UUID_HERE/refresh" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{} | ConvertTo-Json)
```

Expected result:

- only works for local products with `source = woocommerce` or a saved `external_id`
- refreshes safe metadata such as `external_status`, `external_slug`, `external_synced_at`, and sanitized snapshot payload
- preserves local description/category/image and avoids destructive price or status overwrites when local edits may exist
- creates `product_refresh` sync logs with warnings when conflicts are detected
- does not import Woo stock into local inventory

## Bulk Refresh Imported WooCommerce Products

```powershell
$wooBulkProductRefreshBody = @{
  since_last_sync = $true
  per_page = 20
  search = "shirt"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/woocommerce/products-refresh `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $wooBulkProductRefreshBody
```

Expected result:

- returns `refreshed_count`, `imported_count`, `skipped_count`, and `failed_count`
- refreshes existing WooCommerce-linked products by `source + external_id` when possible
- falls back to SKU or slug matching without destructive overwrite
- imports changed WooCommerce products that do not exist locally yet
- logs `products_bulk_refresh` rows and stores SKU/price/status/category conflicts as warnings

## Preview WooCommerce Orders

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/woocommerce/orders-preview?page=1&per_page=20&status=processing" `
  -Headers $headers
```

Expected result:

- returns preview rows only
- includes `external_id`, `number`, `customer`, `status`, `total`, and `created_at`
- each row also includes `duplicate_status` and `local_order_id` when matched
- does not create or update local orders

## Import Selected WooCommerce Orders

```powershell
$wooOrderImportBody = @{
  external_ids = @("501", "502")
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/woocommerce/orders-import `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $wooOrderImportBody
```

Expected result:

- returns `imported_count`, `skipped_count`, and `failed_count`
- returns row-level `rows[]` entries with `external_id`, `status`, `local_entity_id`, and `message`
- imported orders use source `woocommerce`
- imported orders store `external_id`, `external_number`, `external_status`, `external_synced_at`, and a sanitized `external_payload_snapshot`
- imported orders do not deduct local stock automatically in this phase
- duplicate imported orders are skipped safely by local order number

## Refresh One Imported WooCommerce Order

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/woocommerce/orders/PUT_LOCAL_ORDER_UUID_HERE/refresh" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{} | ConvertTo-Json)
```

Expected result:

- only works for local orders with `source = woocommerce`
- refreshes safe fields such as external status, payment state, phone, shipping, and external sync metadata
- creates `woocommerce_order_refreshed` order events
- creates `order_refresh` sync logs
- does not deduct stock
- does not create finance transactions
- logs warnings instead of deleting local items or force-overwriting conflict-prone changes

## Bulk Refresh Imported WooCommerce Orders

```powershell
$wooBulkRefreshBody = @{
  since_last_sync = $true
  per_page = 20
  status = "processing"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/woocommerce/orders-refresh `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $wooBulkRefreshBody
```

Expected result:

- returns `refreshed_count`, `imported_count`, `skipped_count`, and `failed_count`
- refreshes existing WooCommerce orders by `source + external_id` when possible
- imports changed WooCommerce orders that do not exist locally yet
- logs `orders_bulk_refresh` and per-order `order_refresh` rows
- logs conflicts or warnings for line-item or fulfillment mismatches instead of auto-resolving them

## View WooCommerce Sync Logs

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/woocommerce/sync-logs `
  -Headers $headers
```

Expected result:

- lists connection tests, previews, and import actions
- includes status, external id, local entity references, and message text
- supports filters for `sync_type`, `status`, `direction`, `date_from`, `date_to`, `external_id`, `limit`, and `skip`

## View WooCommerce Sync Log Detail

Use an ID from the list response above:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/woocommerce/sync-logs/PUT_LOG_UUID_HERE" `
  -Headers $headers
```

Expected result:

- returns the selected sync log row
- includes safe `payload_snapshot` content when available
- does not expose WooCommerce credentials or other secrets in the payload snapshot

## Run WooCommerce Manual Sync

```powershell
$wooRunSyncBody = @{
  sync_products = $true
  sync_orders = $true
  since_last_sync = $true
  per_page = 20
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/woocommerce/run-sync `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $wooRunSyncBody
```

Expected result:

- returns `status`, `started_at`, `finished_at`, and `message`
- returns `product_result` and `order_result` summaries when included
- refreshes existing imported WooCommerce products and imports new changed WooCommerce products when `sync_products = true`
- refreshes existing imported WooCommerce orders and imports new changed WooCommerce orders when `sync_orders = true`
- uses `modified_after` or `after` when `since_last_sync = true`
- does not deduct stock for imported WooCommerce orders
- does not push local data back to WooCommerce

## WooCommerce Safety Limitations

- read-only against WooCommerce in this phase
- credentials are encrypted at rest when saved through the hardened settings flow
- auto-sync settings are configuration-only in this phase
- no production background worker is included yet
- WooCommerce product refresh updates safe local fields only and keeps Woo stock external-only
- WooCommerce order refresh only updates safe local fields
- conflicts are logged as warnings instead of auto-resolved destructive changes
- no local push-back to WooCommerce
- no destructive WooCommerce updates

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

## Courier Integration Foundation

Phase 13A adds a safe external courier integration foundation:

- provider settings are stored server-side and secrets are encrypted
- provider reads return masked or presence metadata only
- shipment rows can store external provider, consignment, tracking, status, sync time, and sanitized payload snapshots
- courier API requests remain manual only in this phase
- no background worker is included yet
- Steadfast adapter structure is conservative and still needs endpoint confirmation before production

Phase 13B completes the Steadfast adapter into a production-shaped manual integration:

- Steadfast uses the saved `base_url` plus fixed endpoint-path constants in the adapter
- sandbox mode is labeling only unless the configured `base_url` points to a sandbox environment
- connection test currently performs a configuration check rather than a live remote probe when a safe test endpoint is not confirmed
- send-shipment validates recipient name, recipient phone, delivery address, and invoice or order number before any API call
- successful responses must return a consignment id or tracking number before the local shipment is marked as sent
- status sync uses external consignment id first and falls back to tracking number
- request and response snapshots are sanitized before storage

Phase 13C hardens courier status sync further:

- external status mapping is conservative and produces normalized status plus warnings
- `apply_safe_status` defaults to `false`
- with `apply_safe_status = false`, external delivered updates remain external-only
- with `apply_safe_status = true`, local shipment status changes only for safe delivered mapping and only when no warning/conflict blocks it
- returned, cancelled, and failed states still do not auto-apply destructively by default
- bulk manual status sync is available without adding any background worker
- courier API log filtering now supports message search in addition to provider, action, status, shipment, external id, and date filters

Supported provider keys:

- `manual`
- `steadfast`
- `pathao`
- `redx`
- `paperfly`

### List Providers

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/courier-integrations/providers `
  -Headers $headers
```

### Save Provider Settings

```powershell
$courierSettingsBody = @{
  display_name = "Steadfast Sandbox"
  base_url = "https://portal.packzy.com/api/v1"
  api_key = "sandbox-api-key"
  api_secret = "sandbox-api-secret"
  merchant_id = "sandbox-merchant"
  username = "sandbox-user"
  password = "sandbox-pass"
  is_active = $true
  is_sandbox = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/courier-integrations/providers/steadfast/settings `
  -Method Patch `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $courierSettingsBody
```

Expected result:

- response includes saved state such as `has_api_key` and `has_password`
- masked values may be returned
- raw secrets are never returned

### Read Provider Settings

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/courier-integrations/providers/steadfast/settings `
  -Headers $headers
```

Expected result:

- encrypted values remain hidden
- test metadata such as `last_tested_at` and `last_test_success` is returned when available

### Test Provider Connection

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/courier-integrations/providers/steadfast/test-connection `
  -Method Post `
  -Headers $headers
```

Expected result:

- returns clean `success`, `failed`, or `skipped` messaging
- for Steadfast, the current response may be a configuration-check message instead of a live remote probe result until the production-safe test endpoint is confirmed
- writes a `courier_api_logs` row with `action = connection_test`

### Send Shipment To Provider

```powershell
$sendShipmentBody = @{
  provider = "steadfast"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/courier-integrations/shipments/{shipmentId}/send `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $sendShipmentBody
```

Expected result:

- shipment external metadata updates only on successful provider submission
- if recipient name, phone, delivery address, or invoice/order number is missing, the API returns a clean validation error before any remote request
- if Steadfast returns success without a consignment id or tracking number, the local shipment is not marked as sent
- a shipment event is created
- a `courier_api_logs` row is created with `action = send_shipment`

### Sync Shipment External Status

```powershell
$syncShipmentBody = @{
  apply_safe_status = $false
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/courier-integrations/shipments/{shipmentId}/sync-status `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $syncShipmentBody
```

Expected result:

- external status and sync time update safely
- default behavior does not destructively update local shipment state
- response includes old external status, new external status, warnings, and whether local internal status changed
- safe status mapping may update local shipment status only when `apply_safe_status = true` and no warning/conflict blocks the change
- no destructive shipment, order, or inventory mutation occurs
- Steadfast `delivered` can safely map to internal `delivered`
- cancelled, failed, or returned states remain conservative and do not destructively rewrite unrelated local data

### Bulk Sync Shipment External Status

```powershell
$bulkSyncBody = @{
  provider = "steadfast"
  status = "shipped"
  limit = 20
  apply_safe_status = $false
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/courier-integrations/status-sync/bulk `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $bulkSyncBody
```

Expected result:

- returns `synced_count`, `skipped_count`, and `failed_count`
- row results include shipment id, shipment number, provider, old/new external status, local status changed flag, and message
- warnings are surfaced for conflict cases
- no background worker is used

### Filter Courier API Logs

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/v1/courier-integrations/logs?provider=steadfast&action=send_shipment&status=success&limit=20" `
  -Headers $headers
```

Expected result:

- logs filter by provider, action, status, shipment, external id, message search, and date window
- request and response snapshots remain sanitized
- auth headers, tokens, passwords, and secrets are never exposed

## Fresh Migration Validation On A Temporary Database

Do not drop the main development database automatically.

Recommended flow:

1. Create a temporary PostgreSQL database.
2. Point `DATABASE_URL` at the temporary database.
3. Run:

```powershell
venv\Scripts\alembic.exe upgrade head
```

4. Smoke check:
   - import `app.main`
   - call `GET /api/v1/health`
5. Drop the temporary database after validation.

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
