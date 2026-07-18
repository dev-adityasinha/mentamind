import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.mood_log import InputMethod


class MoodCreateRequest(BaseModel):
    mood_score: int = Field(..., ge=1, le=5)
    energy_score: int | None = Field(default=None, ge=1, le=5)
    stress_score: int | None = Field(default=None, ge=1, le=5)
    emotion_tags: list[str] = Field(default_factory=list, max_length=15)
    context_tag: str | None = Field(default=None, max_length=50)
    note: str | None = Field(default=None, max_length=1000)
    input_method: InputMethod = Field(default=InputMethod.TAP)

    model_config = ConfigDict(extra="forbid")


class MoodResponse(BaseModel):
    id: uuid.UUID
    mood_score: int
    energy_score: int | None
    stress_score: int | None
    emotion_tags: list[str]
    context_tag: str | None
    note: str | None
    input_method: InputMethod
    logged_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MoodAnalyticsBucket(BaseModel):
    """One period (week or month) of aggregated mood data."""

    period: str  # e.g. "2026-W29" for a week, or "2026-07" for a month
    period_start: str  # ISO date of the first day in the period
    entries: int
    avg_mood: float | None
    avg_energy: float | None
    avg_stress: float | None


class EmotionCount(BaseModel):
    emotion: str
    count: int


class MoodAnalyticsResponse(BaseModel):
    period: str  # "weekly" or "monthly"
    range_days: int
    total_entries: int
    avg_mood: float | None
    avg_energy: float | None
    avg_stress: float | None
    buckets: list[MoodAnalyticsBucket]
    top_emotions: list[EmotionCount]
