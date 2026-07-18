from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.comment import Comment
from app.models.notification_event import NotificationCategory, NotificationEvent
from app.models.post import Post, PostCategory, PostLike, PostMood, PostTag
from app.models.report import ContentReport
from app.models.user import User
from app.schemas.forum import (
    CommentCreateRequest,
    CommentResponse,
    ContentReportCreateRequest,
    ContentReportResponse,
    PostCreateRequest,
    PostReportRequest,
    PostResponse,
)

router = APIRouter(prefix="/forum", tags=["forum"])


@router.get("/posts", response_model=dict[str, list[PostResponse] | str | None])
async def get_posts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    cursor: UUID | None = Query(None, description="Cursor for pagination (Post ID)"),
    limit: int = Query(20, ge=1, le=50),
    category: PostCategory | None = Query(None),
    search: str | None = Query(None, description="Search query"),
    sort: str = Query("recent", description="Sort by 'recent' or 'trending'"),
):
    query = (
        select(Post)
        .options(selectinload(Post.tags), selectinload(Post.moods))
    )

    if category:
        query = query.where(Post.category == category)

    if search:
        query = query.where(Post.content.ilike(f"%{search}%"))

    if cursor:
        cursor_post = await db.get(Post, cursor)
        if cursor_post:
            if sort == "trending":
                query = query.where(
                    or_(
                        Post.likes < cursor_post.likes,
                        (Post.likes == cursor_post.likes)
                        & (Post.created_at < cursor_post.created_at),
                    )
                )
            else:
                query = query.where(Post.created_at < cursor_post.created_at)

    if sort == "trending":
        query = query.order_by(desc(Post.likes), desc(Post.created_at)).limit(limit)
    else:
        query = query.order_by(desc(Post.created_at)).limit(limit)

    result = await db.execute(query)
    posts = result.scalars().all()

    # Hide author_id if is_anonymous is True
    response_posts = []
    for post in posts:
        is_mine = post.author_id == current_user.id
        if post.is_anonymous:
            post.author_id = None

        # Build PostResponse manually due to the lists
        resp = PostResponse.model_validate(post)
        resp.tags = [t.tag for t in post.tags]
        resp.moods = [m.mood for m in post.moods]
        resp.is_mine = is_mine
        response_posts.append(resp)

    next_cursor = str(posts[-1].id) if len(posts) == limit else None

    return {"posts": response_posts, "next_cursor": next_cursor}


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

    for tag in body.tags:
        post.tags.append(PostTag(tag=tag))

    for mood in body.moods:
        post.moods.append(PostMood(mood=mood))

    db.add(post)
    await db.commit()
    await db.refresh(post)
    # Eager load tags/moods for the response
    post = (
        await db.execute(
            select(Post)
            .options(selectinload(Post.tags), selectinload(Post.moods))
            .where(Post.id == post.id)
        )
    ).scalar_one()

    is_mine = post.author_id == current_user.id
    if post.is_anonymous:
        post.author_id = None

    resp = PostResponse.model_validate(post)
    resp.tags = [t.tag for t in post.tags]
    resp.moods = [m.mood for m in post.moods]
    resp.is_mine = is_mine
    return resp


@router.post("/posts/{post_id}/like")
async def toggle_post_like(
    post_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    post = await db.get(Post, post_id)
    if not post:
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


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.author_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You can only delete your own posts"
        )

    await db.delete(post)
    await db.commit()
    return {"status": "success"}


@router.get("/posts/{post_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    post_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    post = await db.get(Post, post_id)
    if not post:
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
    if not post:
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

    # Trigger notification for the post author if they are not anonymous and it's someone else commenting
    if post.author_id and post.author_id != current_user.id and not post.is_anonymous:
        notif = NotificationEvent(
            user_id=post.author_id,
            org_id=post.org_id,
            category=NotificationCategory.COMMUNITY_REPLY,
            title="New Reply",
            body_encrypted="Someone replied to your community post.",
        )
        db.add(notif)

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


@router.post("/posts/{post_id}/report", response_model=ContentReportResponse)
async def report_post_alias(
    post_id: UUID,
    body: PostReportRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    report = ContentReport(
        reporter_id=current_user.id,
        target_type="post",
        target_id=post_id,
        reason=body.reason,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report
