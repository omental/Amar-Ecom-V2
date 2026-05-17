# UI Release Candidate Checklist

Last reviewed: 2026-05-16

Purpose:
- final manual browser QA checklist for the v2 dashboard UI after Phase `14D` through `14J`
- confirm the v1-inspired redesign and responsive containment fixes hold up across the main operator routes

## Viewports

Check each route at:
- `1440px` desktop
- `1280px` desktop
- `1024px` laptop / tablet-ish
- `768px` tablet-ish if practical

## Common Checks

For every route below, confirm:
- no full-page horizontal overflow
- sidebar remains usable
- topbar remains usable
- summary cards fit or wrap safely
- filters wrap or scroll locally only
- tables scroll internally only when needed
- action bars wrap safely
- empty, loading, and error states look consistent
- important actions remain visible

## Route Checklist

### `/dashboard`
- no right-side cards clipped
- quick links wrap safely
- ops cards remain readable at `1024px`

### `/dashboard/orders`
- filter groups wrap cleanly
- batch action bar wraps safely
- dense order table does not force page-level overflow

### `/dashboard/orders/[id]`
- badge clusters wrap safely
- summary cards stack cleanly
- shipment and Woo panels remain visible

### `/dashboard/logistics`
- tabs stay contained
- summary cards wrap cleanly
- reconciliation tables scroll locally only

### `/dashboard/shipments`
- quick filters wrap
- batch action bar wraps
- shipment table scrolls locally only

### `/dashboard/shipments/[id]`
- header and status clusters remain visible
- courier, reconciliation, and linked-order cards do not clip

### `/dashboard/inventory`
- tabbed hub stays inside page width
- stock overview and ledger tables scroll locally only
- filter groups wrap safely

### `/dashboard/products`
- KPI strip wraps safely
- product rows do not force page overflow

### `/dashboard/products/[id]`
- metadata cards stack cleanly
- inventory summary and variants areas remain visible

### `/dashboard/customers`
- KPI strip wraps safely
- CRM filters wrap cleanly
- customer rows remain readable

### `/dashboard/customers/[id]`
- profile header and badges wrap safely
- activity and recent-order sections remain visible

### `/dashboard/reports`
- report group tabs stay contained
- KPI and management widgets wrap cleanly
- dense report tables scroll locally only

### `/dashboard/finance`
- tab shell stays contained
- summary cards wrap cleanly
- filters and warning panels do not clip

### `/dashboard/hr`
- tab shell stays contained
- summary cards wrap cleanly
- employee and salary sections remain readable

### `/dashboard/pos`
- KPI strip wraps safely
- warehouse/search/product/cart layout stacks instead of clipping
- checkout panel remains usable

### `/dashboard/settings`
- settings nav and main panel fit together cleanly
- preview/admin link cards do not clip

### `/dashboard/admin-tools`
- admin nav and content panel fit together cleanly
- health cards wrap safely
- export actions remain visible

### `/dashboard/woocommerce`
- safety warnings remain visible
- tabs stay contained
- preview/import/log sections do not cause shell overflow

### `/dashboard/courier-integrations`
- safety warnings remain visible
- tabs stay contained
- shipment/log tables scroll locally only

## Known Acceptable Behavior

- dense tables may use local horizontal scroll
- some routes are still intentionally lighter than exact v1:
  - invoice print
  - activity logs
  - tasks
  - users
  - returns
  - purchase orders

These are not release blockers unless they become visually broken or unusable.
