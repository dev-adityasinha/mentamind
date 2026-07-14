import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.post import Post
from app.models.user import UserRole
from app.services.auth_service import create_access_token
from tests.conftest import create_user


@pytest.mark.asyncio
async def test_ghost_forum_tenant_isolation(
    client: AsyncClient,
    db_session: AsyncSession,
    org_a: Organization,
    org_b: Organization,
) -> None:
    """A ghost user in Org A cannot see posts from Org B."""
    # Create ghost users via DB bypass for testing
    user_a, _ = await create_user(db_session, org_a.id, UserRole.ANONYMOUS, "ga")
    user_b, _ = await create_user(db_session, org_b.id, UserRole.ANONYMOUS, "gb")

    # Seed a post from Org B
    post_b = Post(content="Hello from Org B", author_id=user_b.id, org_id=org_b.id)
    db_session.add(post_b)
    await db_session.commit()

    # User A tries to view forum posts
    token_a = create_access_token(user_a.id, org_a.id, UserRole.ANONYMOUS.value)
    resp = await client.get(
        "/forum/posts",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 200

    # User A must NOT see User B's post
    data = resp.json()
    assert len(data["posts"]) == 0

    # User A creates a post (request body, not query param)
    resp = await client.post(
        "/forum/posts",
        json={"content": "Hello from Org A"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 200

    # Confirm content sent as query parameter is rejected with 422
    # (no longer leaked in URLs)
    resp = await client.post(
        "/forum/posts",
        params={"content": "Leaked in URL"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 422

    # Verify User A's post is isolated to Org A
    resp = await client.get(
        "/forum/posts",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    data = resp.json()
    assert len(data["posts"]) == 1
    assert data["posts"][0]["content"] == "Hello from Org A"

    # User B checks their forum
    token_b = create_access_token(user_b.id, org_b.id, UserRole.ANONYMOUS.value)
    resp = await client.get(
        "/forum/posts",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    data = resp.json()
    assert len(data["posts"]) == 1
    assert data["posts"][0]["content"] == "Hello from Org B"
