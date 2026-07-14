import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.meditation import MeditationCategory, MeditationDifficulty


# --- Meditation Tracks ---
class MeditationTrackResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    audio_url: str
    duration_minutes: int
    category: MeditationCategory
    difficulty: MeditationDifficulty
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Meditation History (Progress) ---
class MeditationHistoryCreate(BaseModel):
    track_id: uuid.UUID
    duration_minutes: int


class MeditationHistoryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    track_id: uuid.UUID
    duration_minutes: int
    completed_at: datetime
    track: MeditationTrackResponse

    model_config = ConfigDict(from_attributes=True)


# --- Meditation Stats (Aggregated) ---
class MeditationStatsResponse(BaseModel):
    user_id: uuid.UUID
    total_minutes: int
    total_sessions: int
    current_streak: int
    longest_streak: int
    last_meditated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
