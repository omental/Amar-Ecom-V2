# Firebase to PostgreSQL Mapping

## Goal

This document maps the legacy Firebase/Firestore model to a normalized PostgreSQL model for Amar eCom v2.

Priority is given to MVP modules:

- Auth
- Users
- Dashboard
- Products
- Categories
- Brands
- Customers
- Orders
- Order items
- Inventory
- Warehouses

## Mapping Principles

- move from document-oriented Firestore records to normalized relational tables
- keep audit timestamps on all major tables
- store reference integrity in PostgreSQL with foreign keys
- separate auth/session concerns from business data
- replace embedded order items with dedicated `order_items`
- replace multiple stock log concepts with a single canonical movement table

## Recommended Auth Approach

Recommended for v2 admin dashboard: HTTP-only cookie auth.

Why:

- better fit for same-origin dashboard apps
- avoids storing access tokens in browser storage
- simpler session refresh flow for App Router + FastAPI

JWT can still be used internally, but the browser-facing approach should be secure cookie based.

## Legacy to v2 Mapping

| Legacy source | Purpose in legacy app | Proposed PostgreSQL table(s) | Notes |
| --- | --- | --- | --- |
| Firebase Auth user | login identity | `users`, `user_sessions` | no direct Firebase dependency in v2 |
| `users` | profile, role, active flag, module permissions | `users`, `roles`, `user_role_assignments`, `user_module_permissions` | can be simplified to `users.role` if only one role is needed initially |
| `settings/company` | company profile and operational settings | `company_settings` | singleton table |
| `products` | product master | `products` | product header only |
| `variants` | product variants | `product_variants` | one-to-many from products |
| `categories` | product categorization | `categories` | referenced by products |
| `brands` | brand catalog | `brands` | referenced by products |
| `warehouses` | storage locations | `warehouses` | referenced by inventory |
| `inventory` | stock per product/variant/warehouse | `inventory_balances` | unique by product + variant + warehouse |
| `inventoryLogs` | stock changes | `inventory_movements` | merge with `stock_logs` concept |
| `stockLedger` | valuation-aware stock movements | `inventory_movements` | add costing fields instead of separate ledger table for MVP |
| `purchaseBatches` | cost layers / batch purchases | `inventory_batches` | optional for MVP, important if FIFO costing is needed |
| `customers` | customer CRM record | `customers` | direct module in MVP |
| `orders` | order header with embedded items | `orders`, `order_items` | split into header/detail |
| embedded `orders.items` | purchased lines | `order_items` | one row per order line |
| embedded `orders.logs` | status/activity trail | `order_events` | optional MVP, but strongly recommended |
| `deliveries` | fulfillment events | `deliveries` | later phase unless needed early |
| `couriers` | courier master | `couriers` | later phase |
| `rma_requests` | returns | `return_requests`, `return_items` | later phase |
| `activityLogs` | user audit trail | `audit_logs` | useful early for admin actions |
| `notifications` | internal alerts | `notifications`, `notification_reads` | later phase |
| `accounts` | payment accounts | `accounts` | later phase |
| `transactions` | finance ledger | `transactions` | later phase |

## Proposed MVP PostgreSQL Tables

### Auth and users

#### `users`

- `id` UUID PK
- `email` unique
- `password_hash`
- `full_name`
- `role`
- `is_active`
- `is_superuser`
- `avatar_url` nullable
- `last_login_at` nullable
- `created_at`
- `updated_at`

#### `user_module_permissions`

- `id` UUID PK
- `user_id` FK `users.id`
- `module_key`
- `can_view`
- `can_create`
- `can_update`
- `can_delete`

This table is optional if the team wants a simpler MVP. A smaller first pass could use:

- `users.role`
- hardcoded role matrix in backend/frontend

### Catalog

#### `categories`

- `id` UUID PK
- `name`
- `slug`
- `description` nullable
- `is_active`
- `created_at`
- `updated_at`

#### `brands`

- `id` UUID PK
- `name`
- `slug`
- `description` nullable
- `is_active`
- `created_at`
- `updated_at`

#### `products`

- `id` UUID PK
- `sku` unique
- `name`
- `slug`
- `description` nullable
- `category_id` FK nullable
- `brand_id` FK nullable
- `base_price`
- `cost_price`
- `reorder_point`
- `is_active`
- `has_variants`
- `created_at`
- `updated_at`

#### `product_variants`

- `id` UUID PK
- `product_id` FK `products.id`
- `sku` unique
- `name`
- `size` nullable
- `color` nullable
- `material` nullable
- `price`
- `cost_price` nullable
- `is_active`
- `created_at`
- `updated_at`

### Warehousing and stock

#### `warehouses`

- `id` UUID PK
- `name`
- `code`
- `address` nullable
- `is_active`
- `created_at`
- `updated_at`

#### `inventory_balances`

- `id` UUID PK
- `product_id` FK `products.id`
- `variant_id` FK nullable `product_variants.id`
- `warehouse_id` FK `warehouses.id`
- `quantity_on_hand`
- `quantity_reserved`
- `quantity_available`
- `updated_at`

Recommended unique constraint:

- `(product_id, variant_id, warehouse_id)`

#### `inventory_movements`

- `id` UUID PK
- `product_id` FK `products.id`
- `variant_id` FK nullable
- `warehouse_id` FK
- `movement_type`
- `quantity`
- `unit_cost` nullable
- `reference_type`
- `reference_id` nullable
- `notes` nullable
- `created_by` FK `users.id` nullable
- `created_at`

Recommended `movement_type` enum values:

- `opening`
- `purchase`
- `sale`
- `sale_cancel`
- `return_in`
- `return_out`
- `adjustment_in`
- `adjustment_out`
- `transfer_in`
- `transfer_out`

### Customers

#### `customers`

- `id` UUID PK
- `name`
- `phone`
- `email` nullable
- `address_line` nullable
- `district` nullable
- `area` nullable
- `notes` nullable
- `customer_segment` nullable
- `is_active`
- `created_at`
- `updated_at`

Recommended unique index:

- phone if the business expects one customer record per phone number

### Orders

#### `orders`

- `id` UUID PK
- `order_number` bigserial or generated business number
- `customer_id` FK nullable
- `customer_name`
- `customer_phone`
- `customer_address`
- `district` nullable
- `area` nullable
- `landmark` nullable
- `status`
- `payment_method`
- `payment_status`
- `source`
- `subtotal`
- `delivery_charge`
- `discount`
- `total_amount`
- `paid_amount`
- `due_amount`
- `advance_amount` nullable
- `courier_name` nullable
- `tracking_number` nullable
- `courier_status` nullable
- `notes` nullable
- `fraud_score` nullable
- `fraud_reason` nullable
- `created_by` FK `users.id` nullable
- `created_at`
- `updated_at`

#### `order_items`

- `id` UUID PK
- `order_id` FK `orders.id`
- `product_id` FK nullable
- `variant_id` FK nullable
- `sku`
- `product_name`
- `quantity`
- `unit_price`
- `line_total`
- `created_at`

#### `order_events`

- `id` UUID PK
- `order_id` FK `orders.id`
- `event_type`
- `message`
- `metadata` JSONB nullable
- `created_by` FK `users.id` nullable
- `created_at`

This replaces embedded order logs and gives cleaner auditability.

## Legacy Collections to Defer or Merge Later

| Legacy collection | Recommendation |
| --- | --- |
| `purchaseOrders` | later phase |
| `suppliers` | later phase |
| `supplierPayments` | later phase |
| `accounts` | later phase |
| `transactions` | later phase |
| `deliveries` | later phase |
| `couriers` | later phase |
| `courier_configs` | later phase |
| `courier_logs` | later phase |
| `tasks` | later phase |
| `employees` and HR tables | later phase |
| `notifications` | later phase |
| `woocommerce_logs` | later integration phase |

## Data Cleanup Decisions for v2

### Normalize duplicate stock concepts

Legacy stock history is spread across:

- `inventory`
- `inventoryLogs`
- `stockLedger`
- `stock_logs`
- `purchaseBatches`

For MVP, v2 should use:

- `inventory_balances` for current stock
- `inventory_movements` for history

If cost-layer accounting is needed, add `inventory_batches` in phase 2.

### Keep order snapshots even with customer relation

Orders should retain copied customer fields like:

- `customer_name`
- `customer_phone`
- `customer_address`

This preserves historical accuracy even if the customer record changes later.

### Move permissions out of ad hoc JSON when possible

Legacy `users.permissions` is a boolean object. In PostgreSQL, either:

- use role-based permissions only for MVP, or
- use a dedicated `user_module_permissions` table

Avoid storing the entire permission map as opaque JSON unless speed is more important than queryability.

## Suggested MVP ERD Summary

Core relationships:

- one `user` creates many `orders`
- one `customer` has many `orders`
- one `order` has many `order_items`
- one `category` has many `products`
- one `brand` has many `products`
- one `product` has many `product_variants`
- one `warehouse` has many `inventory_balances`
- one `product` or `variant` can exist in many warehouse balances
- one `inventory_balance` is derived from many `inventory_movements`

## Migration Notes

- Firebase Auth users will need a migration or a manual re-onboarding plan
- Firestore IDs can be kept in temporary `legacy_id` columns during migration
- data import should be done module by module, not all at once
- inventory should be reconciled before go-live because legacy stock records are spread across multiple collections
