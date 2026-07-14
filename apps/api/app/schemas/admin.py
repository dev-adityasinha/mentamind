from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AdminStatsResponse(BaseModel):
    total_users: int
    total_posts: int
    active_reports: int
    total_ai_sessions: int


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
