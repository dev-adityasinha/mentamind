from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.settings import SettingsResponse, SettingsUpdateRequest

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SettingsResponse:
    settings = await db.get(UserSettings, current_user.id)
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.patch("", response_model=SettingsResponse)
async def update_settings(
    request: SettingsUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SettingsResponse:
    settings = await db.get(UserSettings, current_user.id)
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)
    return settings
