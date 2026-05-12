from fastapi import APIRouter, Depends, Request
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409
from app.models.business_settings import BusinessSettings
from app.models.user import User
from app.schemas.business_settings import BusinessSettingsRead, BusinessSettingsUpdate
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


async def get_or_create_business_settings(db: DBSession) -> BusinessSettings:
    result = await db.execute(select(BusinessSettings).limit(1))
    settings = result.scalar_one_or_none()

    if settings is None:
        settings = BusinessSettings()
        db.add(settings)
        await commit_or_409(db, "Could not initialize business settings")
        await db.refresh(settings)

    return settings


@router.get("/business", response_model=BusinessSettingsRead)
async def get_business_settings(db: DBSession) -> BusinessSettings:
    return await get_or_create_business_settings(db)


@router.patch("/business", response_model=BusinessSettingsRead)
async def update_business_settings(
    settings_in: BusinessSettingsUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> BusinessSettings:
    settings = await get_or_create_business_settings(db)
    payload = settings_in.model_dump(exclude_unset=True)

    for field, value in payload.items():
        setattr(settings, field, value)

    await log_activity(
        db,
        user_id=current_user.id,
        action="business_settings_updated",
        module="settings",
        entity_type="business_settings",
        entity_id=settings.id,
        message="Updated business settings.",
        request=request,
    )
    await commit_or_409(db, "Could not update business settings")
    await db.refresh(settings)
    return settings
