import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

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


class MeditationTrackCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    audio_url: str = Field(..., min_length=1, max_length=500)
    duration_minutes: int = Field(..., gt=0, le=600)
    category: MeditationCategory
    difficulty: MeditationDifficulty


class MeditationTrackUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)
    audio_url: str | None = Field(default=None, min_length=1, max_length=500)
    duration_minutes: int | None = Field(default=None, gt=0, le=600)
    category: MeditationCategory | None = None
    difficulty: MeditationDifficulty | None = None


class AudioUploadResponse(BaseModel):
    audio_url: str


# --- Meditation History (Progress) ---
class MeditationHistoryCreate(BaseModel):
    track_id: uuid.UUID
    duration_minutes: int = Field(..., gt=0, le=600)


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
    weekly_streak: int = 0
    longest_weekly_streak: int = 0
    last_meditated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


# --- Meditation Favorites ---
class MeditationFavoriteCreate(BaseModel):
    track_id: uuid.UUID


class MeditationFavoriteResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    track_id: uuid.UUID
    created_at: datetime
    track: MeditationTrackResponse

    model_config = ConfigDict(from_attributes=True)
