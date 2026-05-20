from fastapi import APIRouter

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
api_router.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(activity_logs.router, prefix="/activity-logs", tags=["activity-logs"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(brands.router, prefix="/brands", tags=["brands"])
api_router.include_router(couriers.router, prefix="/couriers", tags=["couriers"])
api_router.include_router(courier_integrations.router, prefix="/courier-integrations", tags=["courier-integrations"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(designations.router, prefix="/designations", tags=["designations"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(purchase_orders.router, prefix="/purchase-orders", tags=["purchase-orders"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])
api_router.include_router(hr.router, prefix="/hr", tags=["hr"])
api_router.include_router(invoice_templates.router, prefix="/invoice-templates", tags=["invoice-templates"])
api_router.include_router(logistics.router, prefix="/logistics", tags=["logistics"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(permissions.router, tags=["permissions"])
api_router.include_router(pos.router, prefix="/pos", tags=["pos"])
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(petty_cash.router, prefix="/petty-cash", tags=["petty-cash"])
api_router.include_router(returns.router, prefix="/returns", tags=["returns"])
api_router.include_router(salary_advances.router, prefix="/salary-advances", tags=["salary-advances"])
api_router.include_router(salary_records.router, prefix="/salary-records", tags=["salary-records"])
api_router.include_router(shipments.router, prefix="/shipments", tags=["shipments"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(stock_transfers.router, prefix="/stock-transfers", tags=["stock-transfers"])
api_router.include_router(wastage_logs.router, prefix="/wastage-logs", tags=["wastage-logs"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(stock_movements.router, prefix="/stock-movements", tags=["stock-movements"])
api_router.include_router(supplier_payments.router, prefix="/supplier-payments", tags=["supplier-payments"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(warehouses.router, prefix="/warehouses", tags=["warehouses"])
api_router.include_router(woocommerce.router, prefix="/woocommerce", tags=["woocommerce"])

__all__ = ["api_router"]
