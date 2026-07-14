import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.wellness_score import BurnoutRiskLevel


class WellnessScoreResponse(BaseModel):
    id: uuid.UUID
    score_date: date
    composite_score: int | None
    mood_component: int | None
    sleep_component: int | None
    stress_component: int | None
    energy_component: int | None
    activity_component: int | None
    journaling_component: int | None
    burnout_risk_score: int | None
    burnout_risk_level: BurnoutRiskLevel | None

    model_config = ConfigDict(from_attributes=True)
