import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CoachSessionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    meta: dict = Field(default_factory=dict)


class CoachMessageSendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(..., min_length=1)


class CoachMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str | None
    sentiment_score: float | None
    emotion_tags: list[str]
    created_at: datetime


class CoachSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    started_at: datetime
    ended_at: datetime | None
    message_count: int
    crisis_detected: bool
    crisis_type: str | None
    escalated: bool
    summary: str | None
    meta: dict
