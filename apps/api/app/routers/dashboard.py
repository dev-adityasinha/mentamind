from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.ai_coach import AiCoachSession
from app.models.chat import ChatSession, ChatSessionStatus
from app.models.post import Post
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_dashboard_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:

    # Unread community posts count (mock logic: posts created recently)
    community_res = await db.execute(select(func.count(Post.id)))
    community_count = community_res.scalar() or 0

    # Pending chat requests count
    chats_res = await db.execute(
        select(func.count(ChatSession.id)).where(ChatSession.status == ChatSessionStatus.WAITING)
    )
    chats_count = chats_res.scalar() or 0

    # AI coach session count
    ai_res = await db.execute(
        select(func.count(AiCoachSession.id)).where(
            AiCoachSession.user_id == current_user.id
        )
    )
    ai_count = ai_res.scalar() or 0

    return {
        "community_posts": community_count,
        "pending_chats": chats_count,
        "ai_checkins": ai_count,
    }
