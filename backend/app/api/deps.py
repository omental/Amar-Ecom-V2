from collections.abc import Callable
import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.core.tenant import TenantContext, activate_tenant, deactivate_tenant
from app.services.tenant_service import PublicStoreContext, StoreResolver, resolve_user_store
from app.services.permission_service import user_has_permission
from app.services.commercial_access_service import EntitlementService
from app.core.config import settings


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

DBSession = Annotated[AsyncSession, Depends(get_db)]
TokenDep = Annotated[str, Depends(oauth2_scheme)]


async def get_current_user(
    db: DBSession,
    token: TokenDep,
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if not subject:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    result = await db.execute(select(User).where(User.id == subject))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user


async def get_tenant_context(
    db: DBSession,
    current_user: Annotated[User, Depends(get_current_user)],
    x_amar_store: Annotated[str | None, Header(alias="X-Amar-Store")] = None,
):
    organization_membership, store_membership, store = await resolve_user_store(db, current_user, x_amar_store)
    tokens = activate_tenant(store_id=store.id, organization_id=store.organization_id)
    try:
        yield TenantContext(
            organization=organization_membership.organization,
            store=store,
            user=current_user,
            organization_membership=organization_membership,
            store_membership=store_membership,
        )
    finally:
        deactivate_tenant(tokens)


async def get_public_store_context(
    request: Request,
    db: DBSession,
    x_storefront_store: Annotated[str | None, Header(alias="X-Storefront-Store")] = None,
    x_amar_storefront_host: Annotated[str | None, Header(alias="X-Amar-Storefront-Host")] = None,
    x_amar_internal_secret: Annotated[str | None, Header(alias="X-Amar-Internal-Secret")] = None,
):
    cached = getattr(request.state, "public_store_context", None)
    if cached is None:
        hostname = request.headers.get("host")
        configured_secret = settings.STOREFRONT_INTERNAL_SECRET or (
            "amar-development-storefront-proxy" if settings.APP_ENV in {"development", "test"} else None
        )
        if (
            configured_secret
            and x_amar_storefront_host
            and x_amar_internal_secret
            and hmac.compare_digest(configured_secret, x_amar_internal_secret)
        ):
            hostname = x_amar_storefront_host
        else:
            client_host = request.client.host if request.client else ""
            trusted = {item.strip() for item in settings.STOREFRONT_TRUSTED_PROXY_IPS.split(",") if item.strip()}
            if settings.APP_ENV in {"development", "test"}:
                trusted.update({"127.0.0.1", "::1", "testclient"})
            forwarded = request.headers.get("x-forwarded-host")
            if client_host in trusted and forwarded:
                hostname = forwarded.split(",", 1)[0].strip()
        legacy_store = x_storefront_store if settings.APP_ENV in {"development", "test"} else None
        cached = await StoreResolver.resolve(
            db,
            hostname=None if legacy_store else hostname,
            requested_store=legacy_store,
        )
        request.state.public_store_context = cached
    public_context = cached
    tokens = activate_tenant(
        store_id=public_context.store.id,
        organization_id=public_context.organization.id,
    )
    try:
        yield public_context
    finally:
        deactivate_tenant(tokens)


async def get_entitlement_context(
    request: Request,
    db: DBSession,
    tenant: Annotated[TenantContext, Depends(get_tenant_context)],
) -> EntitlementService:
    cached = getattr(request.state, "commercial_access", None)
    if cached is None or cached.store_id != tenant.store.id:
        cached = EntitlementService(
            db,
            store_id=tenant.store.id,
            organization_id=tenant.organization.id,
        )
        request.state.commercial_access = cached
    return cached


async def require_platform_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.is_platform_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform administrator access required")
    return current_user


def require_permission(module: str, action: str = "view") -> Callable:
    async def permission_dependency(
        db: DBSession,
        current_user: Annotated[User, Depends(get_current_user)],
        _tenant: Annotated[TenantContext, Depends(get_tenant_context)],
    ) -> User:
        if not await user_has_permission(db, current_user, module, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {module}.{action}",
            )
        return current_user

    return permission_dependency


def require_entitlement(feature_key: str) -> Callable:
    async def entitlement_dependency(
        access: Annotated[EntitlementService, Depends(get_entitlement_context)],
    ) -> None:
        await access.require_feature(feature_key)

    return entitlement_dependency
