from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.comment import Comment
from app.models.post import Post, PostLike
from app.models.report import ContentReport
from app.models.user import User
from app.schemas.forum import (
    CommentCreateRequest,
    CommentResponse,
    ContentReportCreateRequest,
    ContentReportResponse,
    PostCreateRequest,
    PostResponse,
)

router = APIRouter(prefix="/forum", tags=["forum"])


@router.get("/posts", response_model=dict[str, list[PostResponse] | str | None])
async def get_posts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    cursor: UUID | None = Query(None, description="Cursor for pagination (Post ID)"),
    limit: int = Query(20, ge=1, le=50),
    category: str | None = Query(None),
):
    query = select(Post).where(Post.org_id == current_user.org_id)

    if category:
        query = query.where(Post.category == category)

    if cursor:
        cursor_post = await db.get(Post, cursor)
        if cursor_post:
            query = query.where(Post.created_at < cursor_post.created_at)

    query = query.order_by(desc(Post.created_at)).limit(limit)
    result = await db.execute(query)
    posts = result.scalars().all()

    # Hide author_id if is_anonymous is True
    for post in posts:
        if post.is_anonymous:
            post.author_id = None

    next_cursor = str(posts[-1].id) if len(posts) == limit else None

    return {"posts": posts, "next_cursor": next_cursor}


@router.post("/posts", response_model=PostResponse)
async def create_post(
    body: PostCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    post = Post(
        content=body.content,
        author_id=current_user.id,
        org_id=current_user.org_id,
        category=body.category,
        is_anonymous=body.is_anonymous,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)

    if post.is_anonymous:
        post.author_id = None

    return post


@router.post("/posts/{post_id}/like")
async def toggle_post_like(
    post_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    post = await db.get(Post, post_id)
    if not post or post.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = await db.execute(
        select(PostLike).where(
            PostLike.post_id == post_id, PostLike.user_id == current_user.id
        )
    )
    existing_like = existing.scalar_one_or_none()

    if existing_like:
        await db.delete(existing_like)
        post.likes -= 1
        await db.commit()
        return {"status": "unliked", "likes": post.likes}
    else:
        new_like = PostLike(post_id=post_id, user_id=current_user.id)
        db.add(new_like)
        post.likes += 1
        await db.commit()
        return {"status": "liked", "likes": post.likes}


@router.get("/posts/{post_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    post_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    post = await db.get(Post, post_id)
    if not post or post.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Post not found")

    result = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()

    for comment in comments:
        if comment.is_anonymous:
            comment.author_id = None

    return comments


@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(
    post_id: UUID,
    body: CommentCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    post = await db.get(Post, post_id)
    if not post or post.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Post not found")

    if body.parent_id:
        parent = await db.get(Comment, body.parent_id)
        if not parent or parent.post_id != post_id:
            raise HTTPException(status_code=400, detail="Invalid parent comment")

    comment = Comment(
        content=body.content,
        post_id=post_id,
        author_id=current_user.id,
        parent_id=body.parent_id,
        is_anonymous=body.is_anonymous,
    )
    db.add(comment)
    post.reply_count += 1
    await db.commit()
    await db.refresh(comment)

    if comment.is_anonymous:
        comment.author_id = None

    return comment


@router.post("/reports", response_model=ContentReportResponse)
async def report_content(
    body: ContentReportCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    report = ContentReport(
        reporter_id=current_user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        reason=body.reason,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report
