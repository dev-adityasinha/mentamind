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
