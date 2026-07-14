from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.post import Post
from app.models.user import User

router = APIRouter(prefix="/forum", tags=["forum"])


@router.get("/posts")
async def get_posts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Post)
        .where(Post.org_id == current_user.org_id)
        .order_by(Post.created_at.desc())
    )
    posts = result.scalars().all()
    return {"posts": [{"id": str(p.id), "content": p.content} for p in posts]}


class PostCreateRequest(BaseModel):
    content: str = Field(..., min_length=1)


@router.post("/posts")
async def create_post(
    body: PostCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    post = Post(
        content=body.content,
        author_id=current_user.id,
        org_id=current_user.org_id,
    )
    db.add(post)
    await db.commit()
    return {"id": str(post.id), "content": post.content}
