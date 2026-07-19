import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.user import UserRole
from app.services.auth_service import create_access_token
from tests.conftest import create_user


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _admin_token(db: AsyncSession, org: Organization) -> str:
    user, _ = await create_user(db, org.id, UserRole.ADMIN, "inv-admin")
    return create_access_token(user.id, org.id, UserRole.ADMIN.value)


@pytest.mark.asyncio
async def test_create_invitation_happy_path(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    token = await _admin_token(db_session, org_a)
    resp = await client.post(
        "/invitations",
        json={"email": "colleague@acme.com", "role": "user"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "token" in data
    assert len(data["token"]) > 20
    assert data["invited_role"] == "user"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_invite_token_not_stored_raw(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    """The response token must not appear verbatim in the invitation list
    (only hash stored)."""
    token = await _admin_token(db_session, org_a)
    create_resp = await client.post(
        "/invitations",
        json={"email": "hashcheck@acme.com", "role": "user"},
        headers=_auth(token),
    )
    assert create_resp.status_code == 201
    raw_token = create_resp.json()["token"]

    list_resp = await client.get("/invitations", headers=_auth(token))
    assert list_resp.status_code == 200
    for inv in list_resp.json():
        assert raw_token not in str(inv)


@pytest.mark.asyncio
async def test_list_invitations_only_own_org(
    client: AsyncClient,
    db_session: AsyncSession,
    org_a: Organization,
    org_b: Organization,
) -> None:
    token_a = await _admin_token(db_session, org_a)
    token_b = await _admin_token(db_session, org_b)

    await client.post(
        "/invitations",
        json={"email": "a-only@acme.com", "role": "user"},
        headers=_auth(token_a),
    )
    await client.post(
        "/invitations",
        json={"email": "b-only@beta.com", "role": "user"},
        headers=_auth(token_b),
    )

    resp_a = await client.get("/invitations", headers=_auth(token_a))
    assert resp_a.status_code == 200
    emails_a = [inv["email"] for inv in resp_a.json()]
    assert "b-only@beta.com" not in emails_a


@pytest.mark.asyncio
async def test_preview_valid_token(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    token = await _admin_token(db_session, org_a)
    create_resp = await client.post(
        "/invitations",
        json={"email": "preview@acme.com", "role": "user"},
        headers=_auth(token),
    )
    raw_token = create_resp.json()["token"]

    preview = await client.post("/invitations/preview", json={"token": raw_token})
    assert preview.status_code == 200
    assert "org_name" in preview.json()
    assert len(preview.json()["org_name"]) > 0


@pytest.mark.asyncio
async def test_preview_garbage_token(client: AsyncClient) -> None:
    resp = await client.post("/invitations/preview", json={"token": "not-a-real-token"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_accept_invitation_happy_path(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    admin_token = await _admin_token(db_session, org_a)
    create_resp = await client.post(
        "/invitations",
        json={"email": "newmember@acme.com", "role": "user"},
        headers=_auth(admin_token),
    )
    raw_token = create_resp.json()["token"]

    accept = await client.post(
        "/invitations/accept",
        json={
            "token": raw_token,
            "password": "NewMemberPass123!",
            "display_name": "New Member",
        },
    )
    assert accept.status_code == 201
    tokens = accept.json()
    assert "access_token" in tokens

    me = await client.get("/me", headers=_auth(tokens["access_token"]))
    assert me.status_code == 200
    assert me.json()["role"] == "user"


@pytest.mark.asyncio
async def test_accept_invitation_double_use(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    admin_token = await _admin_token(db_session, org_a)
    create_resp = await client.post(
        "/invitations",
        json={"email": "doubleuse@acme.com", "role": "user"},
        headers=_auth(admin_token),
    )
    raw_token = create_resp.json()["token"]

    payload = {
        "token": raw_token,
        "password": "Pass123456!",
        "display_name": "First",
    }
    r1 = await client.post("/invitations/accept", json=payload)
    assert r1.status_code == 201

    r2 = await client.post(
        "/invitations/accept",
        json={**payload, "display_name": "Second"},
    )
    assert r2.status_code == 401


@pytest.mark.asyncio
async def test_accept_revoked_invitation(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    admin_token = await _admin_token(db_session, org_a)
    create_resp = await client.post(
        "/invitations",
        json={"email": "revoked@acme.com", "role": "user"},
        headers=_auth(admin_token),
    )
    inv_id = create_resp.json()["id"]
    raw_token = create_resp.json()["token"]

    revoke = await client.post(
        f"/invitations/{inv_id}/revoke", headers=_auth(admin_token)
    )
    assert revoke.status_code == 204

    accept = await client.post(
        "/invitations/accept",
        json={
            "token": raw_token,
            "password": "Pass123456!",
            "display_name": "Revoked",
        },
    )
    assert accept.status_code == 401


@pytest.mark.asyncio
async def test_revoke_cross_org_denied(
    client: AsyncClient,
    db_session: AsyncSession,
    org_a: Organization,
    org_b: Organization,
) -> None:
    token_a = await _admin_token(db_session, org_a)
    token_b = await _admin_token(db_session, org_b)

    create_resp = await client.post(
        "/invitations",
        json={"email": "crossorg@acme.com", "role": "user"},
        headers=_auth(token_a),
    )
    inv_id = create_resp.json()["id"]

    resp = await client.post(f"/invitations/{inv_id}/revoke", headers=_auth(token_b))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_employee_cannot_invite(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    employee, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "emp-inv")
    token = create_access_token(employee.id, org_a.id, UserRole.EMPLOYEE.value)

    resp = await client.post(
        "/invitations",
        json={"email": "outsider@acme.com", "role": "user"},
        headers=_auth(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_hr_manager_can_invite(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    hr, _ = await create_user(db_session, org_a.id, UserRole.HR_MANAGER, "hr-inv")
    token = create_access_token(hr.id, org_a.id, UserRole.HR_MANAGER.value)

    resp = await client.post(
        "/invitations",
        json={"email": f"hr-invite-{uuid.uuid4()}@acme.com", "role": "user"},
        headers=_auth(token),
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_duplicate_pending_invite_rejected(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    admin_token = await _admin_token(db_session, org_a)
    payload = {"email": "dup@acme.com", "role": "user"}

    r1 = await client.post("/invitations", json=payload, headers=_auth(admin_token))
    assert r1.status_code == 201

    r2 = await client.post("/invitations", json=payload, headers=_auth(admin_token))
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_revoke_nonexistent_invitation(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    admin_token = await _admin_token(db_session, org_a)
    resp = await client.post(
        f"/invitations/{uuid.uuid4()}/revoke", headers=_auth(admin_token)
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_invite_assigned_correct_org(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    admin_token = await _admin_token(db_session, org_a)
    create_resp = await client.post(
        "/invitations",
        json={"email": "orgcheck@acme.com", "role": "user"},
        headers=_auth(admin_token),
    )
    raw_token = create_resp.json()["token"]

    accept = await client.post(
        "/invitations/accept",
        json={
            "token": raw_token,
            "password": "Pass123456!",
            "display_name": "Org Check",
        },
    )
    tokens = accept.json()
    me = await client.get("/me", headers=_auth(tokens["access_token"]))
    assert me.json()["org_id"] == str(org_a.id)
