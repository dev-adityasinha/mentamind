import base64
import uuid

import pytest
from fakeredis import FakeAsyncRedis
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

import app.models  # noqa: F401 - registers all models with Base.metadata
from app.database import Base, get_db
from app.dependencies.redis_dep import get_redis_dep
from app.main import app
from app.models.organization import DataResidencyRegion, Organization
from app.models.user import User, UserRole
from app.services.auth_service import hash_email, hash_password


@compiles(ARRAY, "sqlite")
def compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Fixed 32-byte key used across the test session. Never used outside tests.
_TEST_ENCRYPTION_KEY = base64.b64encode(b"\xab" * 32).decode()


@pytest.fixture
def fake_redis() -> FakeAsyncRedis:
    """Fresh FakeAsyncRedis per test; prevents rate limit state from leaking."""
    return FakeAsyncRedis(decode_responses=True)


@pytest.fixture(autouse=True)
def _override_redis(fake_redis: FakeAsyncRedis):
    """Inject FakeAsyncRedis so unit tests never hit real Redis for rate limits."""
    app.dependency_overrides[get_redis_dep] = lambda: fake_redis
    yield
    app.dependency_overrides.pop(get_redis_dep, None)

@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Reset the global slowapi Limiter storage to prevent 429 across tests."""
    from app.middleware.rate_limit import limiter
    # This works for the MemoryStorage used in testing
    limiter._storage.reset()
    yield


@pytest.fixture(scope="session", autouse=True)
def _patch_encryption_key():
    """Inject a valid ENCRYPTION_KEY into settings for the entire test session."""
    from app.settings import settings

    settings.encryption_key = _TEST_ENCRYPTION_KEY


@pytest.fixture(scope="session")
async def engine():
    _engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield _engine
    await _engine.dispose()


@pytest.fixture
async def db_session(engine) -> AsyncSession:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def org_a(db_session: AsyncSession) -> Organization:
    org = Organization(
        name=f"Org-A-{uuid.uuid4()}",
        data_residency_region=DataResidencyRegion.US,
    )
    db_session.add(org)
    await db_session.commit()
    return org


@pytest.fixture
async def org_b(db_session: AsyncSession) -> Organization:
    org = Organization(
        name=f"Org-B-{uuid.uuid4()}",
        data_residency_region=DataResidencyRegion.EU,
    )
    db_session.add(org)
    await db_session.commit()
    return org


async def create_user(
    db: AsyncSession,
    org_id: uuid.UUID,
    role: UserRole,
    tag: str = "",
) -> tuple[User, str]:
    """Create a user directly; returns (user, plaintext_password)."""
    password = "TestPass123!"
    user = User(
        org_id=org_id,
        email_hash=hash_email(f"user-{tag}-{uuid.uuid4()}@example.com"),
        display_name=f"User {tag}",
        role=role,
        password_hash=hash_password(password),
        consent_analytics=False,
        consent_ai_coaching=False,
    )
    db.add(user)
    await db.commit()
    return user, password
