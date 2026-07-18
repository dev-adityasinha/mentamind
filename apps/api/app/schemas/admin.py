from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole


class AdminStatsResponse(BaseModel):
    total_users: int
    total_posts: int
    active_reports: int
    total_ai_sessions: int
    total_assessments: int = 0
    total_meditation_minutes: int = 0
    daily_registrations: int = 0
    # Users active within the analytics window (default 30 days).
    active_users: int = 0
    banned_users: int = 0
    total_comments: int = 0
    mood_tracking_stats: dict[str, int] = {}


class TimeSeriesPoint(BaseModel):
    """A single day in an analytics time series (YYYY-MM-DD -> count)."""

    date: str
    count: int


class AdminAnalyticsResponse(BaseModel):
    """Time-series analytics for the admin dashboard charts."""

    days: int
    daily_registrations: list[TimeSeriesPoint] = []
    community_growth: list[TimeSeriesPoint] = []
    assessments_per_day: list[TimeSeriesPoint] = []
    assessment_by_type: dict[str, int] = {}
    meditation_minutes_per_day: list[TimeSeriesPoint] = []
    mood_tracking_stats: dict[str, int] = {}


class AdminUserResponse(BaseModel):
    id: UUID
    display_name: str
    role: UserRole
    is_banned: bool = False
    banned_at: datetime | None = None
    ban_reason: str | None = None
    is_verified: bool = False
    onboarding_completed_at: datetime | None = None
    created_at: datetime
    last_active_at: datetime | None = None
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminUserListResponse(BaseModel):
    users: list[AdminUserResponse]
    total: int


class AdminBanUserRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=512)


class AdminReportResponse(BaseModel):
    id: UUID
    reporter_id: UUID
    target_type: str
    target_id: UUID
    reason: str
    status: str
    created_at: datetime

    # Enrichment fields for the dashboard
    target_content: str | None = None
    target_author_id: UUID | None = None
    target_author_name: str | None = None
    reporter_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminReportStatusUpdateRequest(BaseModel):
    status: str  # "resolved" or "dismissed"
