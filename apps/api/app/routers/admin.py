import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import Date as SADate
from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models.ai_coach import AiCoachSession
from app.models.comment import Comment
from app.models.meditation import MeditationHistory
from app.models.mood_log import MoodLog
from app.models.post import Post
from app.models.report import ContentReport
from app.models.test_score import TestScore
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminAnalyticsResponse,
    AdminBanUserRequest,
    AdminReportResponse,
    AdminReportStatusUpdateRequest,
    AdminStatsResponse,
    AdminUserListResponse,
    AdminUserResponse,
    TimeSeriesPoint,
)

router = APIRouter(prefix="/admin", tags=["admin"])

# Role groups.
# - Full admins manage accounts and see platform-wide analytics.
# - Moderators (plus admins) handle community moderation only: they can review
#   reports and remove offending posts/comments, but NOT manage user accounts
#   or view analytics.
_ADMINS = (UserRole.ADMIN, UserRole.HR_MANAGER)
_MODERATORS = (UserRole.ADMIN, UserRole.HR_MANAGER, UserRole.MODERATOR)

# Analytics window used for "active users" and default time-series length.
_DEFAULT_ANALYTICS_DAYS = 30


@router.get("/ping")
async def admin_ping(
    user: Annotated[User, require_roles(*_MODERATORS)],
) -> dict:
    return {"pong": True, "user_id": str(user.id), "role": user.role}


# ---------------------------------------------------------------------------
# Stats (admin / HR only)
# ---------------------------------------------------------------------------


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    response: Response,
    admin_user: Annotated[User, require_roles(*_ADMINS)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminStatsResponse:
    # Never cache: these counts change the instant a moderator deletes content,
    # and a stale (PWA/service-worker) copy would show already-deleted items.
    response.headers["Cache-Control"] = "no-store"

    # All stats are scoped to the admin's own organization (multi-tenant). Models
    # with an org_id column are filtered directly; models that only have a
    # user_id / author_id / reporter_id are scoped via this org-user subquery.
    org_id = admin_user.org_id
    org_user_ids = select(User.id).where(User.org_id == org_id).scalar_subquery()

    users_result = await db.execute(
        select(func.count(User.id)).where(
            User.org_id == org_id, User.deleted_at.is_(None)
        )
    )
    total_users = users_result.scalar() or 0

    posts_result = await db.execute(
        select(func.count(Post.id)).where(Post.org_id == org_id)
    )
    total_posts = posts_result.scalar() or 0

    reports_result = await db.execute(
        select(func.count(ContentReport.id)).where(
            ContentReport.status == "pending",
            ContentReport.reporter_id.in_(org_user_ids),
        )
    )
    active_reports = reports_result.scalar() or 0

    ai_sessions_result = await db.execute(
        select(func.count(AiCoachSession.id)).where(
            AiCoachSession.user_id.in_(org_user_ids)
        )
    )
    total_ai_sessions = ai_sessions_result.scalar() or 0

    assessments_result = await db.execute(
        select(func.count(TestScore.id)).where(TestScore.user_id.in_(org_user_ids))
    )
    total_assessments = assessments_result.scalar() or 0

    meditation_result = await db.execute(
        select(func.sum(MeditationHistory.duration_minutes)).where(
            MeditationHistory.user_id.in_(org_user_ids)
        )
    )
    total_meditation_minutes = meditation_result.scalar() or 0

    start_of_day = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    daily_reg_result = await db.execute(
        select(func.count(User.id)).where(
            User.org_id == org_id, User.created_at >= start_of_day
        )
    )
    daily_registrations = daily_reg_result.scalar() or 0

    # Mood tracking stats (count of logs per mood score), scoped to the org.
    mood_result = await db.execute(
        select(MoodLog.mood_score, func.count(MoodLog.id))
        .where(MoodLog.org_id == org_id)
        .group_by(MoodLog.mood_score)
    )
    mood_tracking_stats = {str(row[0]): row[1] for row in mood_result.all()}

    # Active users within the analytics window.
    window_start = datetime.now(UTC) - timedelta(days=_DEFAULT_ANALYTICS_DAYS)
    active_users_result = await db.execute(
        select(func.count(User.id)).where(
            User.org_id == org_id,
            User.deleted_at.is_(None),
            User.last_active_at.is_not(None),
            User.last_active_at >= window_start,
        )
    )
    active_users = active_users_result.scalar() or 0

    banned_result = await db.execute(
        select(func.count(User.id)).where(
            User.org_id == org_id, User.is_banned.is_(True)
        )
    )
    banned_users = banned_result.scalar() or 0

    comments_result = await db.execute(
        select(func.count(Comment.id)).where(Comment.author_id.in_(org_user_ids))
    )
    total_comments = comments_result.scalar() or 0

    return AdminStatsResponse(
        total_users=total_users,
        total_posts=total_posts,
        active_reports=active_reports,
        total_ai_sessions=total_ai_sessions,
        total_assessments=total_assessments,
        total_meditation_minutes=total_meditation_minutes,
        daily_registrations=daily_registrations,
        active_users=active_users,
        banned_users=banned_users,
        total_comments=total_comments,
        mood_tracking_stats=mood_tracking_stats,
    )


# ---------------------------------------------------------------------------
# Community moderation (moderators + admins)
# ---------------------------------------------------------------------------


@router.get("/reports", response_model=list[AdminReportResponse])
async def list_reports(
    response: Response,
    admin_user: Annotated[User, require_roles(*_MODERATORS)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AdminReportResponse]:
    response.headers["Cache-Control"] = "no-store"
    query = select(ContentReport).order_by(ContentReport.created_at.desc())
    if status_filter:
        query = query.where(ContentReport.status == status_filter)

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    reports = result.scalars().all()

    response_list = []
    for report in reports:
        enriched_report = AdminReportResponse.model_validate(report)

        reporter_result = await db.execute(
            select(User).where(User.id == report.reporter_id)
        )
        reporter = reporter_result.scalar_one_or_none()
        if reporter:
            enriched_report.reporter_name = reporter.display_name

        if report.target_type == "post":
            post_result = await db.execute(
                select(Post).where(Post.id == report.target_id)
            )
            post = post_result.scalar_one_or_none()
            if post:
                enriched_report.target_content = post.content
                enriched_report.target_author_id = post.author_id
        elif report.target_type == "comment":
            comment_result = await db.execute(
                select(Comment).where(Comment.id == report.target_id)
            )
            comment = comment_result.scalar_one_or_none()
            if comment:
                enriched_report.target_content = comment.content
                enriched_report.target_author_id = comment.author_id

        if enriched_report.target_author_id:
            author_result = await db.execute(
                select(User).where(User.id == enriched_report.target_author_id)
            )
            author = author_result.scalar_one_or_none()
            if author:
                enriched_report.target_author_name = author.display_name

        response_list.append(enriched_report)

    return response_list


@router.patch("/reports/{report_id}")
async def update_report_status(
    report_id: uuid.UUID,
    request: AdminReportStatusUpdateRequest,
    admin_user: Annotated[User, require_roles(*_MODERATORS)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if request.status not in ["resolved", "dismissed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status"
        )

    result = await db.execute(
        select(ContentReport).where(ContentReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )

    report.status = request.status
    await db.commit()
    return {"status": "success"}


@router.delete("/posts/{post_id}")
async def admin_delete_post(
    post_id: uuid.UUID,
    admin_user: Annotated[User, require_roles(*_MODERATORS)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
        )
    await db.delete(post)
    await db.commit()
    return {"status": "success"}


@router.delete("/comments/{comment_id}")
async def admin_delete_comment(
    comment_id: uuid.UUID,
    admin_user: Annotated[User, require_roles(*_MODERATORS)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )
    await db.delete(comment)
    await db.commit()
    return {"status": "success"}


# ---------------------------------------------------------------------------
# User management (admin / HR only)
# ---------------------------------------------------------------------------


@router.patch("/users/{user_id}/suspend")
async def suspend_user(
    user_id: uuid.UUID,
    admin_user: Annotated[User, require_roles(*_ADMINS)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cannot suspend an admin"
        )

    user.deleted_at = datetime.now(UTC)
    await db.commit()
    return {"status": "success"}


@router.get("/users", response_model=AdminUserListResponse)
async def list_admin_users(
    response: Response,
    admin_user: Annotated[User, require_roles(*_ADMINS)],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = Query(
        None, description="Search by display name (case-insensitive)"
    ),
    status_filter: str | None = Query(
        None, description="One of: active, banned, deleted"
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> AdminUserListResponse:
    """List / search users within the admin's organization."""
    response.headers["Cache-Control"] = "no-store"
    base_filters = [User.org_id == admin_user.org_id]

    if search:
        base_filters.append(User.display_name.ilike(f"%{search}%"))

    if status_filter == "banned":
        base_filters.append(User.is_banned.is_(True))
    elif status_filter == "deleted":
        base_filters.append(User.deleted_at.is_not(None))
    elif status_filter == "active":
        base_filters.append(User.deleted_at.is_(None))
        base_filters.append(User.is_banned.is_(False))

    count_result = await db.execute(select(func.count(User.id)).where(*base_filters))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(User)
        .where(*base_filters)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    users = result.scalars().all()

    return AdminUserListResponse(
        users=[AdminUserResponse.model_validate(u) for u in users],
        total=total,
    )


async def _get_org_user(user_id: uuid.UUID, admin_user: User, db: AsyncSession) -> User:
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == admin_user.org_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


@router.patch("/users/{user_id}/ban", response_model=AdminUserResponse)
async def ban_user(
    user_id: uuid.UUID,
    request: AdminBanUserRequest,
    admin_user: Annotated[User, require_roles(*_ADMINS)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUserResponse:
    user = await _get_org_user(user_id, admin_user, db)

    if user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot ban yourself",
        )
    if user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cannot ban an admin"
        )

    user.is_banned = True
    user.banned_at = datetime.now(UTC)
    user.ban_reason = request.reason
    await db.commit()
    await db.refresh(user)
    return AdminUserResponse.model_validate(user)


@router.patch("/users/{user_id}/unban", response_model=AdminUserResponse)
async def unban_user(
    user_id: uuid.UUID,
    admin_user: Annotated[User, require_roles(*_ADMINS)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUserResponse:
    user = await _get_org_user(user_id, admin_user, db)
    user.is_banned = False
    user.banned_at = None
    user.ban_reason = None
    await db.commit()
    await db.refresh(user)
    return AdminUserResponse.model_validate(user)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    admin_user: Annotated[User, require_roles(*_ADMINS)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """GDPR soft-delete: marks the account deleted and revokes access."""
    user = await _get_org_user(user_id, admin_user, db)

    if user.id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete yourself",
        )
    if user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete an admin"
        )

    user.deleted_at = datetime.now(UTC)
    user.is_banned = True
    await db.commit()
    return {"status": "success"}


# ---------------------------------------------------------------------------
# Analytics (admin / HR only)
# ---------------------------------------------------------------------------


def _fill_series(rows: list[tuple[object, int]], days: int) -> list[TimeSeriesPoint]:
    """Turn (date, count) rows into a dense, zero-filled daily series."""
    counts: dict[str, int] = {}
    for day, count in rows:
        key = day.isoformat()[:10] if hasattr(day, "isoformat") else str(day)[:10]
        counts[key] = int(count)

    today = datetime.now(UTC).date()
    series: list[TimeSeriesPoint] = []
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        series.append(TimeSeriesPoint(date=d, count=counts.get(d, 0)))
    return series


@router.get("/analytics", response_model=AdminAnalyticsResponse)
async def get_admin_analytics(
    admin_user: Annotated[User, require_roles(*_ADMINS)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(_DEFAULT_ANALYTICS_DAYS, ge=1, le=365),
) -> AdminAnalyticsResponse:
    window_start = datetime.now(UTC) - timedelta(days=days)

    # Scope all analytics to the admin's own organization (multi-tenant).
    org_id = admin_user.org_id
    org_user_ids = select(User.id).where(User.org_id == org_id).scalar_subquery()

    reg_rows = (
        await db.execute(
            select(
                cast(User.created_at, SADate).label("d"),
                func.count(User.id),
            )
            .where(User.org_id == org_id, User.created_at >= window_start)
            .group_by("d")
            .order_by("d")
        )
    ).all()
    daily_registrations = _fill_series(reg_rows, days)

    baseline_result = await db.execute(
        select(func.count(User.id)).where(
            User.org_id == org_id, User.created_at < window_start
        )
    )
    running = baseline_result.scalar() or 0
    community_growth: list[TimeSeriesPoint] = []
    for point in daily_registrations:
        running += point.count
        community_growth.append(TimeSeriesPoint(date=point.date, count=running))

    assess_rows = (
        await db.execute(
            select(
                cast(TestScore.created_at, SADate).label("d"),
                func.count(TestScore.id),
            )
            .where(
                TestScore.user_id.in_(org_user_ids),
                TestScore.created_at >= window_start,
            )
            .group_by("d")
            .order_by("d")
        )
    ).all()
    assessments_per_day = _fill_series(assess_rows, days)

    type_rows = (
        await db.execute(
            select(TestScore.test_id, func.count(TestScore.id))
            .where(TestScore.user_id.in_(org_user_ids))
            .group_by(TestScore.test_id)
        )
    ).all()
    assessment_by_type = {row[0]: int(row[1]) for row in type_rows}

    med_rows = (
        await db.execute(
            select(
                cast(MeditationHistory.completed_at, SADate).label("d"),
                func.coalesce(func.sum(MeditationHistory.duration_minutes), 0),
            )
            .where(
                MeditationHistory.user_id.in_(org_user_ids),
                MeditationHistory.completed_at >= window_start,
            )
            .group_by("d")
            .order_by("d")
        )
    ).all()
    meditation_minutes_per_day = _fill_series(med_rows, days)

    mood_rows = (
        await db.execute(
            select(MoodLog.mood_score, func.count(MoodLog.id))
            .where(MoodLog.org_id == org_id)
            .group_by(MoodLog.mood_score)
        )
    ).all()
    mood_tracking_stats = {str(row[0]): int(row[1]) for row in mood_rows}

    return AdminAnalyticsResponse(
        days=days,
        daily_registrations=daily_registrations,
        community_growth=community_growth,
        assessments_per_day=assessments_per_day,
        assessment_by_type=assessment_by_type,
        meditation_minutes_per_day=meditation_minutes_per_day,
        mood_tracking_stats=mood_tracking_stats,
    )
