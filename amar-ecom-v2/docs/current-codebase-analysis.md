# Amar eCom Current Codebase Analysis

## Scope

This document analyzes the legacy Amar eCom application in `D:\Amar-eCom` and the current v2 scaffold in `D:\Amar-eCom\amar-ecom-v2`.

The legacy app is treated as a feature reference only. It should not be rewritten in place.

## Current Repositories

### Legacy app

- Location: `D:\Amar-eCom`
- Purpose: production-like business dashboard / admin app
- Frontend: React + Vite + TypeScript
- Data/auth: Firebase Auth + Firestore + Firebase Storage
- Server utilities: `server.ts` Express server for admin helpers and third-party integrations

### v2 app

- Location: `D:\Amar-eCom\amar-ecom-v2`
- Frontend target: Next.js App Router + TypeScript + Tailwind CSS
- Backend target: FastAPI + PostgreSQL + async SQLAlchemy + Alembic + Pydantic v2
- Current backend status:
  - `GET /api/v1/health` is implemented and working
  - route files exist for `auth`, `users`, `products`, `orders`, `inventory`, `customers`, but they are still empty
- Current frontend status:
  - basic `create-next-app` scaffold only
  - no business modules implemented yet

## Existing Technology Stack

### Legacy frontend stack

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- React Hook Form
- Zod
- Firebase client SDK
- Recharts
- Sonner
- Lucide React
- `@hello-pangea/dnd`
- `html2canvas`, `jspdf`, `react-to-print`, `qrcode.react`, `react-barcode`

### Legacy backend/integration layer

- Express in `server.ts`
- Firebase Admin SDK
- Axios-based third-party API calls
- Utility endpoints for:
  - health checks
  - Firebase admin user deletion
  - WooCommerce sync
  - courier configuration and dispatch
  - courier tracking / fraud / zone lookup
  - SMS sending

### v2 backend stack already installed

- FastAPI
- SQLAlchemy 2.x
- asyncpg
- Alembic
- Pydantic v2
- `python-jose`
- `passlib`
- `bcrypt`

## Legacy App Structure

### Main app shell

- `src/App.tsx`
  - route definitions
  - auth gate
  - permission gate
- `src/components/Layout.tsx`
  - sidebar
  - header
  - notifications
  - quick actions

### Contexts

- `src/contexts/AuthContext.tsx`
  - Firebase Auth session handling
  - user profile loading from Firestore `users`
  - permission resolution
  - active/inactive approval flow
- `src/contexts/SettingsContext.tsx`
  - company settings subscription from `settings/company`
- `src/contexts/ThemeContext.tsx`
  - theme state

### Shared services

- `src/services/orderService.ts`
- `src/services/notificationService.ts`
- `src/services/activityService.ts`
- `src/services/valuationService.ts`
- `src/services/performanceService.ts`
- `src/services/woocommerceService.ts`
- `src/services/steadfastService.ts`
- `src/services/smsService.ts`

## Existing Modules, Pages, and Components

The legacy app is route-driven and permission-gated. Confirmed routes:

| Route | Component | Purpose | MVP |
| --- | --- | --- | --- |
| `/` | `Dashboard` | KPIs, quick overview of users, orders, customers, products, inventory | Yes |
| `/pos` | `POS` | point of sale order creation and payment capture | No |
| `/orders` | `Orders` | order list and order operations | Yes |
| `/orders/new` | `NewOrder` | manual order creation | Yes |
| `/returns` | `Returns` | RMA / returns workflow | Later |
| `/inventory` | `Inventory` | product and stock management hub | Yes |
| `/inventory/new` | `NewProduct` | add product | Yes |
| `/inventory/edit/:id` | `NewProduct` | edit product | Yes |
| `/crm` | `CRM` | customer management | Yes |
| `/inbox` | `Inbox` | CRM-related messages / communication UI | Later |
| `/suppliers` | `Suppliers` | supplier ledger and purchase workflows | Later |
| `/logistics` | `Logistics` | couriers, delivery dispatch, tracking | Later |
| `/tasks` | `Tasks` | internal team tasks | Later |
| `/finance` | `Finance` | accounts, transactions, supplier payments | Later |
| `/hr` | `HR` | employees, attendance, salary | Later |
| `/team` | `Team` | team users, roles, permissions | Yes as Users/Admin |
| `/reports` | `Reports` | analytics and reporting | Later |
| `/settings` | `Settings` | company settings, user settings, maintenance | Later |

Additional components present but not first-class routes:

- `OrderDetailsModal`
- `CourierReconciliation`
- `StockTransfers`
- `WooCommerceOrders`
- `InvoiceTemplates`
- `PettyCash`
- `ConfirmModal`

## Legacy Business Features

### Confirmed MVP-relevant features

#### Auth

- Firebase Auth session handling
- email/password auth
- Google sign-in support exists in Firebase setup
- approval workflow: newly created users default to `active: false`
- module-level permissions stored in Firestore user documents
- admin override for a specific email in code

#### Users / Team

- user list from Firestore `users`
- create user using Firebase secondary auth instance
- activate/deactivate user
- assign role and module permissions
- delete user with server-side Firebase Admin helper
- audit activity logging

#### Dashboard

- real-time counts from `users`, `orders`, `customers`, `products`, `inventory`
- summary widgets and charts

#### Products / Inventory

- products with SKU, price, cost, reorder point, bundle support
- variants
- categories
- brands
- warehouses
- purchase batches
- stock ledger
- inventory logs
- wastage logs
- stock transfer support

#### Customers

- customer profile management
- order history linkage
- segmentation fields and notes

#### Orders

- manual order creation
- order status workflow
- payment tracking
- courier assignment
- partial delivery handling
- order logs / audit trail
- inventory deduction on sale
- delivery record creation

### Non-MVP but important legacy features

- POS
- suppliers and purchase orders
- finance and accounts
- logistics and courier API integration
- returns / RMA
- HR
- tasks
- notifications / inbox
- WooCommerce integration
- SMS integration

## Firebase Collections Used

The following collections are confirmed from source code and Firestore rules.

### Core collections

- `users`
- `orders`
- `customers`
- `products`
- `variants`
- `inventory`
- `categories`
- `brands`
- `warehouses`
- `settings`

### Inventory and stock support

- `inventoryLogs`
- `stockLedger`
- `purchaseBatches`
- `stock_transfers`
- `wastage_logs`
- `stock_logs`
- `attributes`

### Order and logistics support

- `deliveries`
- `couriers`
- `courier_configs`
- `courier_logs`
- `rma_requests`
- `shipments`

### Finance and supplier support

- `accounts`
- `transactions`
- `suppliers`
- `purchaseOrders`
- `supplierPayments`
- `petty_cash`

### Team / internal operations

- `activityLogs`
- `notifications`
- `tasks`
- `performanceMetrics`
- `kpiConfigs`

### HR collections

- `employees`
- `designations`
- `attendance`
- `salaryAdvances`
- `salaryRecords`

### Integration / utility collections

- `woocommerce_logs`
- `health_check`
- `hrm`

## Important Legacy Data Observations

### Auth and permissions are split across two systems

- authentication identity lives in Firebase Auth
- authorization and profile data live in Firestore `users`
- permissions are stored as a boolean object per module

### Settings are document-oriented

- company settings are stored in `settings/company`
- user-specific settings are stored as documents like `settings/user_<uid>`

### Orders are denormalized

- order header and order items are stored in one Firestore document
- logs and status history are embedded on the order
- customer snapshot fields are duplicated onto the order

### Inventory modeling is partially split

- product master data lives in `products`
- variants live in `variants`
- stock balances live in `inventory`
- movement history lives in both `inventoryLogs` and `stockLedger`
- purchasing cost layers live in `purchaseBatches`

### Legacy naming is not fully consistent

Potential cleanup areas for v2:

- `inventoryLogs` vs `stock_logs`
- `returnRequests` appears in inventory code while `rma_requests` is the formal returns collection
- `shipments`, `deliveries`, and courier status concepts overlap

These inconsistencies should be normalized in PostgreSQL.

## Firestore Access / Security Model

The legacy Firestore rules show the intended access model:

- admin override exists for a hardcoded email
- most access requires verified Firebase users
- per-module permission checks are based on `users.permissions`
- `users.active` acts as approval gating
- inventory can be modified by inventory, orders, logistics, or admin flows
- settings are partly public-readable, partly admin-controlled

This confirms that the business domain is multi-user, role-based, and operational rather than storefront-only.

## Legacy Server Endpoints in `server.ts`

Confirmed Express endpoints:

- `GET /api/test`
- `DELETE /api/users/:uid`
- `GET /api/health`
- `GET /api/woocommerce/orders`
- `GET /api/woocommerce/products`
- `PUT /api/woocommerce/orders/:id`
- `POST /api/webhooks/woocommerce/order-updated`
- `GET /api/couriers/configs`
- `POST /api/couriers/configs/:courier`
- `POST /api/couriers/order`
- `POST /api/couriers/send-order/:courier`
- `GET /api/couriers/balance/:courier`
- `GET /api/couriers/cities/:courier`
- `GET /api/couriers/zones/:courier/:cityId`
- `GET /api/couriers/areas/:courier/:zoneId`
- `GET /api/couriers/check-fraud/:phone`
- `GET /api/couriers/track/:courier/:trackingCode`
- `POST /api/sms/send`

For v2, these should be reintroduced only after the core ERP modules are stable.

## v2 Current Status

### Backend

- `backend/app/main.py` only registers:
  - CORS
  - `GET /api/v1/health`
- async SQLAlchemy engine and session dependency are present
- settings are loaded from `.env`
- route placeholder files exist but are empty

### Frontend

- `frontend/app/page.tsx` is still the default Next.js starter page
- App Router is present
- Tailwind v4 is present
- no auth, shell, or business pages are implemented yet

## Summary

The legacy app already contains a fairly broad internal commerce/operations platform, not just a simple product or order tracker.

For v2 MVP, the most important modules to carry forward first are:

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

These cover the operational core and also provide the foundation needed to reintroduce logistics, suppliers, finance, reports, and HR later.
