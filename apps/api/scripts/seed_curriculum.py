"""Seed the 30-day guided meditation curriculum (blocks + days).

Idempotent upsert: matches curriculum_blocks by `block` and curriculum_days by
`day`, updating existing rows or inserting missing ones. Safe to run repeatedly.

Run inside the API container:

    docker compose exec api python scripts/seed_curriculum.py

Content is read from curriculum_seed.json which sits next to this script.
"""

import asyncio
import json
import sys
from pathlib import Path

# Make the app package importable regardless of cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.curriculum_day import CurriculumBlock, CurriculumDay  # noqa: E402

_SEED_FILE = Path(__file__).resolve().parent / "curriculum_seed.json"


async def seed() -> None:
    data = json.loads(_SEED_FILE.read_text(encoding="utf-8"))
    blocks = data.get("blocks", [])
    days = data.get("days", [])

    async with AsyncSessionLocal() as db:
        # --- Blocks ---
        for b in blocks:
            existing = (
                await db.execute(
                    select(CurriculumBlock).where(CurriculumBlock.block == b["block"])
                )
            ).scalar_one_or_none()
            if existing is None:
                db.add(
                    CurriculumBlock(
                        block=b["block"],
                        name=b.get("name", ""),
                        focus=b.get("focus", ""),
                        meditation_focus=b.get("meditationFocus", ""),
                        reflection_focus=b.get("reflectionFocus", ""),
                        task_focus=b.get("taskFocus", ""),
                        color=b.get("color", ""),
                    )
                )
            else:
                existing.name = b.get("name", "")
                existing.focus = b.get("focus", "")
                existing.meditation_focus = b.get("meditationFocus", "")
                existing.reflection_focus = b.get("reflectionFocus", "")
                existing.task_focus = b.get("taskFocus", "")
                existing.color = b.get("color", "")

        # --- Days ---
        for d in days:
            existing = (
                await db.execute(
                    select(CurriculumDay).where(CurriculumDay.day == d["day"])
                )
            ).scalar_one_or_none()
            fields = dict(
                block=d["block"],
                title=d.get("title", ""),
                subtitle=d.get("subtitle", ""),
                theme=d.get("theme", ""),
                mood_question=d.get("moodQuestion", ""),
                meditation=d.get("meditation", {}),
                reflection=d.get("reflection", {}),
                task=d.get("task", {}),
            )
            if existing is None:
                db.add(CurriculumDay(day=d["day"], **fields))
            else:
                for k, v in fields.items():
                    setattr(existing, k, v)

        await db.commit()

    print(f"Seeded curriculum: {len(blocks)} blocks, {len(days)} days.")


if __name__ == "__main__":
    asyncio.run(seed())
