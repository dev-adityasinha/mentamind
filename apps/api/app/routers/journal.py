import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.journal import JournalEntry
from app.models.user import User
from app.schemas.journal import (
    JournalCreateRequest,
    JournalResponse,
    JournalUpdateRequest,
)
from app.services.encryption import encrypt

router = APIRouter(prefix="/journal", tags=["journal"])


@router.post("", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    request: JournalCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JournalResponse:
    content_encrypted = encrypt(request.content, current_user.id.bytes)
    emotion_tags = request.emotion_tags or []

    entry = JournalEntry(
        user_id=current_user.id,
        entry_type=request.entry_type,
        content_encrypted=content_encrypted,
        content_nonce=content_encrypted[:32],
        prompt=request.prompt,
        mood_score=request.mood_score,
        emotion_tags=emotion_tags,
        word_count=len(request.content.split()),
        duration_seconds=request.duration_seconds,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.get("", response_model=list[JournalResponse])
async def list_journal_entries(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 30,
) -> list[JournalResponse]:
    cutoff = datetime.now(UTC) - timedelta(days=days)
    result = await db.execute(
        select(JournalEntry)
        .where(
            JournalEntry.user_id == current_user.id,
            JournalEntry.created_at >= cutoff,
        )
        .order_by(JournalEntry.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{entry_id}", response_model=JournalResponse)
async def get_journal_entry(
    entry_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JournalResponse:
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.id == entry_id,
            JournalEntry.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Journal entry not found")
    return entry


@router.patch("/{entry_id}", response_model=JournalResponse)
async def update_journal_entry(
    entry_id: uuid.UUID,
    request: JournalUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JournalResponse:
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.id == entry_id,
            JournalEntry.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Journal entry not found")

    if request.content is not None:
        entry.content_encrypted = encrypt(request.content, current_user.id.bytes)
        entry.content_nonce = entry.content_encrypted[:32]
        entry.word_count = len(request.content.split())
    if request.prompt is not None:
        entry.prompt = request.prompt
    if request.mood_score is not None:
        entry.mood_score = request.mood_score
    if request.emotion_tags is not None:
        entry.emotion_tags = request.emotion_tags
    entry.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal_entry(
    entry_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.id == entry_id,
            JournalEntry.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Journal entry not found")

    await db.delete(entry)
    await db.commit()
