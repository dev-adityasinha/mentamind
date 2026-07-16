"""Idempotent seed script for the Mentamind demo database.

Creates 1 demo organisation, 3 departments, ~50 users across all roles,
and 30 days of mood logs with derived wellness scores per active user.

Run from apps/api with the venv activated:
    python -m scripts.seed [--force]

--force deletes the existing demo org (cascade removes all dependents)
and recreates everything from scratch. It is restricted to local and
development environments.

This script is a standalone dev/staging tool. It must never be imported
from application code and must never run against a production database.
"""

import argparse
import asyncio
import logging
import random
import sys
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401
from app.models.appointment import Appointment, AppointmentStatus, SessionType
from app.models.department import Department
from app.models.mood_log import InputMethod, MoodLog
from app.models.organization import DataResidencyRegion, Organization
from app.models.user import User, UserRole
from app.models.wellness_score import BurnoutRiskLevel, WellnessScore
from app.services.auth_service import hash_email, hash_password
from app.services.encryption import encrypt
from app.settings import settings

logging.basicConfig(
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "msg": "%(message)s"}',
    level=logging.INFO,
)
log = logging.getLogger("seed")

DEMO_ORG_NAME = "Mentamind Demo"
WELLNESS_MODEL_VERSION = "v1.0.0"

DEPARTMENTS = ["Engineering", "People Operations", "Product"]

ROLE_DISTRIBUTION: list[tuple[UserRole, int]] = [
    (UserRole.EMPLOYEE, 28),
    (UserRole.MANAGER, 8),
    (UserRole.HR_MANAGER, 4),
    (UserRole.WELLNESS_OFFICER, 4),
    (UserRole.ADMIN, 2),
    (UserRole.COUNSELOR, 3),
    (UserRole.STUDENT, 3),
]

# Environments where seed is allowed at all.
_SEED_ALLOWED = frozenset({"local", "development", "staging"})
# Environments where --force (deletes all seed data) is permitted.
_FORCE_ALLOWED = frozenset({"local", "development"})

# Generic non-PII context snippets used for ~20% of positive mood entries.
CONTEXT_SNIPPETS = [
    "Completed a project milestone, feeling accomplished.",
    "Good team energy in standup today.",
    "Took a proper lunch break, made a noticeable difference.",
    "Morning meditation session helped set a calm tone.",
    "Challenging meeting but reached a good outcome.",
    "Clear focus today, tasks went smoothly.",
    "Connected with a colleague over coffee.",
    "Wrapped up the week on a solid note.",
    "Difficult day but managed to get through it.",
    "Feeling genuinely supported by the team.",
    "Completed a tough deliverable ahead of schedule.",
    "Took a short walk at noon, helped reset mentally.",
    "Good sleep last night, noticeable energy today.",
    "Resolved a long-standing issue, big relief.",
    "Had a productive 1:1 with manager.",
]


def _check_environment(force: bool) -> None:
    """Refuse to run in environments where seeding is not safe."""
    env = settings.environment
    if env not in _SEED_ALLOWED:
        log.error(
            "seed refused: ENVIRONMENT=%r is not a permitted seed target. "
            "Allowed environments: %s",
            env,
            sorted(_SEED_ALLOWED),
        )
        sys.exit(1)
    if force and env not in _FORCE_ALLOWED:
        log.error(
            "seed --force refused: ENVIRONMENT=%r. --force is only permitted in: %s",
            env,
            sorted(_FORCE_ALLOWED),
        )
        sys.exit(1)


def _mood_score(base: float, offset_days: int, rng: random.Random) -> int:
    """Return a mood score [1..5] with daily noise around base."""
    noise = rng.gauss(0, 0.6)
    raw = base + noise
    return max(1, min(5, round(raw)))


def _tags_for_mood(mood: int, rng: random.Random) -> list[str]:
    """Pick 1-3 emotion tags that loosely reflect the mood score."""
    positive = ["happy", "calm", "grateful", "excited", "motivated", "hopeful", "proud"]
    negative = [
        "anxious",
        "stressed",
        "sad",
        "frustrated",
        "overwhelmed",
        "tired",
        "irritable",
        "lonely",
    ]
    mixed = ["tired", "calm", "motivated"]

    if mood >= 4:
        pool = positive
    elif mood <= 2:
        pool = negative
    else:
        pool = mixed + positive[:3] + negative[:3]

    count = rng.randint(1, min(3, len(pool)))
    return rng.sample(pool, count)


def _derive_components(mood_score: int, rng: random.Random) -> dict:
    """Derive wellness score components from mood score plus simulated signals.

    stress_component is stress LEVEL (0=relaxed, 100=max stressed), so a lower
    value is healthier. composite_score inverts the stress contribution.
    """
    mood_component = round((mood_score - 1) / 4 * 100)

    sleep_component = max(0, min(100, mood_component + rng.randint(-20, 20)))
    stress_component = max(0, min(100, (100 - mood_component) + rng.randint(-25, 25)))
    energy_component = max(0, min(100, mood_component + rng.randint(-15, 15)))
    activity_component = max(0, min(100, 50 + rng.randint(-35, 35)))
    journaling_component = 100 if rng.random() < 0.35 else 0

    composite_score = max(
        0,
        min(
            100,
            round(
                (
                    mood_component
                    + sleep_component
                    + (100 - stress_component)
                    + energy_component
                    + activity_component
                    + journaling_component
                )
                / 6
            ),
        ),
    )

    burnout_risk_score = max(
        0,
        min(
            100,
            round(
                0.40 * (100 - mood_component)
                + 0.35 * stress_component
                + 0.25 * (100 - energy_component)
            ),
        ),
    )

    if burnout_risk_score <= 25:
        burnout_risk_level = BurnoutRiskLevel.LOW
    elif burnout_risk_score <= 55:
        burnout_risk_level = BurnoutRiskLevel.MODERATE
    elif burnout_risk_score <= 75:
        burnout_risk_level = BurnoutRiskLevel.HIGH
    else:
        burnout_risk_level = BurnoutRiskLevel.CRITICAL

    return {
        "composite_score": composite_score,
        "mood_component": mood_component,
        "sleep_component": sleep_component,
        "stress_component": stress_component,
        "energy_component": energy_component,
        "activity_component": activity_component,
        "journaling_component": journaling_component,
        "burnout_risk_score": burnout_risk_score,
        "burnout_risk_level": burnout_risk_level,
    }


def _base_mood_for_index(idx: int, total: int) -> float:
    """Assign each user a base mood. Last 8 users trend toward burnout."""
    at_risk_threshold = total - 8
    if idx >= at_risk_threshold:
        return 2.0 + (total - 1 - idx) * (0.4 / 7)
    return 2.8 + (idx / at_risk_threshold) * 1.5


async def _delete_demo_org(db: AsyncSession) -> None:
    result = await db.execute(
        select(Organization).where(Organization.name == DEMO_ORG_NAME)
    )
    org = result.scalar_one_or_none()
    if org:
        await db.delete(org)
        await db.commit()
        log.info("existing demo org deleted")


async def run_seed(force: bool = False) -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        result = await db.execute(
            select(Organization).where(Organization.name == DEMO_ORG_NAME)
        )
        existing = result.scalar_one_or_none()

        if existing and not force:
            log.info("demo org already exists, skipping (use --force to reseed)")
            await engine.dispose()
            return

        if existing and force:
            await _delete_demo_org(db)

        await _create_seed_data(db)

    await engine.dispose()
    log.info("seed complete")


async def _create_seed_data(db: AsyncSession) -> None:
    rng = random.Random(42)

    org = Organization(
        name=DEMO_ORG_NAME,
        data_residency_region=DataResidencyRegion.US,
    )
    db.add(org)
    await db.flush()
    log.info("created org %s", org.id)

    dept_objs: list[Department] = []
    for dept_name in DEPARTMENTS:
        dept = Department(org_id=org.id, name=dept_name)
        db.add(dept)
        dept_objs.append(dept)
    await db.flush()
    log.info("created %d departments", len(dept_objs))

    users: list[User] = []
    user_index = 0
    total_users = sum(count for _, count in ROLE_DISTRIBUTION)

    for role, count in ROLE_DISTRIBUTION:
        for i in range(count):
            dept = dept_objs[user_index % len(dept_objs)]
            tag = f"{role.value}-{i:03d}"
            user = User(
                org_id=org.id,
                department_id=dept.id,
                email_hash=hash_email(f"demo.{tag}@mentamind.internal"),
                display_name=f"Demo {role.value.replace('_', ' ').title()} {i + 1}",
                role=role,
                password_hash=hash_password("Demo@Mentamind2026!"),
                consent_analytics=rng.random() > 0.2,
                consent_ai_coaching=rng.random() > 0.3,
            )
            db.add(user)
            users.append(user)
            user_index += 1

    await db.flush()
    log.info("created %d users", len(users))

    managers_by_dept: dict[uuid.UUID, list[User]] = {}
    for u in users:
        if u.role == UserRole.MANAGER and u.department_id:
            managers_by_dept.setdefault(u.department_id, []).append(u)

    for u in users:
        if u.role == UserRole.EMPLOYEE and u.department_id:
            dept_managers = managers_by_dept.get(u.department_id, [])
            if dept_managers:
                u.manager_id = rng.choice(dept_managers).id

    await db.flush()

    active_users = users[:42]
    today = date.today()
    mood_log_count = 0
    wellness_score_count = 0

    for u_idx, user in enumerate(active_users):
        base_mood = _base_mood_for_index(u_idx, total_users)
        user_rng = random.Random(u_idx * 997 + 13)
        is_at_risk = u_idx >= len(active_users) - 8
        scores_for_day: dict[date, dict] = {}

        for day_offset in range(30):
            log_date = today - timedelta(days=29 - day_offset)

            if user_rng.random() > 0.82:
                continue

            if is_at_risk:
                trajectory_penalty = day_offset * 0.04
                effective_base = max(1.2, base_mood - trajectory_penalty)
            else:
                effective_base = base_mood

            mood = _mood_score(effective_base, day_offset, user_rng)
            tags = _tags_for_mood(mood, user_rng)

            context_encrypted: str | None = None
            if mood >= 3 and user_rng.random() < 0.20:
                snippet = user_rng.choice(CONTEXT_SNIPPETS)
                context_encrypted = encrypt(
                    snippet, associated_data=str(user.id).encode()
                )

            input_method = user_rng.choice(list(InputMethod))
            logged_at = datetime(
                log_date.year,
                log_date.month,
                log_date.day,
                user_rng.randint(7, 21),
                user_rng.randint(0, 59),
                tzinfo=UTC,
            )

            log_entry = MoodLog(
                user_id=user.id,
                org_id=org.id,
                mood_score=mood,
                emotion_tags=tags,
                context_encrypted=context_encrypted,
                input_method=input_method,
                logged_at=logged_at,
            )
            db.add(log_entry)
            mood_log_count += 1
            scores_for_day[log_date] = _derive_components(mood, user_rng)

        for score_date, components in scores_for_day.items():
            wellness = WellnessScore(
                user_id=user.id,
                org_id=org.id,
                score_date=score_date,
                model_version=WELLNESS_MODEL_VERSION,
                **components,
            )
            db.add(wellness)
            wellness_score_count += 1

    await db.flush()
    log.info(
        "created %d mood logs and %d wellness scores",
        mood_log_count,
        wellness_score_count,
    )

    counselors = [u for u in users if u.role == UserRole.COUNSELOR]
    employees_sample = rng.sample([u for u in users if u.role == UserRole.EMPLOYEE], 6)
    for emp in employees_sample:
        counselor = rng.choice(counselors) if counselors else None
        appt = Appointment(
            org_id=org.id,
            user_id=emp.id,
            counselor_id=counselor.id if counselor else None,
            status=rng.choice(list(AppointmentStatus)),
            session_type=rng.choice(list(SessionType)),
            scheduled_at=datetime.now(UTC) + timedelta(days=rng.randint(1, 14)),
        )
        db.add(appt)

    await db.commit()
    log.info("seed data committed")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Mentamind demo database")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete existing demo org and recreate all seed data",
    )
    args = parser.parse_args()

    _check_environment(args.force)

    if not settings.encryption_key:
        log.error("ENCRYPTION_KEY is not set. Cannot encrypt context fields.")
        sys.exit(1)

    asyncio.run(run_seed(force=args.force))


if __name__ == "__main__":
    main()
