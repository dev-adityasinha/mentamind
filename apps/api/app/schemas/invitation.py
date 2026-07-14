import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.user import UserRole


class InvitationCreateRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=320)
    role: UserRole = UserRole.EMPLOYEE


class InvitationCreateResponse(BaseModel):
    id: uuid.UUID
    email: str
    invited_role: UserRole
    status: str
    expires_at: datetime
    created_at: datetime
    token: str


class InvitationResponse(BaseModel):
    id: uuid.UUID
    email: str
    invited_role: UserRole
    status: str
    expires_at: datetime
    created_at: datetime


class InvitationPreviewRequest(BaseModel):
    token: str


class InvitationPreviewResponse(BaseModel):
    org_name: str


class InvitationAcceptRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1, max_length=255)
