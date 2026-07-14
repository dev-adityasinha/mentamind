from datetime import UTC, datetime, timedelta

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_coach import AiCoachSession
from app.models.emotion_analysis import EmotionAnalysis
from app.models.mood_log import MoodLog
from app.models.psychologist_summary import PsychologistSummary
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.schemas.auth import TokenResponse
from app.services.auth_service import (
    create_access_token,
    generate_refresh_token,
    hash_email,
    hash_password,
)
from app.settings import settings


async def merge_ghost_user(
    db: AsyncSession,
    ghost_user: User,
    anonymous_session_id: str,
    email: str,
    display_name: str,
    password: str,
    role: UserRole = UserRole.EMPLOYEE,
) -> TokenResponse:
    """Convert the authenticated ghost user to a real user.

    The caller must present a valid ghost JWT, which is verified by the
    require_ghost_user() dependency before this function is reached.
    Data records tagged with *anonymous_session_id* are reattached to
    the new real user.
    """
    if not ghost_user.is_anonymous:
        raise ValueError("User is not a ghost")

    ghost_user.email_hash = hash_email(email)
    ghost_user.password_hash = hash_password(password)
    ghost_user.display_name = display_name
    ghost_user.role = role
    ghost_user.is_anonymous = False
    ghost_user.anonymous_session_id = None
    ghost_user.onboarding_completed_at = datetime.now(UTC)
    ghost_user.last_active_at = datetime.now(UTC)
    await db.flush()

    models_to_reattach = [
        (MoodLog, MoodLog.session_id),
        (EmotionAnalysis, EmotionAnalysis.session_id),
        (PsychologistSummary, PsychologistSummary.session_id),
        (AiCoachSession, AiCoachSession.session_id),
    ]

    for model, session_id_col in models_to_reattach:
        await db.execute(
            update(model)
            .where(session_id_col == anonymous_session_id)
            .where(model.user_id.is_(None))
            .values(user_id=ghost_user.id)
        )

    access_token = create_access_token(
        ghost_user.id, ghost_user.org_id, ghost_user.role.value
    )
    raw_refresh, refresh_hash = generate_refresh_token()

    db.add(
        RefreshToken(
            user_id=ghost_user.id,
            token_hash=refresh_hash,
            expires_at=datetime.now(UTC)
            + timedelta(days=settings.refresh_token_expire_days),
        )
    )

    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)
