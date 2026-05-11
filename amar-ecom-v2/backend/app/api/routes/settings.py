from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409
from app.models.business_settings import BusinessSettings
from app.schemas.business_settings import BusinessSettingsRead, BusinessSettingsUpdate


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
) -> BusinessSettings:
    settings = await get_or_create_business_settings(db)
    payload = settings_in.model_dump(exclude_unset=True)

    for field, value in payload.items():
        setattr(settings, field, value)

    await commit_or_409(db, "Could not update business settings")
    await db.refresh(settings)
    return settings
