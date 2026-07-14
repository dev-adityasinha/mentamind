import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScreeningResultRequest(BaseModel):
    test_id: str
    score: int
    max_score: int
    severity: str | None = None
    answers: list[int] | None = None


class ScreeningResultResponse(BaseModel):
    id: uuid.UUID
    test_id: str
    score: int
    severity: str | None
    insights: str | None = None
    next_steps: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScreeningDetailResponse(BaseModel):
    id: uuid.UUID
    test_id: str
    score: int
    severity: str | None
    metadata_answers: dict | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
