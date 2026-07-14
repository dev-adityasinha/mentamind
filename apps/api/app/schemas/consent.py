import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class OnboardingCompleteRequest(BaseModel):
    consent_analytics: bool
    consent_ai_coaching: bool
    display_name: str | None = Field(None, min_length=1, max_length=255)


class ConsentUpdateRequest(BaseModel):
    consent_analytics: bool | None = None
    consent_ai_coaching: bool | None = None

    @model_validator(mode="after")
    def at_least_one(self) -> "ConsentUpdateRequest":
        if self.consent_analytics is None and self.consent_ai_coaching is None:
            raise ValueError("At least one consent field must be provided")
        return self


class ConsentRecordResponse(BaseModel):
    id: uuid.UUID
    consent_type: str
    action: str
    version: str
    granted_at: datetime

    model_config = {"from_attributes": True}
