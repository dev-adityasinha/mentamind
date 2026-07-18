"""Seed the meditation library with a starter set of sessions.

Idempotent: matches existing rows by (title, category) and inserts only the
ones that are missing, so it is safe to run repeatedly.

Run inside the API container:

    docker compose exec api python scripts/seed_meditations.py

The audio URLs below point at SoundHelix, a long-standing free audio host, so
every seeded track actually plays out of the box. Swap `audio_url` for your own
branded / licensed audio (or upload via the admin UI and paste the returned
/media URL) whenever you like — re-running this script will not overwrite tracks
that already exist.
"""

import asyncio
import sys
from pathlib import Path

# Allow running the file directly (python scripts/seed_meditations.py) by making
# the app package importable regardless of the current working directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.meditation import (  # noqa: E402
    MeditationCategory,
    MeditationDifficulty,
    MeditationTrack,
)

# A demo audio URL that is freely usable and stable. Every track uses one of
# these; replace with your own audio per track as needed.
_AUDIO = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-{n}.mp3"


def audio(n: int) -> str:
    return _AUDIO.format(n=n)


# (title, description, duration_minutes, category, difficulty, audio_n)
SEED_TRACKS: list[tuple] = [
    # --- Guided meditation ---
    (
        "Morning Grounding",
        "A gentle guided meditation to center yourself and set an intention "
        "for the day ahead.",
        10,
        MeditationCategory.GUIDED,
        MeditationDifficulty.BEGINNER,
        1,
    ),
    (
        "Body Scan Relaxation",
        "Move your awareness slowly through the body, releasing tension from "
        "head to toe.",
        15,
        MeditationCategory.GUIDED,
        MeditationDifficulty.BEGINNER,
        2,
    ),
    (
        "Loving-Kindness Practice",
        "Cultivate compassion for yourself and others with this guided "
        "loving-kindness meditation.",
        12,
        MeditationCategory.GUIDED,
        MeditationDifficulty.INTERMEDIATE,
        3,
    ),
    (
        "Deep Presence",
        "An advanced guided sit for experienced meditators seeking stillness "
        "and sustained presence.",
        25,
        MeditationCategory.GUIDED,
        MeditationDifficulty.ADVANCED,
        4,
    ),
    # --- Sleep stories ---
    (
        "The Quiet Forest",
        "Drift off to a slow, soothing story that wanders through a still and "
        "peaceful forest at dusk.",
        20,
        MeditationCategory.SLEEP,
        MeditationDifficulty.BEGINNER,
        5,
    ),
    (
        "Night Train",
        "A calming bedtime story set aboard a gentle overnight train, rocking "
        "you softly to sleep.",
        25,
        MeditationCategory.SLEEP,
        MeditationDifficulty.BEGINNER,
        6,
    ),
    (
        "Ocean Lullaby",
        "Waves and a quiet narrator ease you into deep, restful sleep by the " "sea.",
        30,
        MeditationCategory.SLEEP,
        MeditationDifficulty.BEGINNER,
        7,
    ),
    (
        "Starlit Meadow",
        "Lie back under a sky full of stars in this dreamy, drifting sleep " "story.",
        18,
        MeditationCategory.SLEEP,
        MeditationDifficulty.BEGINNER,
        8,
    ),
    # --- Relaxation ---
    (
        "Unwind & Release",
        "A short relaxation to melt away the stress of the day and soften "
        "your shoulders.",
        8,
        MeditationCategory.RELAXATION,
        MeditationDifficulty.BEGINNER,
        9,
    ),
    (
        "Gentle Rain",
        "Settle into the steady rhythm of soft rainfall and let your mind "
        "grow calm.",
        15,
        MeditationCategory.RELAXATION,
        MeditationDifficulty.BEGINNER,
        10,
    ),
    (
        "Warm Light",
        "Imagine a warm, comforting light spreading relaxation through every "
        "part of you.",
        12,
        MeditationCategory.RELAXATION,
        MeditationDifficulty.INTERMEDIATE,
        11,
    ),
    # --- Focus ---
    (
        "Deep Work Focus",
        "Prime your mind for concentrated, distraction-free work with this "
        "focusing session.",
        10,
        MeditationCategory.FOCUS,
        MeditationDifficulty.BEGINNER,
        12,
    ),
    (
        "Clarity Breath",
        "Sharpen attention through a simple, rhythmic breathing practice.",
        7,
        MeditationCategory.FOCUS,
        MeditationDifficulty.BEGINNER,
        13,
    ),
    (
        "Sustained Concentration",
        "A longer focus meditation to build the mental stamina for deep, "
        "sustained attention.",
        20,
        MeditationCategory.FOCUS,
        MeditationDifficulty.ADVANCED,
        14,
    ),
    # --- Stress relief ---
    (
        "Reset in Five",
        "A quick five-minute reset to interrupt a stressful moment and steady "
        "your nervous system.",
        5,
        MeditationCategory.STRESS,
        MeditationDifficulty.BEGINNER,
        15,
    ),
    (
        "Letting Go of Tension",
        "Breathe out stress and physical tension with this restorative " "practice.",
        14,
        MeditationCategory.STRESS,
        MeditationDifficulty.INTERMEDIATE,
        16,
    ),
    (
        "Calm Under Pressure",
        "Build resilience and a sense of steadiness for high-pressure days.",
        12,
        MeditationCategory.STRESS,
        MeditationDifficulty.INTERMEDIATE,
        1,
    ),
    # --- Anxiety reduction ---
    (
        "Soothing the Anxious Mind",
        "A grounding meditation to gently ease anxious thoughts and return to "
        "the present.",
        11,
        MeditationCategory.ANXIETY,
        MeditationDifficulty.BEGINNER,
        2,
    ),
    (
        "Safe & Steady",
        "Cultivate a felt sense of safety and calm when anxiety rises.",
        13,
        MeditationCategory.ANXIETY,
        MeditationDifficulty.BEGINNER,
        3,
    ),
    (
        "Breathing Through Worry",
        "Use paced breathing to quiet a racing mind and slow a fast heartbeat.",
        9,
        MeditationCategory.ANXIETY,
        MeditationDifficulty.INTERMEDIATE,
        4,
    ),
]


async def seed() -> None:
    inserted = 0
    skipped = 0
    async with AsyncSessionLocal() as db:
        for (
            title,
            description,
            duration,
            category,
            difficulty,
            audio_n,
        ) in SEED_TRACKS:
            existing = await db.execute(
                select(MeditationTrack).where(
                    MeditationTrack.title == title,
                    MeditationTrack.category == category,
                )
            )
            if existing.scalar_one_or_none() is not None:
                skipped += 1
                continue

            db.add(
                MeditationTrack(
                    title=title,
                    description=description,
                    audio_url=audio(audio_n),
                    duration_minutes=duration,
                    category=category,
                    difficulty=difficulty,
                )
            )
            inserted += 1

        await db.commit()

    print(
        f"Meditation seed complete: {inserted} inserted, {skipped} already "
        f"present ({len(SEED_TRACKS)} total defined)."
    )


if __name__ == "__main__":
    asyncio.run(seed())
