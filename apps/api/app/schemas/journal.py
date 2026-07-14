import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.journal import JournalEntryType


class JournalCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entry_type: JournalEntryType = JournalEntryType.TEXT
    content: str = Field(..., min_length=1)
    prompt: str | None = None
    mood_score: int | None = Field(default=None, ge=1, le=5)
    emotion_tags: list[str] = Field(default_factory=list, max_length=15)
    duration_seconds: int | None = None


class JournalUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str | None = Field(default=None, min_length=1)
    prompt: str | None = None
    mood_score: int | None = Field(default=None, ge=1, le=5)
    emotion_tags: list[str] | None = Field(default=None, max_length=15)


class JournalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entry_type: JournalEntryType
    mood_score: int | None
    emotion_tags: list[str]
    word_count: int
    duration_seconds: int | None
    created_at: datetime
    updated_at: datetime
