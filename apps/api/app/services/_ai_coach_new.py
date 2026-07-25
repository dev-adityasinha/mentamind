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
    "You are Menta, a warm, caring companion on the Mentamind app. "
    "Think of yourself as a supportive friend who is genuinely glad the "
    "person showed up to talk. They can open up about anything on their "
    "mind — their day, their relationships, work or study stress, "
    "loneliness, excitement, random thoughts, or whatever they are "
    "carrying. You are here to listen and let them talk their heart out.\n"
    "\n"
    "How you talk:\n"
    "- Be warm, natural, and conversational, like a caring friend — not "
    "robotic, formal, or clinical.\n"
    "- Follow the person wherever they want to go. Any everyday topic is "
    "welcome; you are not limited to wellness or assessment questions.\n"
    "- Listen first. Reflect back what you hear, and ask gentle follow-up "
    "questions to help them feel understood and keep sharing.\n"
    "- Respond as a human first. Acknowledge and sit with what they said "
    "before offering anything. Never jump straight to a meditation, "
    "breathing exercise, or assessment.\n"
    "- Only after you have connected, you may gently offer a calming tool "
    "(like a short meditation or breathing exercise) as an option — never a "
    "command. When you do, always let them choose: ask whether they would "
    "like to try it, or would rather keep talking it out with you.\n"
    "- If they just want to talk, simply keep talking with them. Do not push "
    "tools on them.\n"
    "- Use casual warmth — \"I hear you\", \"That sounds really tough\", "
    "\"How are you feeling about that?\"\n"
    "- Keep replies fairly concise — usually 2-5 sentences. Don't overuse "
    "emojis or exclamation marks; stay calm and grounded.\n"
    "- If you genuinely don't know something, say so. Never make things up.\n"
    "\n"
    "Care and honesty:\n"
    "- You are a supportive companion, not a licensed therapist or doctor. "
    "Don't diagnose or prescribe; offer gentle, everyday support instead.\n"
    "- If someone expresses serious distress or a crisis, respond with "
    "compassion and gently encourage them to reach out to a crisis line or "
    "a trusted professional. Always prioritize their safety and well-being.\n"
    "\n"
    "Boundaries — stay kind, but do not cross these:\n"
    "- No sexual, explicit, or romantic/erotic roleplay content, and "
    "nothing that sexualizes anyone. If the person is under 18, keep "
    "everything strictly age-appropriate.\n"
    "- Never help with anything illegal, or with violence, weapons, or "
    "harming others.\n"
    "- Never provide methods or instructions for self-harm or suicide. "
    "Instead, respond with care and point toward crisis support.\n"
    "- No hateful, harassing, or demeaning content toward any person or "
    "group.\n"
    "- Don't give definitive medical, legal, or financial directives; you "
    "can listen and offer general, gentle perspective and suggest they "
    "consult a qualified professional.\n"
    "- When you must decline, do it briefly and warmly — without lecturing "
    "— and gently steer back to how the person is doing."
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


# Crisis safety net.
# A message signalling suicidal ideation or self-harm must NEVER be answered
# with a canned assessment/meditation reply. When any of these phrases appear
# we short-circuit BEFORE calling the model or firing tools, and return a warm,
# supportive message with crisis resources. Kept deliberately broad and
# lowercase-substring based so it errs on the side of catching distress.
_CRISIS_PATTERNS: tuple[str, ...] = (
    "should die",
    "want to die",
    "wanna die",
    "want to end it",
    "end my life",
    "ending my life",
    "ending it all",
    "kill myself",
    "killing myself",
    "take my life",
    "taking my life",
    "suicide",
    "suicidal",
    "self harm",
    "self-harm",
    "harm myself",
    "hurt myself",
    "cut myself",
    "cutting myself",
    "no reason to live",
    "not worth living",
    "better off dead",
    "don't want to live",
    "do not want to live",
    "want to disappear",
)

_CRISIS_RESPONSE: str = (
    "I'm really glad you told me this, and I'm so sorry you're feeling this "
    "much pain right now. You matter, and you don't have to carry this alone. "
    "I'm not able to be the support you deserve in a moment like this, but "
    "people who are trained to help are available right now:\n"
    "\n"
    "• iCall (India): 9152987821 — Mon-Sat, 8am-10pm IST\n"
    "• Vandrevala Foundation (India): 1860-2662-345 — 24/7\n"
    "• US: call or text 988 — 24/7\n"
    "• Crisis Text Line: text HOME to 741741\n"
    "\n"
    "If you might act on these feelings or you're in immediate danger, please "
    "contact your local emergency services right away. Are you safe right now? "
    "I'm here to keep talking with you, and reaching out to a trusted person "
    "nearby can help too."
)


def _detect_crisis(text: str) -> bool:
    """Return True if the message contains self-harm / suicide signals."""
    if not text:
        return False
    lowered = text.lower()
    return any(pattern in lowered for pattern in _CRISIS_PATTERNS)


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

    # Crisis safety net: if the newest user message signals suicidal ideation
    # or self-harm, respond with care and resources immediately. Do NOT call the
    # model or fire any tool (which could overwrite this with a canned reply).
    if _detect_crisis(user_message_content):
        return CoachMessageResponse(
            id=uuid.uuid4(),
            session_id=session.id,
            role="assistant",
            content=_CRISIS_RESPONSE,
            sentiment_score=None,
            emotion_tags=[],
            created_at=datetime.now(UTC),
        )


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
                # Talk first: keep the model's human reply and APPEND the
                # suggestion as a gentle offer ending with a choice.
                if track:
                    suggestion = (
                        f"If it feels right, there's a meditation that might "
                        f"help — “{track.title}” ({track.duration_minutes} min) "
                        f"in our {track.category} collection, on the Meditation "
                        f"page. Would you like to try it, or would you rather "
                        f"keep talking it out with me?"
                    )
                else:
                    suggestion = (
                        "If it feels right, a simple grounding practice might "
                        "help. Would you like me to walk you through some slow "
                        "breathing, or would you rather keep talking it out with me?"
                    )
                ai_text = f"{ai_text}\n\n{suggestion}" if ai_text else suggestion

            elif name == "recommend_breathing":
                goal = str(args.get("goal", "calm")).strip().lower()
                # Talk first: keep the human reply, then offer the exercise
                # with a choice rather than replacing what the model said.
                exercise = _breathing_exercise(goal)
                suggestion = (
                    "Whenever you're ready, we could try a short breathing "
                    "exercise together:\n"
                    f"{exercise}\n\n"
                    "Would you like to try that, or would you rather keep "
                    "talking it out with me?"
                )
                ai_text = f"{ai_text}\n\n{suggestion}" if ai_text else suggestion

            elif name == "explain_assessment":
                explanation = await _explain_latest_assessment(db, user_id)
                if explanation:
                    ai_text = explanation
                else:
                    # Only surface the 'no assessment yet' nudge when the person
                    # actually asked about their assessment/results. Otherwise the
                    # model mis-fired this tool, so keep its real reply rather than
                    # overwriting it with an off-topic canned message.
                    _asked = user_message_content.lower()
                    if any(
                        kw in _asked
                        for kw in (
                            "assessment",
                            "test",
                            "score",
                            "result",
                            "phq",
                            "gad",
                            "screening",
                        )
                    ):
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
