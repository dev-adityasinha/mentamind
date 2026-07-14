import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.mood_log import InputMethod


class MoodCreateRequest(BaseModel):
    mood_score: int = Field(..., ge=1, le=5)
    emotion_tags: list[str] = Field(default_factory=list, max_length=15)
    context_tag: str | None = Field(default=None, max_length=50)
    note: str | None = Field(default=None, max_length=1000)
    input_method: InputMethod = Field(default=InputMethod.TAP)

    model_config = ConfigDict(extra="forbid")


class MoodResponse(BaseModel):
    id: uuid.UUID
    mood_score: int
    emotion_tags: list[str]
    context_tag: str | None
    note: str | None
    input_method: InputMethod
    logged_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
