from fastapi import APIRouter, Depends
from app.api.deps import require_permission

from app.api.routes import (
    accounts,
    admin,
    activity_logs,
    auth,
    brands,
    categories,
    couriers,
    courier_integrations,
    customers,
    finance,
    hr,
    invoice_templates,
    inventory,
    logistics,
    notifications,
    orders,
    petty_cash,
    permissions,
    pos,
    public,
    public_storefront,
    designations,
    products,
    purchase_orders,
    reports,
    returns,
    employees,
    settings,
    shipments,
    attendance,
    salary_advances,
    salary_records,
    stock_transfers,
    stock_movements,
    storefront_admin,
    suppliers,
    supplier_payments,
    tasks,
    transactions,
    users,
    warehouses,
    wastage_logs,
    woocommerce,
)


api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["accounts"], dependencies=[Depends(require_permission("finance"))])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"], dependencies=[Depends(require_permission("settings"))])
api_router.include_router(activity_logs.router, prefix="/activity-logs", tags=["activity-logs"], dependencies=[Depends(require_permission("activity_logs"))])
api_router.include_router(users.router, prefix="/users", tags=["users"], dependencies=[Depends(require_permission("users"))])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"], dependencies=[Depends(require_permission("categories"))])
api_router.include_router(brands.router, prefix="/brands", tags=["brands"], dependencies=[Depends(require_permission("brands"))])
api_router.include_router(public.router, prefix="/public", tags=["public"])
api_router.include_router(public_storefront.router, prefix="/public/storefront", tags=["public-storefront"])
api_router.include_router(storefront_admin.router, prefix="/admin/storefront", tags=["storefront-admin"], dependencies=[Depends(require_permission("online_store"))])
api_router.include_router(couriers.router, prefix="/couriers", tags=["couriers"], dependencies=[Depends(require_permission("couriers"))])
api_router.include_router(courier_integrations.router, prefix="/courier-integrations", tags=["courier-integrations"], dependencies=[Depends(require_permission("courier_integrations"))])
api_router.include_router(products.router, prefix="/products", tags=["products"], dependencies=[Depends(require_permission("products"))])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"], dependencies=[Depends(require_permission("reports"))])
api_router.include_router(designations.router, prefix="/designations", tags=["designations"], dependencies=[Depends(require_permission("hr"))])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"], dependencies=[Depends(require_permission("suppliers"))])
api_router.include_router(purchase_orders.router, prefix="/purchase-orders", tags=["purchase-orders"], dependencies=[Depends(require_permission("purchase_orders"))])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"], dependencies=[Depends(require_permission("customers"))])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"], dependencies=[Depends(require_permission("finance"))])
api_router.include_router(hr.router, prefix="/hr", tags=["hr"], dependencies=[Depends(require_permission("hr"))])
api_router.include_router(invoice_templates.router, prefix="/invoice-templates", tags=["invoice-templates"], dependencies=[Depends(require_permission("settings"))])
api_router.include_router(logistics.router, prefix="/logistics", tags=["logistics"], dependencies=[Depends(require_permission("logistics"))])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(permissions.router, tags=["permissions"], dependencies=[Depends(require_permission("permissions"))])
api_router.include_router(pos.router, prefix="/pos", tags=["pos"], dependencies=[Depends(require_permission("pos"))])
api_router.include_router(employees.router, prefix="/employees", tags=["employees"], dependencies=[Depends(require_permission("hr"))])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"], dependencies=[Depends(require_permission("orders"))])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"], dependencies=[Depends(require_permission("hr"))])
api_router.include_router(petty_cash.router, prefix="/petty-cash", tags=["petty-cash"], dependencies=[Depends(require_permission("finance"))])
api_router.include_router(returns.router, prefix="/returns", tags=["returns"], dependencies=[Depends(require_permission("returns"))])
api_router.include_router(salary_advances.router, prefix="/salary-advances", tags=["salary-advances"], dependencies=[Depends(require_permission("hr"))])
api_router.include_router(salary_records.router, prefix="/salary-records", tags=["salary-records"], dependencies=[Depends(require_permission("hr"))])
api_router.include_router(shipments.router, prefix="/shipments", tags=["shipments"], dependencies=[Depends(require_permission("shipments"))])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"], dependencies=[Depends(require_permission("inventory"))])
api_router.include_router(stock_transfers.router, prefix="/stock-transfers", tags=["stock-transfers"], dependencies=[Depends(require_permission("inventory"))])
api_router.include_router(wastage_logs.router, prefix="/wastage-logs", tags=["wastage-logs"], dependencies=[Depends(require_permission("inventory"))])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"], dependencies=[Depends(require_permission("settings"))])
api_router.include_router(stock_movements.router, prefix="/stock-movements", tags=["stock-movements"], dependencies=[Depends(require_permission("stock_movements"))])
api_router.include_router(supplier_payments.router, prefix="/supplier-payments", tags=["supplier-payments"], dependencies=[Depends(require_permission("finance"))])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"], dependencies=[Depends(require_permission("tasks"))])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"], dependencies=[Depends(require_permission("finance"))])
api_router.include_router(warehouses.router, prefix="/warehouses", tags=["warehouses"], dependencies=[Depends(require_permission("warehouses"))])
api_router.include_router(woocommerce.router, prefix="/woocommerce", tags=["woocommerce"], dependencies=[Depends(require_permission("woocommerce"))])

__all__ = ["api_router"]
