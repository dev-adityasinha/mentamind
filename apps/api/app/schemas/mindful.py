from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Curriculum content
# ---------------------------------------------------------------------------
class CurriculumBlockResponse(BaseModel):
    block: int
    name: str
    focus: str
    meditation_focus: str
    reflection_focus: str
    task_focus: str
    color: str

    model_config = ConfigDict(from_attributes=True)


class CurriculumDayResponse(BaseModel):
    day: int
    block: int
    title: str
    subtitle: str
    theme: str
    mood_question: str
    meditation: dict
    reflection: dict
    task: dict

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Daily completions
# ---------------------------------------------------------------------------
class DailyCompletionResponse(BaseModel):
    day: int
    completion_date: date
    meditation: bool
    meditation_duration: int | None = None
    task: bool
    reflection: bool

    model_config = ConfigDict(from_attributes=True)


class DailyCompletionUpdate(BaseModel):
    """Mark one or more parts of a day complete. Only provided flags change."""

    model_config = ConfigDict(extra="forbid")

    day: int = Field(..., ge=1, le=30)
    meditation: bool | None = None
    meditation_duration: int | None = Field(default=None, ge=0, le=600)
    task: bool | None = None
    reflection: bool | None = None


# ---------------------------------------------------------------------------
# Journey / progress state
# ---------------------------------------------------------------------------
class JourneyBlockProgress(BaseModel):
    block: int
    name: str
    total_days: int
    completed_days: int


class JourneyResponse(BaseModel):
    current_day: int
    total_days: int
    streak: int
    completed_days: int
    blocks: list[JourneyBlockProgress]
    last_completed_at: datetime | None = None


# ---------------------------------------------------------------------------
# Aggregate stats (dashboard)
# ---------------------------------------------------------------------------
class MindfulStatsResponse(BaseModel):
    total_minutes: int
    total_sessions: int
    current_streak: int
    completed_days: int
    current_day: int
    total_days: int
