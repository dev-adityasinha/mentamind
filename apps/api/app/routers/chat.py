import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from jose import JWTError
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.chat import ChatSession, ChatSessionStatus
from app.models.message import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatMessageResponse, ChatSessionResponse
from app.services.auth_service import decode_access_token
from app.services.chat_manager import chat_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


async def get_ws_user(
    token: str = Query(...), db: AsyncSession = Depends(get_db)
) -> User:
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload.get("sub") or "")
        org_id = uuid.UUID(payload.get("org_id") or "")
    except (JWTError, ValueError):
        # We don't raise HTTPException here because FastAPI handles WS exceptions
        # differently, but modern FastAPI handles HTTPException gracefully by
        # closing WS with a specific code.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == org_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user


@router.websocket("/ws")
async def chat_websocket(
    websocket: WebSocket,
    user: Annotated[User, Depends(get_ws_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await chat_manager.connect(user.id, websocket)

    # Try matchmaking right away
    session = await chat_manager.find_partner(user.id, db)
    if session:
        # Match found! Broadcast to both
        payload = {"type": "matched", "session_id": str(session.id)}
        await chat_manager.send_personal_message(session.participant_1_id, payload)
        
        # Also need to send it to the local user directly because they JUST connected
        # and redis pubsub might have a tiny delay or they are the one triggering
        # the match.
        # It's fine to just send via WS
        if session.participant_2_id == user.id:
            await websocket.send_json(payload)
        else:
            await chat_manager.send_personal_message(session.participant_2_id, payload)
    else:
        # Added to queue
        await websocket.send_json({"type": "waiting"})

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "message":
                session_id = uuid.UUID(data.get("session_id"))
                content = data.get("content")

                res = await db.execute(
                    select(ChatSession).where(ChatSession.id == session_id)
                )
                sess = res.scalar_one_or_none()

                if sess and sess.status == ChatSessionStatus.ACTIVE:
                    new_msg = ChatMessage(
                        session_id=session_id, sender_id=user.id, content=content
                    )
                    db.add(new_msg)
                    await db.commit()
                    await db.refresh(new_msg)

                    target_id = (
                        sess.participant_2_id
                        if sess.participant_1_id == user.id
                        else sess.participant_1_id
                    )

                    payload = {
                        "type": "message",
                        "session_id": str(session_id),
                        "message": {
                            "id": str(new_msg.id),
                            "sender_id": str(user.id),
                            "content": content,
                            "created_at": new_msg.created_at.isoformat(),
                        },
                    }
                    if target_id:
                        await chat_manager.send_personal_message(target_id, payload)

            elif msg_type == "typing":
                session_id = uuid.UUID(data.get("session_id"))
                res = await db.execute(
                    select(ChatSession).where(ChatSession.id == session_id)
                )
                sess = res.scalar_one_or_none()
                if sess and sess.status == ChatSessionStatus.ACTIVE:
                    target_id = (
                        sess.participant_2_id
                        if sess.participant_1_id == user.id
                        else sess.participant_1_id
                    )
                    if target_id:
                        await chat_manager.send_personal_message(
                            target_id, {"type": "typing", "session_id": str(session_id)}
                        )

            elif msg_type == "read":
                msg_id = uuid.UUID(data.get("message_id"))
                session_id = uuid.UUID(data.get("session_id"))
                
                res = await db.execute(
                    select(ChatMessage).where(ChatMessage.id == msg_id)
                )
                chat_msg = res.scalar_one_or_none()
                
                if chat_msg and chat_msg.sender_id != user.id:
                    chat_msg.is_read = True
                    await db.commit()

                    res_sess = await db.execute(
                        select(ChatSession).where(ChatSession.id == session_id)
                    )
                    sess = res_sess.scalar_one_or_none()
                    if sess:
                        target_id = (
                            sess.participant_2_id
                            if sess.participant_1_id == user.id
                            else sess.participant_1_id
                        )
                        if target_id:
                            await chat_manager.send_personal_message(
                                target_id,
                                {
                                    "type": "read",
                                    "message_id": str(msg_id),
                                    "session_id": str(session_id),
                                },
                            )

            elif msg_type == "end":
                session_id = uuid.UUID(data.get("session_id"))
                res = await db.execute(
                    select(ChatSession).where(ChatSession.id == session_id)
                )
                sess = res.scalar_one_or_none()
                if sess and sess.status == ChatSessionStatus.ACTIVE:
                    sess.status = ChatSessionStatus.ENDED
                    sess.ended_at = datetime.now(UTC)
                    await db.commit()
                    
                    target_id = (
                        sess.participant_2_id
                        if sess.participant_1_id == user.id
                        else sess.participant_1_id
                    )
                    if target_id:
                        await chat_manager.send_personal_message(
                            target_id, {"type": "end", "session_id": str(session_id)}
                        )

    except WebSocketDisconnect:
        chat_manager.disconnect(user.id)
    except Exception as e:
        logger.error(f"WS error: {e}")
        chat_manager.disconnect(user.id)


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    res = await db.execute(
        select(ChatSession)
        .where(
            or_(
                ChatSession.participant_1_id == user.id,
                ChatSession.participant_2_id == user.id,
            )
        )
        .order_by(ChatSession.created_at.desc())
    )
    return res.scalars().all()


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def get_messages(
    session_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
    before: datetime | None = None,
):
    res_sess = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    sess = res_sess.scalar_one_or_none()

    if not sess or (
        sess.participant_1_id != user.id and sess.participant_2_id != user.id
    ):
        raise HTTPException(status_code=403, detail="Forbidden")

    query = select(ChatMessage).where(ChatMessage.session_id == session_id)
    if before:
        query = query.where(ChatMessage.created_at < before)

    query = query.order_by(ChatMessage.created_at.desc()).limit(limit)
    res = await db.execute(query)

    messages = list(res.scalars().all())
    messages.reverse()
    return messages
