from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_coach import AiCoachMessage, AiCoachSession
from app.models.meditation import MeditationTrack
from app.models.mood_log import MoodLog
from app.models.test_score import TestScore
from app.schemas.ai_coach import CoachMessageResponse
from app.services.ai_providers.factory import get_ai_provider
from app.services.encryption import decrypt

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
    db: AsyncSession | None = None,
) -> CoachMessageResponse:
    provider = get_ai_provider()

    # Context injection
    context_str = ""
    if db:
        mood_res = await db.execute(
            select(MoodLog)
            .where(MoodLog.user_id == user_id)
            .order_by(MoodLog.logged_at.desc())
            .limit(1)
        )
        latest_mood = mood_res.scalar_one_or_none()
        if latest_mood:
            context_str += f"\nUser's latest mood is: {latest_mood.score}/10, energy: {latest_mood.energy_score}/10, stress: {latest_mood.stress_score}/10."

        test_res = await db.execute(
            select(TestScore)
            .where(TestScore.user_id == user_id)
            .order_by(TestScore.created_at.desc())
            .limit(1)
        )
        latest_test = test_res.scalar_one_or_none()
        if latest_test:
            context_str += f"\nUser's latest assessment ({latest_test.test_id}) score: {latest_test.score} ({latest_test.severity})."

    final_system_prompt = SYSTEM_PROMPT + context_str

    messages: list[dict] = []

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

    tools = [
        {
            "type": "function",
            "function": {
                "name": "recommend_meditation",
                "description": "Recommends a meditation to the user based on their needs.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "description": "Category of meditation (guided, sleep, relaxation, focus, stress, anxiety)",
                        }
                    },
                    "required": ["category"],
                },
            },
        }
    ]

    try:
        ai_text, tool_calls = await provider.generate_response(
            messages=messages,
            system_prompt=final_system_prompt,
            user_id=user_id,
            tools=tools,
        )
    except Exception:
        # Fallback if tool calling or something else fails
        try:
            ai_text, tool_calls = await provider.generate_response(
                messages=messages, system_prompt=final_system_prompt, user_id=user_id
            )
        except Exception:
            ai_text = "I'm here for you. What's on your mind?"
            tool_calls = None

    if tool_calls and db:
        for tc in tool_calls:
            if tc["function"]["name"] == "recommend_meditation":
                try:
                    args = json.loads(tc["function"]["arguments"])
                    category = args.get("category", "").upper()

                    # fetch a meditation track by category
                    track_res = await db.execute(
                        select(MeditationTrack)
                        .where(MeditationTrack.category == category)
                        .order_by(MeditationTrack.created_at.desc())
                        .limit(1)
                    )
                    track = track_res.scalar_one_or_none()

                    if track:
                        ai_text = f"I've found a great meditation track for you: {track.title} ({track.duration_seconds // 60} mins). It's focused on {track.category.lower()}."
                    else:
                        ai_text = f"I couldn't find a specific meditation track for {category.lower()} right now, but I encourage you to take a few deep breaths."
                except Exception:
                    pass

    if not ai_text:
        ai_text = "I'm here for you. What's on your mind?"

    # Simple naive tool call parsing since we don't have full ToolCall handling in the base interface for simplicity
    # If the AI hallucinates a tool call as text, we try to catch it or just provide the text.

    return CoachMessageResponse(
        id=uuid.uuid4(),
        session_id=session.id,
        role="assistant",
        content=ai_text,
        sentiment_score=None,
        emotion_tags=[],
        created_at=datetime.now(UTC),
    )
