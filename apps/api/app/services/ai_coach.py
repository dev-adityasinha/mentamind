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


# Standard, evidence-based breathing patterns keyed by goal.
_BREATHING_EXERCISES = {
    "calm": (
        "Let's try box breathing to settle your nervous system:\n"
        "1. Breathe in through your nose for 4 counts.\n"
        "2. Hold for 4 counts.\n"
        "3. Breathe out slowly for 4 counts.\n"
        "4. Hold for 4 counts.\n"
        "Repeat for 4 rounds. I'm right here with you."
    ),
    "sleep": (
        "The 4-7-8 breath is great for winding down before sleep:\n"
        "1. Breathe in quietly through your nose for 4 counts.\n"
        "2. Hold your breath for 7 counts.\n"
        "3. Exhale fully through your mouth for 8 counts.\n"
        "Repeat 4 times, letting each exhale relax you a little more."
    ),
    "focus": (
        "Try coherent breathing to steady your focus:\n"
        "1. Breathe in gently for 5 counts.\n"
        "2. Breathe out gently for 5 counts.\n"
        "Keep a smooth, even rhythm for about 2 minutes. "
        "It balances your system and clears mental fog."
    ),
}


def _breathing_exercise(goal: str) -> str:
    return _BREATHING_EXERCISES.get(goal, _BREATHING_EXERCISES["calm"])


async def _explain_latest_assessment(
    db: AsyncSession, user_id: uuid.UUID
) -> str | None:
    """Fetch the user's most recent assessment and explain it in plain language."""
    res = await db.execute(
        select(TestScore)
        .where(TestScore.user_id == user_id)
        .order_by(TestScore.created_at.desc())
        .limit(1)
    )
    latest = res.scalar_one_or_none()
    if latest is None:
        return None

    name_map = {
        "phq-9": "PHQ-9 (depression)",
        "gad-7": "GAD-7 (anxiety)",
        "pss-10": "Perceived Stress Scale",
        "burnout": "Burnout assessment",
    }
    friendly = name_map.get(latest.test_id.lower(), latest.test_id)
    severity = latest.severity or "recorded"
    taken = latest.created_at.date().isoformat()
    return (
        f"Your most recent {friendly}, taken on {taken}, came out as "
        f"“{severity}” (score {latest.score}). This is a snapshot of how you "
        f"were feeling then, not a diagnosis. If that result worries you, it "
        f"can help to talk it through with a professional — and I'm happy to "
        f"suggest some coping tools in the meantime. How are you feeling about it?"
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
            context_str += f"\nUser's latest mood is: {latest_mood.mood_score}/5, energy: {latest_mood.energy_score}/5, stress: {latest_mood.stress_score}/5."

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
        },
        {
            "type": "function",
            "function": {
                "name": "recommend_breathing",
                "description": (
                    "Recommends a specific, evidence-based breathing exercise "
                    "to help the user calm down, focus, or fall asleep."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "goal": {
                            "type": "string",
                            "description": (
                                "What the breathing should help with: "
                                "'calm', 'sleep', or 'focus'."
                            ),
                        }
                    },
                    "required": ["goal"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "explain_assessment",
                "description": (
                    "Explains the user's most recent psychological assessment "
                    "result (e.g. PHQ-9, GAD-7) in plain, supportive language."
                ),
                "parameters": {"type": "object", "properties": {}},
            },
        },
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
            name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"].get("arguments") or "{}")
            except Exception:
                args = {}

            if name == "recommend_meditation":
                # Category enum values are lowercase (guided, sleep, ...).
                category = str(args.get("category", "")).strip().lower()
                track_res = await db.execute(
                    select(MeditationTrack)
                    .where(MeditationTrack.category == category)
                    .order_by(MeditationTrack.created_at.desc())
                    .limit(1)
                )
                track = track_res.scalar_one_or_none()
                if track:
                    ai_text = (
                        f"I've found a meditation that might help: "
                        f"“{track.title}” ({track.duration_minutes} min) "
                        f"in our {track.category} collection. "
                        f"You can start it from the Meditation page whenever you're ready."
                    )
                else:
                    ai_text = (
                        "I don't have a saved session for that just yet, but a "
                        "simple grounding practice can help — want me to walk "
                        "you through some slow breathing?"
                    )

            elif name == "recommend_breathing":
                goal = str(args.get("goal", "calm")).strip().lower()
                ai_text = _breathing_exercise(goal)

            elif name == "explain_assessment":
                explanation = await _explain_latest_assessment(db, user_id)
                if explanation:
                    ai_text = explanation
                else:
                    ai_text = (
                        "You haven't completed an assessment yet. When you do, I "
                        "can walk you through what the results mean. You can take "
                        "one from the Assessments page."
                    )

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
