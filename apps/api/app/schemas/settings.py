from pydantic import BaseModel, ConfigDict, Field

from app.models.user_settings import ThemeMode


class SettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    theme: ThemeMode
    reminder_time: str | None
    notifications_enabled: bool
    email_notifications: bool
    push_notifications: bool
    slack_notifications: bool
    teams_notifications: bool
    privacy_analytics: bool
    privacy_ai_coaching: bool
    privacy_community: bool
    audio_bg_volume: float
    audio_voice_volume: float
    language: str
    timezone: str


class SettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    theme: ThemeMode | None = None
    reminder_time: str | None = None
    notifications_enabled: bool | None = None
    email_notifications: bool | None = None
    push_notifications: bool | None = None
    slack_notifications: bool | None = None
    teams_notifications: bool | None = None
    privacy_analytics: bool | None = None
    privacy_ai_coaching: bool | None = None
    privacy_community: bool | None = None
    audio_bg_volume: float | None = Field(default=None, ge=0.0, le=1.0)
    audio_voice_volume: float | None = Field(default=None, ge=0.0, le=1.0)
    language: str | None = None
    timezone: str | None = None
