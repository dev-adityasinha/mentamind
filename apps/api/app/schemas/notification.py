import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: uuid.UUID
    category: str
    title: str
    body: str  # decrypted by the router before serialisation
    is_read: bool
    created_at: datetime
    read_at: datetime | None = None

    model_config = {"from_attributes": False}


class NotificationListParams(BaseModel):
    unread_only: bool = False
    limit: int = Field(default=20, ge=1, le=100)
