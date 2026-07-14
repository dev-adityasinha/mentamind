import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import forbid_anonymous
from app.models.ai_coach import AiCoachMessage, AiCoachSession
from app.models.user import User
from app.schemas.ai_coach import (
    CoachMessageResponse,
    CoachMessageSendRequest,
    CoachSessionCreateRequest,
    CoachSessionResponse,
)
from app.services.ai_coach import generate_coach_response
from app.services.encryption import decrypt, encrypt

router = APIRouter(prefix="/ai-coach", tags=["ai-coach"])


@router.post(
    "/sessions",
    response_model=CoachSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_coach_session(
    request: CoachSessionCreateRequest,
    current_user: Annotated[User, forbid_anonymous()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachSessionResponse:
    session = AiCoachSession(
        user_id=current_user.id,
        meta=request.meta,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions", response_model=list[CoachSessionResponse])
async def list_coach_sessions(
    current_user: Annotated[User, forbid_anonymous()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CoachSessionResponse]:
    result = await db.execute(
        select(AiCoachSession)
        .where(AiCoachSession.user_id == current_user.id)
        .order_by(AiCoachSession.started_at.desc())
    )
    return list(result.scalars().all())


@router.get("/sessions/{session_id}", response_model=CoachSessionResponse)
async def get_coach_session(
    session_id: uuid.UUID,
    current_user: Annotated[User, forbid_anonymous()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachSessionResponse:
    result = await db.execute(
        select(AiCoachSession).where(
            AiCoachSession.id == session_id,
            AiCoachSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return session


@router.post(
    "/sessions/{session_id}/messages",
    response_model=CoachMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_coach_message(
    session_id: uuid.UUID,
    request: CoachMessageSendRequest,
    current_user: Annotated[User, forbid_anonymous()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachMessageResponse:
    result = await db.execute(
        select(AiCoachSession).where(
            AiCoachSession.id == session_id,
            AiCoachSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session.ended_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session already ended")

    content_encrypted = encrypt(request.content, current_user.id.bytes)

    user_msg = AiCoachMessage(
        session_id=session.id,
        role="user",
        content_encrypted=content_encrypted,
        content_nonce=content_encrypted[:32],
    )
    db.add(user_msg)
    session.message_count += 1
    await db.commit()
    await db.refresh(user_msg)

    prev_result = await db.execute(
        select(AiCoachMessage)
        .where(AiCoachMessage.session_id == session_id)
        .order_by(AiCoachMessage.created_at)
    )
    prev_messages: list[AiCoachMessage] = list(prev_result.scalars().all())

    ai_response = await generate_coach_response(
        session=session,
        user_id=current_user.id,
        user_message_content=request.content,
        db_messages=prev_messages[:-1],
    )

    ai_content_encrypted = encrypt(ai_response.content or "", current_user.id.bytes)
    ai_msg = AiCoachMessage(
        session_id=session.id,
        role="assistant",
        content_encrypted=ai_content_encrypted,
        content_nonce=ai_content_encrypted[:32],
    )
    db.add(ai_msg)
    session.message_count += 1
    await db.commit()
    await db.refresh(ai_msg)

    return CoachMessageResponse(
        id=ai_msg.id,
        session_id=ai_msg.session_id,
        role="assistant",
        content=ai_response.content,
        sentiment_score=None,
        emotion_tags=[],
        created_at=ai_msg.created_at,
    )


@router.post("/sessions/{session_id}/end", response_model=CoachSessionResponse)
async def end_coach_session(
    session_id: uuid.UUID,
    current_user: Annotated[User, forbid_anonymous()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CoachSessionResponse:
    result = await db.execute(
        select(AiCoachSession).where(
            AiCoachSession.id == session_id,
            AiCoachSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session.ended_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session already ended")

    session.ended_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(session)
    return session


@router.get(
    "/sessions/{session_id}/messages", response_model=list[CoachMessageResponse]
)
async def get_coach_messages(
    session_id: uuid.UUID,
    current_user: Annotated[User, forbid_anonymous()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CoachMessageResponse]:
    result = await db.execute(
        select(AiCoachSession).where(
            AiCoachSession.id == session_id,
            AiCoachSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    messages = await db.execute(
        select(AiCoachMessage)
        .where(AiCoachMessage.session_id == session_id)
        .order_by(AiCoachMessage.created_at)
    )
    rows: list[AiCoachMessage] = list(messages.scalars().all())
    result_list: list[CoachMessageResponse] = []
    for row in rows:
        content = None
        if row.content_encrypted:
            try:
                content = decrypt(row.content_encrypted, current_user.id.bytes)
            except Exception:
                content = None
        result_list.append(
            CoachMessageResponse(
                id=row.id,
                session_id=row.session_id,
                role=row.role,
                content=content,
                sentiment_score=row.sentiment_score,
                emotion_tags=row.emotion_tags,
                created_at=row.created_at,
            )
        )
    return result_list


@router.post("/chat", response_model=CoachMessageResponse)
async def ai_coach_chat(
    current_user: Annotated[User, forbid_anonymous()],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    latest_session_result = await db.execute(
        select(AiCoachSession)
        .where(
            AiCoachSession.user_id == current_user.id,
            AiCoachSession.ended_at.is_(None),
        )
        .order_by(AiCoachSession.started_at.desc())
        .limit(1)
    )
    session = latest_session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No active session found",
        )

    msg = CoachMessageResponse(
        id=uuid.uuid4(),
        session_id=session.id,
        role="assistant",
        content="Hello! I'm your AI coach. I'm here to listen and support you. "
        "How are you feeling today?",
        sentiment_score=None,
        emotion_tags=[],
        created_at=datetime.now(UTC),
    )
    return msg
