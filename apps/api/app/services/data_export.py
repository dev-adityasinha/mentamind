import uuid as uuid_module

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_coach import AiCoachMessage, AiCoachSession
from app.models.journal import JournalEntry
from app.models.mood_log import MoodLog
from app.models.user import User
from app.models.user_settings import UserSettings
from app.models.wellness_score import WellnessScore


async def export_user_data(
    db: AsyncSession,
    user_id: uuid_module.UUID,
) -> dict:
    """Assemble all user data for GDPR Art. 15 export."""

    user = await db.get(User, user_id)
    if not user:
        return {"error": "User not found"}

    moods = await db.execute(
        select(MoodLog).where(MoodLog.user_id == user_id).order_by(MoodLog.logged_at)
    )
    mood_logs = moods.scalars().all()

    journals = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.user_id == user_id)
        .order_by(JournalEntry.created_at)
    )
    journal_entries = journals.scalars().all()

    coach_sessions = await db.execute(
        select(AiCoachSession)
        .where(AiCoachSession.user_id == user_id)
        .order_by(AiCoachSession.started_at)
    )
    sessions = coach_sessions.scalars().all()

    message_ids = [s.id for s in sessions]
    messages = []
    if message_ids:
        coach_msgs = await db.execute(
            select(AiCoachMessage)
            .where(AiCoachMessage.session_id.in_(message_ids))
            .order_by(AiCoachMessage.created_at)
        )
        messages = coach_msgs.scalars().all()

    wellness_scores = await db.execute(
        select(WellnessScore)
        .where(WellnessScore.user_id == user_id)
        .order_by(WellnessScore.score_date)
    )
    scores = wellness_scores.scalars().all()

    settings = await db.get(UserSettings, user_id)

    return {
        "profile": {
            "id": str(user.id),
            "org_id": str(user.org_id),
            "display_name": user.display_name,
            "role": user.role.value,
            "is_anonymous": user.is_anonymous,
            "created_at": user.created_at.isoformat(),
            "last_active_at": (
                user.last_active_at.isoformat() if user.last_active_at else None
            ),
            "onboarding_completed_at": (
                user.onboarding_completed_at.isoformat()
                if user.onboarding_completed_at
                else None
            ),
            "consent": {
                "analytics": user.consent_analytics,
                "ai_coaching": user.consent_ai_coaching,
                "community": user.consent_community,
                "privacy_version": user.privacy_consent_version,
            },
        },
        "mood_logs": [
            {
                "id": str(m.id),
                "mood_score": m.mood_score,
                "emotion_tags": m.emotion_tags,
                "context_tag": m.context_tag,
                "input_method": m.input_method.value,
                "logged_at": m.logged_at.isoformat(),
            }
            for m in mood_logs
        ],
        "journal_entries": [
            {
                "id": str(j.id),
                "entry_type": j.entry_type.value,
                "mood_score": j.mood_score,
                "emotion_tags": j.emotion_tags,
                "word_count": j.word_count,
                "created_at": j.created_at.isoformat(),
            }
            for j in journal_entries
        ],
        "ai_coach_sessions": [
            {
                "id": str(s.id),
                "message_count": s.message_count,
                "crisis_detected": s.crisis_detected,
                "started_at": s.started_at.isoformat(),
                "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            }
            for s in sessions
        ],
        "ai_coach_messages": [
            {
                "id": str(m.id),
                "session_id": str(m.session_id),
                "role": m.role,
                "sentiment_score": m.sentiment_score,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "wellness_scores": [
            {
                "id": str(s.id),
                "score_date": s.score_date.isoformat(),
                "composite_score": s.composite_score,
                "burnout_risk_level": (
                    s.burnout_risk_level.value if s.burnout_risk_level else None
                ),
                "model_version": s.model_version,
            }
            for s in scores
        ],
        "settings": {
            "theme": settings.theme.value if settings else "system",
            "notifications_enabled": (
                settings.notifications_enabled if settings else True
            ),
            "language": settings.language if settings else "en",
            "timezone": settings.timezone if settings else "UTC",
        },
    }
