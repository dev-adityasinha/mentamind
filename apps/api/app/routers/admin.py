from fastapi import APIRouter

from app.dependencies.auth import require_roles
from app.models.user import User, UserRole

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/ping")
async def admin_ping(
    user: User = require_roles(UserRole.ADMIN, UserRole.HR_MANAGER),
) -> dict:
    return {"pong": True, "user_id": str(user.id)}
