import uuid as uuid_module
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.services.auth_service import decode_access_token

_bearer = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError:
        raise exc

    try:
        user_id = uuid_module.UUID(payload.get("sub") or "")
        org_id = uuid_module.UUID(payload.get("org_id") or "")
    except ValueError:
        raise exc

    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == org_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise exc
    return user


def require_roles(*roles: UserRole):
    """Dependency factory: use as a default value on route parameters."""

    async def dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return Depends(dependency)


def forbid_anonymous():
    """Dependency factory: reject anonymous ghost users."""

    async def dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.is_anonymous or current_user.role == UserRole.ANONYMOUS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Anonymous ghost users cannot access this resource",
            )
        return current_user

    return Depends(dependency)


def require_ghost_user():
    """Dependency factory: require the caller to be an anonymous ghost user.

    Used by /auth/ghost/merge to verify the caller controls the ghost
    session via its JWT before allowing the merge.  The ghost JWT is only
    obtainable through /auth/spawn-ghost which itself requires a valid real
    user session, so presenting it proves ownership of the ghost session.
    """

    async def dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if not current_user.is_anonymous and current_user.role != UserRole.ANONYMOUS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only ghost users can perform this action",
            )
        return current_user

    return Depends(dependency)
