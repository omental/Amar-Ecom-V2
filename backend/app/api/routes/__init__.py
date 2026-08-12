from fastapi import APIRouter, Depends
from app.api.deps import get_public_store_context, get_tenant_context, require_permission

from app.api.routes import (
    accounts,
    admin,
    activity_logs,
    auth,
    brands,
    billing,
    categories,
    couriers,
    dns,
    courier_integrations,
    commercial,
    customers,
    finance,
    hr,
    invoice_templates,
    inbox, ai_commerce,
    inventory,
    logistics,
    media,
    meta_messaging,
    notifications,
    onboarding,
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
    storefront_custom_data,
    store_domains,
    storefront_themes,
    suppliers,
    supplier_payments,
    tasks,
    tenancy,
    transactions,
    users,
    warehouses,
    wastage_logs,
    woocommerce,
)


api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
api_router.include_router(tenancy.router, prefix="/tenant", tags=["tenant"])
api_router.include_router(commercial.router, prefix="/commercial", tags=["commercial"])
api_router.include_router(commercial.platform_router, prefix="/platform/commercial", tags=["platform-commercial"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(billing.platform_router, prefix="/platform/billing", tags=["platform-billing"])
api_router.include_router(inbox.router, prefix="/admin/inbox", tags=["inbox"])
api_router.include_router(ai_commerce.router, prefix="/admin/inbox/ai", tags=["inbox-ai"])
api_router.include_router(ai_commerce.platform_router, prefix="/platform/inbox/ai", tags=["platform-inbox-ai"])
api_router.include_router(inbox.platform_router, prefix="/platform/inbox", tags=["platform-inbox"])
api_router.include_router(meta_messaging.router, prefix="/admin/inbox", tags=["meta-messaging"])
api_router.include_router(meta_messaging.webhook_router, prefix="/webhooks/meta", tags=["meta-webhooks"])
api_router.include_router(meta_messaging.platform_router, prefix="/platform/inbox/meta", tags=["platform-meta-messaging"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["accounts"], dependencies=[Depends(require_permission("finance"))])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"], dependencies=[Depends(require_permission("settings"))])
api_router.include_router(activity_logs.router, prefix="/activity-logs", tags=["activity-logs"], dependencies=[Depends(require_permission("activity_logs"))])
api_router.include_router(users.router, prefix="/users", tags=["users"], dependencies=[Depends(require_permission("users"))])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"], dependencies=[Depends(require_permission("categories"))])
api_router.include_router(brands.router, prefix="/brands", tags=["brands"], dependencies=[Depends(require_permission("brands"))])
api_router.include_router(public.router, prefix="/public", tags=["public"], dependencies=[Depends(get_public_store_context)])
api_router.include_router(public_storefront.router, prefix="/public/storefront", tags=["public-storefront"], dependencies=[Depends(get_public_store_context)])
api_router.include_router(storefront_admin.router, prefix="/admin/storefront", tags=["storefront-admin"], dependencies=[Depends(require_permission("online_store"))])
api_router.include_router(storefront_themes.router, prefix="/admin/storefront", tags=["storefront-themes"], dependencies=[Depends(require_permission("online_store"))])
api_router.include_router(storefront_custom_data.router, prefix="/admin/storefront", tags=["storefront-custom-data"], dependencies=[Depends(require_permission("online_store"))])
api_router.include_router(store_domains.router, prefix="/admin/storefront", tags=["store-domains"], dependencies=[Depends(require_permission("online_store"))])
api_router.include_router(store_domains.platform_router, prefix="/platform", tags=["platform-domains"])
api_router.include_router(dns.router, prefix="/admin/storefront", tags=["amar-dns"], dependencies=[Depends(require_permission("online_store"))])
api_router.include_router(dns.platform_router, prefix="/platform", tags=["platform-dns"])
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
api_router.include_router(media.router, prefix="/media", tags=["media"], dependencies=[Depends(get_tenant_context)])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"], dependencies=[Depends(get_tenant_context)])
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
