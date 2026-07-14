from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CommentBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    is_anonymous: bool = Field(default=False)
    parent_id: UUID | None = None


class CommentCreateRequest(CommentBase):
    pass


class CommentResponse(CommentBase):
    id: UUID
    post_id: UUID
    author_id: UUID | None = None  # None if anonymous
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PostBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    category: str = Field(default="general")
    is_anonymous: bool = Field(default=False)


class PostCreateRequest(PostBase):
    pass


class PostResponse(PostBase):
    id: UUID
    author_id: UUID | None = None  # None if anonymous
    org_id: UUID
    likes: int
    reply_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContentReportCreateRequest(BaseModel):
    target_type: str = Field(..., pattern="^(post|comment)$")
    target_id: UUID
    reason: str = Field(..., min_length=1, max_length=1024)


class ContentReportResponse(BaseModel):
    id: UUID
    reporter_id: UUID
    target_type: str
    target_id: UUID
    reason: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
