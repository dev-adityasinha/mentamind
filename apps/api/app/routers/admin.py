import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models.ai_coach import AiCoachSession
from app.models.comment import Comment
from app.models.post import Post
from app.models.report import ContentReport
from app.models.test_score import TestScore
from app.models.meditation import MeditationHistory
from app.models.user import User, UserRole
from app.models.mood_log import MoodLog
from app.schemas.admin import (
    AdminReportResponse,
    AdminReportStatusUpdateRequest,
    AdminStatsResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/ping")
async def admin_ping(
    user: Annotated[User, require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)],
) -> dict:
    return {"pong": True, "user_id": str(user.id)}


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    admin_user: Annotated[User, require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminStatsResponse:
    # Get total active users
    users_result = await db.execute(
        select(func.count(User.id)).where(User.deleted_at.is_(None))
    )
    total_users = users_result.scalar() or 0

    # Get total posts
    posts_result = await db.execute(select(func.count(Post.id)))
    total_posts = posts_result.scalar() or 0

    # Get active (pending) reports
    reports_result = await db.execute(
        select(func.count(ContentReport.id)).where(ContentReport.status == "pending")
    )
    active_reports = reports_result.scalar() or 0

    # Get total AI sessions
    ai_sessions_result = await db.execute(select(func.count(AiCoachSession.id)))
    total_ai_sessions = ai_sessions_result.scalar() or 0

    # Get total assessments
    assessments_result = await db.execute(select(func.count(TestScore.id)))
    total_assessments = assessments_result.scalar() or 0

    # Get total meditation minutes
    meditation_result = await db.execute(select(func.sum(MeditationHistory.duration_minutes)))
    total_meditation_minutes = meditation_result.scalar() or 0

    # Get daily registrations
    start_of_day = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    daily_reg_result = await db.execute(
        select(func.count(User.id)).where(User.created_at >= start_of_day)
    )
    daily_registrations = daily_reg_result.scalar() or 0

    # Get mood tracking stats (count of logs per primary mood)
    mood_result = await db.execute(
        select(MoodLog.primary_mood, func.count(MoodLog.id)).group_by(MoodLog.primary_mood)
    )
    mood_tracking_stats = {row[0]: row[1] for row in mood_result.all()}

    return AdminStatsResponse(
        total_users=total_users,
        total_posts=total_posts,
        active_reports=active_reports,
        total_ai_sessions=total_ai_sessions,
        total_assessments=total_assessments,
        total_meditation_minutes=total_meditation_minutes,
        daily_registrations=daily_registrations,
        mood_tracking_stats=mood_tracking_stats,
    )


@router.get("/reports", response_model=list[AdminReportResponse])
async def list_reports(
    admin_user: Annotated[User, require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AdminReportResponse]:
    query = select(ContentReport).order_by(ContentReport.created_at.desc())
    if status_filter:
        query = query.where(ContentReport.status == status_filter)

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    reports = result.scalars().all()

    response_list = []
    for report in reports:
        enriched_report = AdminReportResponse.model_validate(report)

        # Fetch reporter name
        reporter_result = await db.execute(
            select(User).where(User.id == report.reporter_id)
        )
        reporter = reporter_result.scalar_one_or_none()
        if reporter:
            enriched_report.reporter_name = reporter.display_name

        # Fetch target content
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

        # Fetch target author name if exists
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
    admin_user: Annotated[User, require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)],
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
    admin_user: Annotated[User, require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)],
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
    admin_user: Annotated[User, require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)],
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


@router.patch("/users/{user_id}/suspend")
async def suspend_user(
    user_id: uuid.UUID,
    admin_user: Annotated[User, require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)],
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
