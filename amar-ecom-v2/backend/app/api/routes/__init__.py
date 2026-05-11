from fastapi import APIRouter

from app.api.routes import (
    auth,
    brands,
    categories,
    couriers,
    customers,
    inventory,
    orders,
    products,
    purchase_orders,
    returns,
    settings,
    shipments,
    stock_movements,
    suppliers,
    users,
    warehouses,
)


api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(brands.router, prefix="/brands", tags=["brands"])
api_router.include_router(couriers.router, prefix="/couriers", tags=["couriers"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(purchase_orders.router, prefix="/purchase-orders", tags=["purchase-orders"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(returns.router, prefix="/returns", tags=["returns"])
api_router.include_router(shipments.router, prefix="/shipments", tags=["shipments"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(stock_movements.router, prefix="/stock-movements", tags=["stock-movements"])
api_router.include_router(warehouses.router, prefix="/warehouses", tags=["warehouses"])

__all__ = ["api_router"]
