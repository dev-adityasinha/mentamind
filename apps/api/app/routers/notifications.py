import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.consent import require_onboarding_complete
from app.models.notification_event import NotificationEvent
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.services.encryption import decrypt

router = APIRouter(tags=["notifications"])


def _decrypt_event(event: NotificationEvent) -> NotificationResponse:
    body = decrypt(event.body_encrypted, associated_data=str(event.user_id).encode())
    return NotificationResponse(
        id=event.id,
        category=event.category.value,
        title=event.title,
        body=body,
        is_read=event.is_read,
        created_at=event.created_at,
        read_at=event.read_at,
    )


@router.get("/me/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: Annotated[User, require_onboarding_complete()],
    db: Annotated[AsyncSession, Depends(get_db)],
    unread_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[NotificationResponse]:
    stmt = (
        select(NotificationEvent)
        .where(
            NotificationEvent.user_id == current_user.id,
            NotificationEvent.org_id == current_user.org_id,
        )
        .order_by(NotificationEvent.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(NotificationEvent.is_read == False)  # noqa: E712

    result = await db.execute(stmt)
    events = list(result.scalars().all())
    return [_decrypt_event(e) for e in events]


@router.post(
    "/me/notifications/{notification_id}/read",
    response_model=NotificationResponse,
)
async def mark_notification_read(
    notification_id: str,
    current_user: Annotated[User, require_onboarding_complete()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> NotificationResponse:
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    result = await db.execute(
        select(NotificationEvent).where(
            NotificationEvent.id == nid,
            NotificationEvent.user_id == current_user.id,
            NotificationEvent.org_id == current_user.org_id,
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    if not event.is_read:
        event.is_read = True
        event.read_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(event)

    return _decrypt_event(event)
