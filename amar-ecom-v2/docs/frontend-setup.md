# Frontend Setup

## Project Location

- Frontend path: `D:\Amar-eCom\amar-ecom-v2\frontend`
- Backend API base URL default: `http://127.0.0.1:8000/api/v1`

## Install Dependencies

From `D:\Amar-eCom\amar-ecom-v2\frontend`:

```powershell
npm install
```

## Environment Setup

Create or verify:

- `frontend/.env.local`

Required value:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

The example file is also included at:

- `frontend/.env.example`

## Backend Requirement

The FastAPI backend must be running before login or protected dashboard pages can work.

From `D:\Amar-eCom\amar-ecom-v2\backend`:

```powershell
venv\Scripts\uvicorn.exe app.main:app --reload
```

## Run Frontend

From `D:\Amar-eCom\amar-ecom-v2\frontend`:

```powershell
npm run dev
```

Open:

- `http://localhost:3000`

## Login Testing Steps

1. Start the backend.
2. Start the frontend.
3. Open `http://localhost:3000`.
4. You should be redirected to `/login`.
5. Sign in with a backend user created from the FastAPI auth flow.
6. After login, you should be redirected to `/dashboard`.

## Module Testing Flow

### Create Category

1. Open `http://localhost:3000/dashboard/categories`
2. Fill in `name`, `slug`, and optional `description`
3. Submit the form
4. Confirm the new category appears in the list

### Create Brand

1. Open `http://localhost:3000/dashboard/brands`
2. Fill in `name`, `slug`, and optional `description`
3. Submit the form
4. Confirm the new brand appears in the list

### Create Warehouse

1. Open `http://localhost:3000/dashboard/warehouses`
2. Fill in `name`, `code`, optional `address`, and choose active status
3. Submit the form
4. Confirm the new warehouse appears in the list

### Create Customer

1. Open `http://localhost:3000/dashboard/customers`
2. Fill in `name` and `phone`
3. Add optional `email`, `address`, `city`, and `notes`
4. Submit the form
5. Confirm the new customer appears in the list

### Create Product

1. Make sure at least one category and one brand already exist
2. Open `http://localhost:3000/dashboard/products`
3. Fill in `name`, `slug`, `sku`, `price`, `cost price`, and optional `description` and `image URL`
4. Select a category and brand from the dropdowns
5. Submit the form
6. Confirm the new product appears in the list with SKU, price, category, and brand

## Protected Route Notes

- Categories, Brands, Products, Customers, and Warehouses use the JWT token stored in `localStorage`
- If the token is missing, dashboard access redirects to `/login`
- Logout clears local auth state and redirects back to `/login`

## Notes

- The frontend currently stores JWT and user data in `localStorage`
- The product form expects the backend category and brand endpoints to return simple `id` and `name` fields for dropdown use
- Orders, Inventory, Users, and Settings remain placeholder pages for the next phase
