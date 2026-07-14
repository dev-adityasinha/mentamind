import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.chat import ChatSessionStatus


class ChatMessageBase(BaseModel):
    content: str


class ChatMessageResponse(ChatMessageBase):
    id: uuid.UUID
    session_id: uuid.UUID
    sender_id: uuid.UUID
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    participant_1_id: uuid.UUID
    participant_2_id: uuid.UUID | None
    status: ChatSessionStatus
    created_at: datetime
    ended_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class WebSocketMessage(BaseModel):
    type: str  # e.g. "message", "typing", "read", "end", "ping"
    content: str | None = None
    message_id: uuid.UUID | None = None
