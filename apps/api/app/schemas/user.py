import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.user import UserRole


class UserResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    display_name: str
    role: UserRole
    consent_analytics: bool
    consent_ai_coaching: bool
    onboarding_completed_at: datetime | None = None
    created_at: datetime
    last_active_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    display_name: str
    age: int | None = None
    gender: str | None = None
    country: str | None = None
    avatar_url: str | None = None
    mental_health_goals: list[str] = []

    model_config = {"from_attributes": True}


class UserProfileUpdateRequest(BaseModel):
    display_name: str | None = None
    age: int | None = None
    gender: str | None = None
    country: str | None = None
    avatar_url: str | None = None
    mental_health_goals: list[str] | None = None
