from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.chat import ChatSession
from app.models.comment import Comment
from app.models.meditation import MeditationStats
from app.models.mood_log import MoodLog
from app.models.post import Post
from app.models.test_score import TestScore
from app.models.user import User
from app.models.wellness_score import WellnessScore

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _daily_streak(db: AsyncSession, user_id, today) -> int:
    """Consecutive days (ending today or yesterday) with at least one mood log.

    Computed from real mood_logs rows — counts back from today until a gap.
    """
    rows = await db.execute(
        select(MoodLog.logged_at).where(
            MoodLog.user_id == user_id,
            MoodLog.logged_at >= datetime.now(UTC) - timedelta(days=60),
        )
    )
    logged_days = {r[0].date() for r in rows.all()}
    if not logged_days:
        return 0
    # The streak is "current" only if the last entry was today or yesterday.
    start = today if today in logged_days else today - timedelta(days=1)
    if start not in logged_days:
        return 0
    streak = 0
    cursor = start
    while cursor in logged_days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


@router.get("/summary")
async def get_dashboard_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    now = datetime.now(UTC)
    today = now.date()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    uid = current_user.id

    # --- Daily mood: today's latest mood log (real row) ---
    mood_res = await db.execute(
        select(MoodLog)
        .where(MoodLog.user_id == uid, MoodLog.logged_at >= today_start)
        .order_by(MoodLog.logged_at.desc())
        .limit(1)
    )
    todays_mood = mood_res.scalar_one_or_none()
    daily_mood = (
        {
            "mood_score": todays_mood.mood_score,
            "energy_score": todays_mood.energy_score,
            "stress_score": todays_mood.stress_score,
            "logged_at": todays_mood.logged_at.isoformat(),
        }
        if todays_mood
        else None
    )

    # --- Meditation progress: real MeditationStats ---
    stats_res = await db.execute(
        select(MeditationStats).where(MeditationStats.user_id == uid)
    )
    med_stats = stats_res.scalar_one_or_none()
    meditation_progress = {
        "total_minutes": med_stats.total_minutes if med_stats else 0,
        "total_sessions": med_stats.total_sessions if med_stats else 0,
        "current_streak": med_stats.current_streak if med_stats else 0,
        "weekly_streak": med_stats.weekly_streak if med_stats else 0,
        "last_meditated_at": (
            med_stats.last_meditated_at.isoformat()
            if med_stats and med_stats.last_meditated_at
            else None
        ),
    }

    # --- Community activity: this user's own posts + comments (real counts) ---
    my_posts_res = await db.execute(
        select(func.count(Post.id)).where(Post.author_id == uid)
    )
    my_comments_res = await db.execute(
        select(func.count(Comment.id)).where(Comment.author_id == uid)
    )
    recent_org_posts_res = await db.execute(
        select(func.count(Post.id)).where(
            Post.org_id == current_user.org_id,
            Post.created_at >= now - timedelta(days=7),
        )
    )
    community_activity = {
        "my_posts": my_posts_res.scalar() or 0,
        "my_comments": my_comments_res.scalar() or 0,
        "org_posts_this_week": recent_org_posts_res.scalar() or 0,
    }

    # --- Screening results: latest assessment (real TestScore) ---
    test_res = await db.execute(
        select(TestScore)
        .where(TestScore.user_id == uid)
        .order_by(TestScore.created_at.desc())
        .limit(1)
    )
    latest_test = test_res.scalar_one_or_none()
    screening_results = (
        {
            "test_id": latest_test.test_id,
            "score": latest_test.score,
            "severity": latest_test.severity,
            "taken_at": latest_test.created_at.isoformat(),
        }
        if latest_test
        else None
    )

    # --- Recent chats: this user's most recent sessions (real rows) ---
    chats_res = await db.execute(
        select(ChatSession)
        .where(
            or_(
                ChatSession.participant_1_id == uid,
                ChatSession.participant_2_id == uid,
            )
        )
        .order_by(ChatSession.created_at.desc())
        .limit(5)
    )
    chat_rows = chats_res.scalars().all()
    recent_chats = [
        {
            "id": str(c.id),
            "status": c.status.value,
            "created_at": c.created_at.isoformat(),
            "ended_at": c.ended_at.isoformat() if c.ended_at else None,
        }
        for c in chat_rows
    ]

    # --- Wellness score: latest computed WellnessScore (real row) ---
    ws_res = await db.execute(
        select(WellnessScore)
        .where(WellnessScore.user_id == uid)
        .order_by(WellnessScore.score_date.desc())
        .limit(1)
    )
    ws = ws_res.scalar_one_or_none()
    wellness_score = (
        {
            "composite_score": ws.composite_score,
            "burnout_risk_level": (
                ws.burnout_risk_level.value if ws.burnout_risk_level else None
            ),
            "score_date": ws.score_date.isoformat(),
        }
        if ws
        else None
    )

    # --- Daily streak: consecutive days with a mood check-in (real) ---
    daily_streak = await _daily_streak(db, uid, today)

    # --- Suggested activities: derived from the user's real state (not static) ---
    suggestions: list[dict] = []
    if todays_mood is None:
        suggestions.append(
            {
                "type": "mood_checkin",
                "title": "Log today's mood",
                "reason": "You haven't checked in today.",
                "href": "/checkin",
            }
        )
    meditated_today = bool(
        med_stats
        and med_stats.last_meditated_at
        and med_stats.last_meditated_at.date() == today
    )
    if not meditated_today:
        suggestions.append(
            {
                "type": "meditation",
                "title": "Take a mindful break",
                "reason": (
                    "Keep your streak going."
                    if (med_stats and med_stats.current_streak > 0)
                    else "A short session can reset your day."
                ),
                "href": "/meditation",
            }
        )
    if latest_test is None or latest_test.created_at < now - timedelta(days=14):
        suggestions.append(
            {
                "type": "assessment",
                "title": "Check in on your wellbeing",
                "reason": "It's been a while since your last assessment.",
                "href": "/tests",
            }
        )
    if todays_mood and todays_mood.stress_score and todays_mood.stress_score >= 4:
        suggestions.append(
            {
                "type": "stress_relief",
                "title": "Ease some stress",
                "reason": "Your stress felt high today.",
                "href": "/meditation",
            }
        )

    return {
        "daily_mood": daily_mood,
        "meditation_progress": meditation_progress,
        "community_activity": community_activity,
        "screening_results": screening_results,
        "recent_chats": recent_chats,
        "wellness_score": wellness_score,
        "daily_streak": daily_streak,
        "suggested_activities": suggestions,
    }
