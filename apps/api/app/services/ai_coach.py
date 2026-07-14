from __future__ import annotations

import uuid
from datetime import UTC, datetime

from openai import AsyncOpenAI

from app.models.ai_coach import AiCoachMessage, AiCoachSession
from app.schemas.ai_coach import CoachMessageResponse
from app.services.encryption import decrypt
from app.settings import settings

SYSTEM_PROMPT = (
    "You are a warm, supportive mental wellness coach. "
    "Your role is to listen, ask thoughtful questions, "
    "and offer gentle evidence-based reflections.\n"
    "\n"
    "Guidelines:\n"
    "- Speak like a caring human, not a therapist or doctor. "
    "Be warm, conversational, and natural.\n"
    "- Never diagnose, prescribe, or claim to be a professional.\n"
    "- Keep responses concise — 2-5 sentences usually.\n"
    "- Ask follow-up questions to encourage reflection.\n"
    "- If someone expresses distress or crisis, "
    "encourage them to reach out to a crisis line or professional.\n"
    "- Never be robotic, formal, or clinical. "
    'Use casual warmth — "I hear you", "That sounds really tough", '
    '"How are you feeling about that?"\n'
    "- Don't overuse emojis or exclamation marks. "
    "Be calm and grounded.\n"
    "- If you don't know something, say so. Never make things up.\n"
    "- Always prioritize the user's safety and well-being."
)


async def generate_coach_response(
    session: AiCoachSession,
    user_id: uuid.UUID,
    user_message_content: str,
    db_messages: list[AiCoachMessage],
) -> CoachMessageResponse:
    if not settings.groq_api_key:
        return CoachMessageResponse(
            id=uuid.uuid4(),
            session_id=session.id,
            role="assistant",
            content="Hello! I'm your AI coach. I'm here to listen and support you. "
            "How are you feeling today?",
            sentiment_score=None,
            emotion_tags=[],
            created_at=datetime.now(UTC),
        )

    client = AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url=settings.groq_base_url,
    )

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    for db_msg in db_messages:
        if db_msg.role == "user":
            try:
                content = decrypt(
                    db_msg.content_encrypted,
                    associated_data=user_id.bytes,
                )
            except Exception:
                content = "[decryption error]"
        elif db_msg.role == "assistant" and db_msg.content_encrypted:
            try:
                content = decrypt(
                    db_msg.content_encrypted,
                    associated_data=user_id.bytes,
                )
            except Exception:
                continue
        else:
            continue
        messages.append({"role": db_msg.role, "content": content})

    messages.append({"role": "user", "content": user_message_content})

    response = await client.chat.completions.create(
        model=settings.groq_model,
        messages=messages,
        max_tokens=500,
        temperature=0.7,
    )

    ai_text = (
        response.choices[0].message.content or "I'm here for you. What's on your mind?"
    )

    return CoachMessageResponse(
        id=uuid.uuid4(),
        session_id=session.id,
        role="assistant",
        content=ai_text,
        sentiment_score=None,
        emotion_tags=[],
        created_at=datetime.now(UTC),
    )
