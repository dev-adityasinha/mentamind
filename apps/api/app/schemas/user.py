import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.user import UserRole

# Usernames: 3-30 chars, letters/digits/underscore/hyphen, must start alnum.
USERNAME_PATTERN = r"^[a-zA-Z0-9][a-zA-Z0-9_-]{2,29}$"


class UserResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    display_name: str
    username: str | None = None
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
    username: str | None = None
    age: int | None = None
    gender: str | None = None
    country: str | None = None
    avatar_url: str | None = None
    mental_health_goals: list[str] = []

    model_config = {"from_attributes": True}


class UserProfileUpdateRequest(BaseModel):
    display_name: str | None = None
    username: str | None = Field(default=None, pattern=USERNAME_PATTERN)
    age: int | None = Field(default=None, ge=13, le=120)
    gender: str | None = None
    country: str | None = None
    avatar_url: str | None = None
    mental_health_goals: list[str] | None = None
