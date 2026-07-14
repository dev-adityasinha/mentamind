from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.user import User, UserRole
from app.schemas.user import UserResponse

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


from app.models.user_settings import UserSettings
from app.schemas.user import UserProfileResponse, UserProfileUpdateRequest
from fastapi import HTTPException, status


@router.get("/me/profile", response_model=UserProfileResponse)
async def get_my_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    settings = result.scalar_one_or_none()
    
    return {
        "id": current_user.id,
        "display_name": current_user.display_name,
        "age": settings.age if settings else None,
        "gender": settings.gender if settings else None,
        "country": settings.country if settings else None,
        "avatar_url": settings.avatar_url if settings else None,
        "mental_health_goals": settings.mental_health_goals if settings else [],
    }


@router.patch("/me/profile", response_model=UserProfileResponse)
async def update_my_profile(
    body: UserProfileUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    if body.display_name is not None:
        current_user.display_name = body.display_name.strip()
        db.add(current_user)

    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)

    if body.age is not None:
        settings.age = body.age
    if body.gender is not None:
        settings.gender = body.gender
    if body.country is not None:
        settings.country = body.country
    if body.avatar_url is not None:
        settings.avatar_url = body.avatar_url
    if body.mental_health_goals is not None:
        settings.mental_health_goals = body.mental_health_goals

    await db.commit()
    await db.refresh(settings)

    return {
        "id": current_user.id,
        "display_name": current_user.display_name,
        "age": settings.age,
        "gender": settings.gender,
        "country": settings.country,
        "avatar_url": settings.avatar_url,
        "mental_health_goals": settings.mental_health_goals,
    }


_can_view_users = require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    current_user: User = _can_view_users,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[User]:
    result = await db.execute(
        select(User)
        .where(User.org_id == current_user.org_id)
        .order_by(User.created_at.desc())
    )
    return result.scalars().all()
