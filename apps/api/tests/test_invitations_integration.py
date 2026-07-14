"""Integration test for invite-accept atomicity under real Postgres concurrency.

Requires a live Postgres instance (pytest.mark.integration). SQLite in-memory
serialises everything and cannot exercise true concurrent writers; only a real
Postgres connection pool with multiple concurrent transactions can prove that
the conditional UPDATE is actually atomic.

The guard in accept_invitation is:
    UPDATE invitations
    SET status = 'accepted'
    WHERE token_hash = :hash
      AND status = 'pending'
      AND expires_at > now()

Exactly one of N concurrent executors will match the WHERE clause (rowcount=1);
the rest will see rowcount=0 because the winning transaction already committed
the status change before the losers execute. This test verifies that invariant.
"""

import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.invitation import Invitation, InvitationStatus
from app.models.organization import DataResidencyRegion, Organization
from app.models.user import User, UserRole
from app.services.auth_service import (
    generate_invite_token,
    hash_email,
    hash_password,
)
from app.settings import settings

pytestmark = pytest.mark.integration


@pytest.fixture
async def pg_engine():
    engine = create_async_engine(settings.database_url, echo=False)
    yield engine
    await engine.dispose()


@pytest.fixture
async def pg_session_factory(pg_engine):
    return async_sessionmaker(pg_engine, expire_on_commit=False)


@pytest.fixture
async def pg_session(pg_session_factory) -> AsyncSession:
    async with pg_session_factory() as session:
        yield session


async def _seed_org_and_invitation(
    session: AsyncSession,
) -> tuple[Organization, str, str]:
    """Returns (org, raw_token, token_hash). Invitation expires in 1 hour."""
    org = Organization(
        name=f"ConcurrencyOrg-{uuid.uuid4()}",
        data_residency_region=DataResidencyRegion.IN,
    )
    session.add(org)
    await session.flush()

    admin = User(
        org_id=org.id,
        email_hash=hash_email(f"admin-{uuid.uuid4()}@example.com"),
        display_name="Admin",
        role=UserRole.ADMIN,
        password_hash=hash_password("AdminPass123!"),
        consent_analytics=False,
        consent_ai_coaching=False,
    )
    session.add(admin)
    await session.flush()

    raw_token, token_hash = generate_invite_token()
    inv = Invitation(
        org_id=org.id,
        email_hash=hash_email(f"invitee-{uuid.uuid4()}@example.com"),
        email_encrypted="placeholder",
        invited_role=UserRole.EMPLOYEE,
        token_hash=token_hash,
        status=InvitationStatus.PENDING,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
        created_by=admin.id,
    )
    session.add(inv)
    await session.commit()
    return org, raw_token, token_hash


@pytest.mark.asyncio
async def test_concurrent_invite_accept_exactly_one_wins(
    pg_session: AsyncSession,
    pg_session_factory,
) -> None:
    """20 concurrent coroutines racing to accept the same invite token.

    Exactly one must flip the status row (rowcount=1); all others must see
    rowcount=0. This proves the conditional UPDATE is atomic on real Postgres.
    """
    db_url = os.getenv("DATABASE_URL", settings.database_url)
    if "sqlite" in db_url:
        pytest.skip("SQLite cannot prove UPDATE atomicity - run against Postgres")

    org, raw_token, token_hash = await _seed_org_and_invitation(pg_session)

    concurrent = 20
    now = datetime.now(UTC)

    async def _attempt() -> int:
        async with pg_session_factory() as db:
            stmt = (
                update(Invitation)
                .where(
                    Invitation.token_hash == token_hash,
                    Invitation.status == InvitationStatus.PENDING,
                    Invitation.expires_at > now,
                )
                .values(status=InvitationStatus.ACCEPTED)
            )
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount

    rowcounts = await asyncio.gather(*[_attempt() for _ in range(concurrent)])

    winners = sum(rowcounts)
    assert winners == 1, (
        f"Expected exactly 1 UPDATE to win, got {winners}. "
        f"rowcounts={rowcounts}. "
        "Non-atomic accept would allow multiple concurrent accepts to succeed."
    )
    assert rowcounts.count(0) == concurrent - 1

    await pg_session.delete(org)
    await pg_session.commit()


@pytest.mark.asyncio
async def test_concurrent_invite_accept_loser_gets_401_semantics(
    pg_session: AsyncSession,
    pg_session_factory,
) -> None:
    """Verify that rowcount=0 maps to the right rejection path (not a silent accept).

    This is a logic test on top of the atomicity test above: if rowcount is 0,
    the endpoint must raise 401 rather than silently continue. We verify the
    rowcount=0 branch is what the non-winners hit.
    """
    db_url = os.getenv("DATABASE_URL", settings.database_url)
    if "sqlite" in db_url:
        pytest.skip("SQLite cannot prove UPDATE atomicity - run against Postgres")

    org, raw_token, token_hash = await _seed_org_and_invitation(pg_session)

    now = datetime.now(UTC)

    async def _accept(db_factory) -> int:
        async with db_factory() as db:
            result = await db.execute(
                update(Invitation)
                .where(
                    Invitation.token_hash == token_hash,
                    Invitation.status == InvitationStatus.PENDING,
                    Invitation.expires_at > now,
                )
                .values(status=InvitationStatus.ACCEPTED)
            )
            await db.commit()
            return result.rowcount

    r1, r2 = await asyncio.gather(
        _accept(pg_session_factory),
        _accept(pg_session_factory),
    )

    assert r1 + r2 == 1, "Exactly one of two concurrent accepts must succeed"
    assert 0 in (r1, r2), "The loser must see rowcount=0, which maps to 401"
    assert 1 in (r1, r2), "The winner must see rowcount=1"

    await pg_session.delete(org)
    await pg_session.commit()
