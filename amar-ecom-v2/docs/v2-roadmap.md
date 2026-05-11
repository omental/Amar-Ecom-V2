# Amar eCom v2 Roadmap

## Goal

Rebuild Amar eCom as a cleaner v2 while preserving the legacy app as a reference.

Target stack:

- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- Backend: FastAPI, PostgreSQL, async SQLAlchemy, Alembic, Pydantic v2
- Auth: HTTP-only cookie auth recommended

## Current Starting Point

### Already present

- `backend/app/main.py`
- async SQLAlchemy database setup
- settings loader with `DATABASE_URL`
- PostgreSQL database `amar_ecom`
- health endpoint: `GET /api/v1/health`
- Next.js frontend scaffold in `frontend/`

### Not implemented yet

- auth flows
- business models
- Alembic migrations
- API routers for business modules
- frontend module pages

## MVP Scope

The first usable v2 should cover:

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

Not in MVP:

- POS
- suppliers
- purchase orders
- logistics / couriers
- returns
- finance
- tasks
- HR
- reports beyond a simple dashboard summary
- WooCommerce and SMS integrations

## Recommended Architecture

### Backend modules

- `app/api/routes/auth.py`
- `app/api/routes/users.py`
- `app/api/routes/dashboard.py`
- `app/api/routes/products.py`
- `app/api/routes/categories.py`
- `app/api/routes/brands.py`
- `app/api/routes/customers.py`
- `app/api/routes/orders.py`
- `app/api/routes/inventory.py`
- `app/api/routes/warehouses.py`

### Backend layers

- `app/models/`
- `app/schemas/`
- `app/services/`
- `app/repositories/` if needed
- `app/core/`

### Frontend modules

- `app/(auth)/login/page.tsx`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/page.tsx`
- `app/(dashboard)/users/page.tsx`
- `app/(dashboard)/products/page.tsx`
- `app/(dashboard)/products/new/page.tsx`
- `app/(dashboard)/products/[id]/edit/page.tsx`
- `app/(dashboard)/categories/page.tsx`
- `app/(dashboard)/brands/page.tsx`
- `app/(dashboard)/customers/page.tsx`
- `app/(dashboard)/orders/page.tsx`
- `app/(dashboard)/orders/new/page.tsx`
- `app/(dashboard)/orders/[id]/page.tsx`
- `app/(dashboard)/inventory/page.tsx`
- `app/(dashboard)/warehouses/page.tsx`

## API Endpoint Plan

All endpoints assume `/api/v1`.

### Auth

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/refresh` if refresh flow is used

### Users

- `GET /users`
- `POST /users`
- `GET /users/{user_id}`
- `PATCH /users/{user_id}`
- `PATCH /users/{user_id}/status`
- `GET /users/{user_id}/permissions`
- `PUT /users/{user_id}/permissions`

### Dashboard

- `GET /dashboard/summary`
- `GET /dashboard/sales-overview`
- `GET /dashboard/inventory-overview`

For MVP, this can be merged into one summary endpoint first.

### Categories

- `GET /categories`
- `POST /categories`
- `GET /categories/{category_id}`
- `PATCH /categories/{category_id}`
- `DELETE /categories/{category_id}`

### Brands

- `GET /brands`
- `POST /brands`
- `GET /brands/{brand_id}`
- `PATCH /brands/{brand_id}`
- `DELETE /brands/{brand_id}`

### Warehouses

- `GET /warehouses`
- `POST /warehouses`
- `GET /warehouses/{warehouse_id}`
- `PATCH /warehouses/{warehouse_id}`
- `DELETE /warehouses/{warehouse_id}`

### Products

- `GET /products`
- `POST /products`
- `GET /products/{product_id}`
- `PATCH /products/{product_id}`
- `DELETE /products/{product_id}`
- `GET /products/{product_id}/variants`
- `POST /products/{product_id}/variants`
- `PATCH /products/{product_id}/variants/{variant_id}`
- `DELETE /products/{product_id}/variants/{variant_id}`

### Customers

- `GET /customers`
- `POST /customers`
- `GET /customers/{customer_id}`
- `PATCH /customers/{customer_id}`
- `DELETE /customers/{customer_id}`
- `GET /customers/{customer_id}/orders`

### Orders

- `GET /orders`
- `POST /orders`
- `GET /orders/{order_id}`
- `PATCH /orders/{order_id}`
- `PATCH /orders/{order_id}/status`
- `GET /orders/{order_id}/items`

### Inventory

- `GET /inventory`
- `GET /inventory/movements`
- `POST /inventory/adjustments`
- `POST /inventory/opening-balances`
- `GET /inventory/product/{product_id}`
- `GET /inventory/warehouse/{warehouse_id}`

## Next.js Page and Module Plan

### Auth

- login page
- auth session hydration
- protected dashboard layout

### Admin shell

- left navigation
- header
- user menu
- permission guard

### Dashboard

- KPI cards
- recent orders
- low stock widget
- top products or order trend chart

### Users

- user list
- create user form
- edit user modal or page
- activate/deactivate action
- permission assignment UI

### Products

- product list
- create/edit product
- variant support
- category and brand selection

### Categories and brands

- simple CRUD screens
- searchable list

### Customers

- customer list
- create/edit customer
- customer detail with order history later if needed

### Orders

- order list
- order create form
- order detail page
- status update flow
- itemized order lines

### Inventory

- stock balance list
- stock per warehouse
- stock adjustment form
- movement history table

### Warehouses

- warehouse CRUD

## Migration Phases

### Phase 0: Foundation

- confirm final auth strategy
- create backend folder structure for models, schemas, services
- configure Alembic
- create base migrations
- define shared enums and timestamp mixins
- create frontend dashboard shell and API client setup

### Phase 1: Auth and users

- implement login/logout/me
- implement user model and password hashing
- implement protected frontend routes
- implement user list and user admin screens

### Phase 2: Catalog foundation

- categories
- brands
- warehouses
- products
- product variants

This phase unblocks inventory and order creation.

### Phase 3: Inventory core

- inventory balances
- opening balances
- stock adjustments
- movement logging
- low stock summary

### Phase 4: Customers and orders

- customers CRUD
- orders CRUD
- order items
- order status workflow
- stock deduction on order creation or confirmation

### Phase 5: Dashboard MVP

- summary metrics
- latest orders
- low stock widgets
- counts for users, customers, products, and orders

### Phase 6: Data migration and reconciliation

- export legacy Firestore data module by module
- import categories, brands, warehouses, products first
- import customers
- import orders and order items
- reconcile inventory
- validate key counts against legacy app

### Phase 7: Post-MVP modules

- logistics
- returns
- POS
- suppliers and purchasing
- finance
- reports
- HR
- WooCommerce
- SMS

## Suggested Build Order

Recommended implementation order for fastest usable MVP:

1. Auth
2. Users
3. Categories, Brands, Warehouses
4. Products and variants
5. Inventory balances and movements
6. Customers
7. Orders and order items
8. Dashboard

This order reduces rework because orders depend on customers, products, and inventory.

## Risks to Watch Early

- legacy permissions are module-based and may be more granular than a simple admin/staff split
- legacy inventory is spread across multiple collections and log styles
- legacy order flow mixes CRM, finance, logistics, and stock updates in one module
- Firebase Auth users do not automatically become v2 users without migration or reset

## Definition of MVP Done

MVP is complete when the v2 app can:

- authenticate admin and staff users
- manage users and permissions
- manage categories, brands, warehouses, and products
- manage customer records
- create and manage orders with order items
- maintain stock balances per warehouse
- show a basic operational dashboard

At that point, the legacy app can remain the fallback reference while later modules are rebuilt incrementally.
