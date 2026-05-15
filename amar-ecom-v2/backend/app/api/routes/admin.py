import csv
import io
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import func, select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.core.config import settings
from app.models import (
    Account,
    BusinessSettings,
    Customer,
    Employee,
    InventoryItem,
    InvoiceTemplate,
    Order,
    Permission,
    Product,
    PurchaseOrder,
    Shipment,
    StockMovement,
    Supplier,
    Task,
    Transaction,
    User,
    Warehouse,
    WooCommerceSetting,
    WooCommerceSyncLog,
)
from app.schemas.admin import (
    BackupGuidanceRead,
    MaintenanceChecklistItemRead,
    MaintenanceChecklistRead,
    MigrationStatusRead,
    SystemHealthCountsRead,
    SystemHealthRead,
    SystemHealthServiceStatusRead,
)
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


def _ensure_admin(user: User) -> None:
    if user.role not in {"admin", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


def _csv_response(filename: str, headers: list[str], rows: list[list[object]]) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _count_rows(db: AsyncSession, model: type[object]) -> int:
    return int(await db.scalar(select(func.count()).select_from(model)) or 0)


def _stringify(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _parse_database_name(database_url: str) -> str | None:
    parsed = urlparse(database_url)
    return parsed.path.lstrip("/") or None


def _build_pg_dump_command(database_url: str) -> str:
    parsed = urlparse(database_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432
    username = parsed.username or "postgres"
    database_name = parsed.path.lstrip("/") or "amar_ecom"
    return (
        f'pg_dump -h {host} -p {port} -U {username} -F c -b -v '
        f'-f "{database_name}-backup.dump" {database_name}'
    )


async def _get_migration_status(db: AsyncSession) -> MigrationStatusRead:
    alembic_ini = Path(__file__).resolve().parents[3] / "alembic.ini"
    config = Config(str(alembic_ini))
    config.set_main_option("script_location", str(alembic_ini.parent / "alembic"))
    script_directory = ScriptDirectory.from_config(config)
    head_revision = script_directory.get_current_head()

    current_revision: str | None = None
    try:
        current_revision = await db.scalar(text("SELECT version_num FROM alembic_version LIMIT 1"))
    except Exception:
        current_revision = None

    return MigrationStatusRead(
        current_revision=current_revision,
        head_revision=head_revision,
        up_to_date=(current_revision == head_revision) if current_revision and head_revision else None,
    )


@router.get("/system-health", response_model=SystemHealthRead)
async def get_system_health(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> SystemHealthRead:
    _ensure_admin(current_user)

    await db.execute(select(1))
    counts = SystemHealthCountsRead(
        users=await _count_rows(db, User),
        products=await _count_rows(db, Product),
        orders=await _count_rows(db, Order),
        inventory_items=await _count_rows(db, InventoryItem),
        customers=await _count_rows(db, Customer),
        finance_accounts=await _count_rows(db, Account),
        tasks=await _count_rows(db, Task),
        employees=await _count_rows(db, Employee),
    )
    migrations = await _get_migration_status(db)

    await log_activity(
        db,
        user_id=current_user.id,
        action="system_health_viewed",
        module="admin",
        entity_type="system_health",
        entity_id=None,
        message="Viewed system health snapshot.",
        request=request,
    )
    await db.commit()

    return SystemHealthRead(
        service_status=SystemHealthServiceStatusRead(api="ok", database="ok"),
        environment=settings.APP_ENV,
        database_connectivity=True,
        migrations=migrations,
        counts=counts,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/backup-guidance", response_model=BackupGuidanceRead)
async def get_backup_guidance(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> BackupGuidanceRead:
    _ensure_admin(current_user)

    await log_activity(
        db,
        user_id=current_user.id,
        action="backup_guidance_viewed",
        module="admin",
        entity_type="backup_guidance",
        entity_id=None,
        message="Viewed backup and restore guidance.",
        request=request,
    )
    await db.commit()

    return BackupGuidanceRead(
        database_name=_parse_database_name(settings.DATABASE_URL),
        pg_dump_command_template=_build_pg_dump_command(settings.DATABASE_URL),
        folders_to_back_up=[
            "backend/app",
            "backend/alembic",
            "frontend",
            "docs",
            "backend/.env",
            ".env.local",
        ],
        restore_checklist=[
            "Create the target PostgreSQL database before restoring.",
            "Restore the latest schema and data dump with pg_restore or psql as appropriate.",
            "Recreate environment variables on the destination host.",
            "Run alembic upgrade head after restore to confirm schema alignment.",
            "Verify /api/v1/health and /api/v1/admin/system-health after deployment.",
        ],
        environment_warning="Keep database credentials in environment variables or a secrets manager, not inside scripts or committed docs.",
        env_commit_warning="Never commit .env, .env.local, backend/.env, or backup archives to version control.",
    )


@router.get("/maintenance-checklist", response_model=MaintenanceChecklistRead)
async def get_maintenance_checklist(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> MaintenanceChecklistRead:
    _ensure_admin(current_user)

    migrations = await _get_migration_status(db)
    active_admin_count = int(
        await db.scalar(
            select(func.count()).select_from(User).where(
                User.is_active.is_(True),
                User.role.in_(["admin", "super_admin"]),
            )
        )
        or 0
    )
    business_settings = await db.scalar(select(BusinessSettings).limit(1))
    warehouse_count = await _count_rows(db, Warehouse)
    finance_account_count = await _count_rows(db, Account)
    permission_count = await _count_rows(db, Permission)
    low_stock_count = int(
        await db.scalar(
            select(func.count()).select_from(InventoryItem).where(InventoryItem.quantity <= InventoryItem.low_stock_threshold)
        )
        or 0
    )
    pending_shipment_count = int(
        await db.scalar(
            select(func.count()).select_from(Shipment).where(Shipment.status.in_(["pending", "processing", "shipped"]))
        )
        or 0
    )
    unsettled_reconciliation_count = int(
        await db.scalar(
            select(func.count()).select_from(Shipment).where(Shipment.reconciliation_status != "settled")
        )
        or 0
    )
    pending_task_count = int(
        await db.scalar(
            select(func.count()).select_from(Task).where(Task.status.in_(["todo", "in_progress", "review"]))
        )
        or 0
    )
    default_template_count = int(
        await db.scalar(
            select(func.count()).select_from(InvoiceTemplate).where(
                InvoiceTemplate.is_active.is_(True),
                InvoiceTemplate.is_default.is_(True),
            )
        )
        or 0
    )
    try:
        woo_sync_log_count = await _count_rows(db, WooCommerceSyncLog)
    except ProgrammingError:
        woo_sync_log_count = 0
    try:
        woo_settings = await db.scalar(select(WooCommerceSetting).limit(1))
        recent_failed_woo_syncs = int(
            await db.scalar(
                select(func.count()).select_from(WooCommerceSyncLog).where(WooCommerceSyncLog.status == "failed")
            )
            or 0
        )
    except ProgrammingError:
        woo_settings = None
        recent_failed_woo_syncs = 0

    woo_active_settings = bool(
        woo_settings
        and woo_settings.is_active
        and woo_settings.store_url
        and woo_settings.consumer_key_encrypted
        and woo_settings.consumer_secret_encrypted
    )
    woo_connection_ok = bool(woo_settings and woo_settings.last_test_success)
    woo_last_test = woo_settings.last_tested_at.isoformat() if woo_settings and woo_settings.last_tested_at else "Never"
    woo_last_sync = woo_settings.last_sync_finished_at.isoformat() if woo_settings and woo_settings.last_sync_finished_at else "Never"
    woo_last_sync_status = woo_settings.last_sync_status if woo_settings and woo_settings.last_sync_status else "Never"
    woo_auto_sync = bool(woo_settings and woo_settings.auto_sync_enabled)
    woo_value = (
        f"Settings: {'ready' if woo_active_settings else 'incomplete'} | "
        f"Last test: {woo_last_test} | "
        f"Auto-sync: {'enabled' if woo_auto_sync else 'stored only'} | "
        f"Last sync: {woo_last_sync_status} at {woo_last_sync} | "
        f"Recent failed syncs: {recent_failed_woo_syncs}"
    )
    woo_status = "pass" if woo_active_settings and woo_connection_ok else "warning"
    if not woo_active_settings:
        woo_status = "fail"

    items = [
        MaintenanceChecklistItemRead(
            key="migrations_applied",
            label="Migrations applied",
            status="pass" if migrations.up_to_date else "warning",
            value="Up to date" if migrations.up_to_date else f"Current: {migrations.current_revision or 'unknown'} / Head: {migrations.head_revision or 'unknown'}",
            recommended_action="Run alembic upgrade head before release if revisions differ.",
            route=None,
        ),
        MaintenanceChecklistItemRead(
            key="admin_user_exists",
            label="Active admin user exists",
            status="pass" if active_admin_count > 0 else "fail",
            value=str(active_admin_count),
            recommended_action="Ensure at least one active admin or super_admin account remains accessible.",
            route="/dashboard/users",
        ),
        MaintenanceChecklistItemRead(
            key="business_settings_configured",
            label="Business settings configured",
            status="pass" if business_settings and business_settings.company_name else "warning",
            value=business_settings.company_name if business_settings and business_settings.company_name else "Not configured",
            recommended_action="Review business profile, invoice defaults, and branding settings.",
            route="/dashboard/settings",
        ),
        MaintenanceChecklistItemRead(
            key="warehouse_exists",
            label="At least one warehouse exists",
            status="pass" if warehouse_count > 0 else "fail",
            value=str(warehouse_count),
            recommended_action="Create a warehouse before inventory, orders, or POS go live.",
            route="/dashboard/warehouses",
        ),
        MaintenanceChecklistItemRead(
            key="finance_account_exists",
            label="At least one finance account exists",
            status="pass" if finance_account_count > 0 else "warning",
            value=str(finance_account_count),
            recommended_action="Add a cash, bank, or mobile banking account for collections and expenses.",
            route="/dashboard/finance",
        ),
        MaintenanceChecklistItemRead(
            key="invoice_template_configured",
            label="Invoice template configured",
            status="pass" if default_template_count > 0 else "warning",
            value=str(default_template_count),
            recommended_action="Set a default invoice template or confirm the standard invoice layout is acceptable.",
            route="/dashboard/settings",
        ),
        MaintenanceChecklistItemRead(
            key="permissions_seeded",
            label="Permissions seeded",
            status="pass" if permission_count > 0 else "warning",
            value=str(permission_count),
            recommended_action="Seed default permissions before relying on sidebar or module visibility rules.",
            route="/dashboard/users",
        ),
        MaintenanceChecklistItemRead(
            key="low_stock_products",
            label="Low-stock products",
            status="warning" if low_stock_count > 0 else "pass",
            value=str(low_stock_count),
            recommended_action="Review low-stock items and replenish where necessary before release.",
            route="/dashboard/reports",
        ),
        MaintenanceChecklistItemRead(
            key="pending_shipments",
            label="Pending shipments",
            status="warning" if pending_shipment_count > 0 else "pass",
            value=str(pending_shipment_count),
            recommended_action="Review open shipment workload and courier assignments.",
            route="/dashboard/logistics",
        ),
        MaintenanceChecklistItemRead(
            key="unsettled_reconciliation",
            label="Unsettled reconciliation items",
            status="warning" if unsettled_reconciliation_count > 0 else "pass",
            value=str(unsettled_reconciliation_count),
            recommended_action="Clear internal reconciliation items before closing the period.",
            route="/dashboard/logistics",
        ),
        MaintenanceChecklistItemRead(
            key="pending_tasks",
            label="Pending tasks",
            status="warning" if pending_task_count > 0 else "pass",
            value=str(pending_task_count),
            recommended_action="Review open operational tasks and resolve blockers before release.",
            route="/dashboard/tasks",
        ),
        MaintenanceChecklistItemRead(
            key="woo_sync_logs",
            label="WooCommerce manual import readiness",
            status=woo_status,
            value=f"{woo_value} | Log rows: {woo_sync_log_count}",
            recommended_action="Confirm active settings, save encrypted credentials, run a successful connection test, and review recent failed WooCommerce sync logs before relying on manual imports.",
            route="/dashboard/woocommerce",
        ),
    ]

    return MaintenanceChecklistRead(items=items, timestamp=datetime.now(timezone.utc))


@router.get("/exports/products")
async def export_products(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    result = await db.execute(
        select(Product).options(selectinload(Product.category), selectinload(Product.brand)).order_by(Product.created_at.desc())
    )
    products = result.scalars().all()
    await log_activity(
        db,
        user_id=current_user.id,
        action="export_downloaded",
        module="admin",
        entity_type="products",
        entity_id=None,
        message="Downloaded products CSV export.",
        request=request,
    )
    await db.commit()
    return _csv_response(
        "products.csv",
        ["Name", "SKU", "Category", "Brand", "Price", "Cost Price", "Status", "Created At"],
        [
            [
                product.name,
                product.sku,
                product.category.name if product.category else "",
                product.brand.name if product.brand else "",
                product.price,
                product.cost_price,
                product.status,
                _stringify(product.created_at),
            ]
            for product in products
        ],
    )


@router.get("/exports/customers")
async def export_customers(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    customers = (await db.execute(select(Customer).order_by(Customer.created_at.desc()))).scalars().all()
    await log_activity(
        db,
        user_id=current_user.id,
        action="export_downloaded",
        module="admin",
        entity_type="customers",
        entity_id=None,
        message="Downloaded customers CSV export.",
        request=request,
    )
    await db.commit()
    return _csv_response(
        "customers.csv",
        ["Name", "Phone", "Email", "City", "Customer Type", "Follow Up Date", "Created At"],
        [
            [
                customer.name,
                customer.phone,
                customer.email,
                customer.city,
                customer.customer_type,
                _stringify(customer.follow_up_date),
                _stringify(customer.created_at),
            ]
            for customer in customers
        ],
    )


@router.get("/exports/orders")
async def export_orders(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.warehouse), selectinload(Order.customer))
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    await log_activity(
        db,
        user_id=current_user.id,
        action="export_downloaded",
        module="admin",
        entity_type="orders",
        entity_id=None,
        message="Downloaded orders CSV export.",
        request=request,
    )
    await db.commit()
    return _csv_response(
        "orders.csv",
        ["Order Number", "Customer", "Phone", "Warehouse", "Status", "Payment Status", "Source", "Total", "Paid Amount", "Created At"],
        [
            [
                order.order_number,
                order.customer_name or (order.customer.name if order.customer else ""),
                order.customer_phone,
                order.warehouse.name if order.warehouse else "",
                order.status,
                order.payment_status,
                order.source,
                order.total,
                order.paid_amount,
                _stringify(order.created_at),
            ]
            for order in orders
        ],
    )


@router.get("/exports/inventory")
async def export_inventory(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    result = await db.execute(
        select(InventoryItem)
        .options(
            selectinload(InventoryItem.product),
            selectinload(InventoryItem.variant),
            selectinload(InventoryItem.warehouse),
        )
        .order_by(InventoryItem.updated_at.desc())
    )
    inventory_items = result.scalars().all()
    await log_activity(
        db,
        user_id=current_user.id,
        action="export_downloaded",
        module="admin",
        entity_type="inventory",
        entity_id=None,
        message="Downloaded inventory CSV export.",
        request=request,
    )
    await db.commit()
    return _csv_response(
        "inventory.csv",
        ["Product", "Variant", "SKU", "Warehouse", "Quantity", "Low Stock Threshold", "Updated At"],
        [
            [
                item.product.name if item.product else "",
                item.variant.name if item.variant else "",
                item.variant.sku if item.variant else (item.product.sku if item.product else ""),
                item.warehouse.name if item.warehouse else "",
                item.quantity,
                item.low_stock_threshold,
                _stringify(item.updated_at),
            ]
            for item in inventory_items
        ],
    )


@router.get("/exports/stock-movements")
async def export_stock_movements(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    result = await db.execute(
        select(StockMovement)
        .options(
            selectinload(StockMovement.product),
            selectinload(StockMovement.variant),
            selectinload(StockMovement.warehouse),
            selectinload(StockMovement.order),
        )
        .order_by(StockMovement.created_at.desc())
    )
    stock_movements = result.scalars().all()
    await log_activity(
        db,
        user_id=current_user.id,
        action="export_downloaded",
        module="admin",
        entity_type="stock_movements",
        entity_id=None,
        message="Downloaded stock movements CSV export.",
        request=request,
    )
    await db.commit()
    return _csv_response(
        "stock-movements.csv",
        ["Product", "Variant", "SKU", "Warehouse", "Movement Type", "Quantity", "Previous Quantity", "New Quantity", "Order Number", "Created At"],
        [
            [
                movement.product.name if movement.product else "",
                movement.variant.name if movement.variant else "",
                movement.variant.sku if movement.variant else (movement.product.sku if movement.product else ""),
                movement.warehouse.name if movement.warehouse else "",
                movement.movement_type,
                movement.quantity,
                movement.previous_quantity,
                movement.new_quantity,
                movement.order.order_number if movement.order else "",
                _stringify(movement.created_at),
            ]
            for movement in stock_movements
        ],
    )


@router.get("/exports/transactions")
async def export_transactions(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.account), selectinload(Transaction.related_account))
        .order_by(Transaction.transaction_date.desc())
    )
    transactions = result.scalars().all()
    await log_activity(
        db,
        user_id=current_user.id,
        action="export_downloaded",
        module="admin",
        entity_type="transactions",
        entity_id=None,
        message="Downloaded finance transactions CSV export.",
        request=request,
    )
    await db.commit()
    return _csv_response(
        "transactions.csv",
        ["Transaction Number", "Account", "Related Account", "Type", "Direction", "Amount", "Category", "Reference Type", "Reference ID", "Transaction Date"],
        [
            [
                transaction.transaction_number,
                transaction.account.name if transaction.account else "",
                transaction.related_account.name if transaction.related_account else "",
                transaction.transaction_type,
                transaction.direction,
                transaction.amount,
                transaction.category,
                transaction.reference_type,
                transaction.reference_id,
                _stringify(transaction.transaction_date),
            ]
            for transaction in transactions
        ],
    )


@router.get("/exports/suppliers")
async def export_suppliers(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    suppliers = (await db.execute(select(Supplier).order_by(Supplier.created_at.desc()))).scalars().all()
    await log_activity(
        db,
        user_id=current_user.id,
        action="export_downloaded",
        module="admin",
        entity_type="suppliers",
        entity_id=None,
        message="Downloaded suppliers CSV export.",
        request=request,
    )
    await db.commit()
    return _csv_response(
        "suppliers.csv",
        ["Name", "Contact Person", "Phone", "Email", "Active", "Created At"],
        [
            [
                supplier.name,
                supplier.contact_person,
                supplier.phone,
                supplier.email,
                "Yes" if supplier.is_active else "No",
                _stringify(supplier.created_at),
            ]
            for supplier in suppliers
        ],
    )


@router.get("/exports/purchase-orders")
async def export_purchase_orders(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.supplier), selectinload(PurchaseOrder.warehouse))
        .order_by(PurchaseOrder.created_at.desc())
    )
    purchase_orders = result.scalars().all()
    await log_activity(
        db,
        user_id=current_user.id,
        action="export_downloaded",
        module="admin",
        entity_type="purchase_orders",
        entity_id=None,
        message="Downloaded purchase orders CSV export.",
        request=request,
    )
    await db.commit()
    return _csv_response(
        "purchase-orders.csv",
        ["PO Number", "Supplier", "Warehouse", "Status", "Order Date", "Expected Date", "Received Date", "Total", "Stock Received"],
        [
            [
                purchase_order.po_number,
                purchase_order.supplier.name if purchase_order.supplier else "",
                purchase_order.warehouse.name if purchase_order.warehouse else "",
                purchase_order.status,
                _stringify(purchase_order.order_date),
                _stringify(purchase_order.expected_date),
                _stringify(purchase_order.received_date),
                purchase_order.total,
                "Yes" if purchase_order.stock_received else "No",
            ]
            for purchase_order in purchase_orders
        ],
    )
