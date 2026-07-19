import uuid as _uuid_mod
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models.invitation import Invitation, InvitationStatus
from app.models.organization import Organization
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.schemas.auth import TokenResponse
from app.schemas.invitation import (
    InvitationAcceptRequest,
    InvitationCreateRequest,
    InvitationCreateResponse,
    InvitationPreviewRequest,
    InvitationPreviewResponse,
    InvitationResponse,
)
from app.services.auth_service import (
    create_access_token,
    generate_invite_token,
    generate_refresh_token,
    hash_email,
    hash_password,
    hash_token,
)
from app.services.encryption import decrypt, encrypt
from app.settings import settings

router = APIRouter(prefix="/invitations", tags=["invitations"])

_can_invite = require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)

# Roles that may be assigned via an organization invitation. Other UserRole
# members (EMPLOYEE, MANAGER, HR_MANAGER, WELLNESS_OFFICER, COUNSELOR, STUDENT,
# ANONYMOUS) are intentionally excluded and cannot be invited, so a crafted
# request cannot bypass the UI's role selector.
INVITABLE_ROLES = frozenset(
    {
        UserRole.USER,
        UserRole.MODERATOR,
        UserRole.THERAPIST,
        UserRole.ADMIN,
    }
)


def _decrypt_email(inv: Invitation) -> str:
    return decrypt(inv.email_encrypted, inv.org_id.bytes)


@router.post(
    "",
    response_model=InvitationCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    body: InvitationCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = _can_invite,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> InvitationCreateResponse:
    # Reject roles that are not invitable, regardless of what the client sent.
    if body.role not in INVITABLE_ROLES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Role '{body.role.value}' cannot be assigned via invitation",
        )

    # Only the super-admin may grant the admin role.
    if body.role == UserRole.ADMIN:
        if current_user.email_hash != hash_email(settings.super_admin_email):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Only the super-admin may invite with admin role",
            )

    email_norm = body.email.strip().lower()
    email_hash = hash_email(email_norm)

    existing_user = await db.execute(
        select(User).where(
            User.email_hash == email_hash,
            User.org_id == current_user.org_id,
        )
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A member with this email already exists in your organization",
        )

    pending = await db.execute(
        select(Invitation).where(
            Invitation.org_id == current_user.org_id,
            Invitation.email_hash == email_hash,
            Invitation.status == InvitationStatus.PENDING,
            Invitation.expires_at > datetime.now(UTC),
        )
    )
    if pending.scalar_one_or_none():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A pending invitation for this email already exists",
        )

    raw_token, token_hash = generate_invite_token()
    email_encrypted = encrypt(email_norm, current_user.org_id.bytes)
    expires_at = datetime.now(UTC) + timedelta(days=settings.invitation_expire_days)

    inv = Invitation(
        org_id=current_user.org_id,
        email_hash=email_hash,
        email_encrypted=email_encrypted,
        invited_role=body.role,
        token_hash=token_hash,
        status=InvitationStatus.PENDING,
        expires_at=expires_at,
        created_by=current_user.id,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)

    # Send via FastAPI BackgroundTasks (runs after the response is sent, within
    # the app lifecycle). asyncio.create_task here is unsafe: the task can be
    # garbage-collected before it runs, so the email would silently never send.
    from app.services.email import send_invitation_email

    background_tasks.add_task(
        send_invitation_email, email_norm, raw_token, body.role.value
    )

    return InvitationCreateResponse(
        id=inv.id,
        email=email_norm,
        invited_role=inv.invited_role,
        status=inv.status,
        expires_at=inv.expires_at,
        created_at=inv.created_at,
        token=raw_token,
    )


@router.get("", response_model=list[InvitationResponse])
async def list_invitations(
    current_user: User = _can_invite,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> list[InvitationResponse]:
    result = await db.execute(
        select(Invitation)
        .where(Invitation.org_id == current_user.org_id)
        .order_by(Invitation.created_at.desc())
    )
    invitations = result.scalars().all()
    return [
        InvitationResponse(
            id=inv.id,
            email=_decrypt_email(inv),
            invited_role=inv.invited_role,
            status=inv.status,
            expires_at=inv.expires_at,
            created_at=inv.created_at,
        )
        for inv in invitations
    ]


@router.post("/{invitation_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: str,
    current_user: User = _can_invite,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> None:
    try:
        inv_id = _uuid_mod.UUID(invitation_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")

    result = await db.execute(
        update(Invitation)
        .where(
            Invitation.id == inv_id,
            Invitation.org_id == current_user.org_id,
            Invitation.status == InvitationStatus.PENDING,
        )
        .values(status=InvitationStatus.REVOKED)
    )
    if result.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    await db.commit()


@router.post("/{invitation_id}/resend", status_code=status.HTTP_204_NO_CONTENT)
async def resend_invitation(
    invitation_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = _can_invite,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> None:
    try:
        inv_id = _uuid_mod.UUID(invitation_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")

    result = await db.execute(
        select(Invitation).where(
            Invitation.id == inv_id,
            Invitation.org_id == current_user.org_id,
            Invitation.status == InvitationStatus.PENDING,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")

    raw_token, token_hash = generate_invite_token()
    expires_at = datetime.now(UTC) + timedelta(days=settings.invitation_expire_days)

    inv.token_hash = token_hash
    inv.expires_at = expires_at
    await db.commit()

    email_norm = _decrypt_email(inv)
    from app.services.email import send_invitation_email

    background_tasks.add_task(
        send_invitation_email, email_norm, raw_token, inv.invited_role
    )


@router.post("/preview", response_model=InvitationPreviewResponse)
async def preview_invitation(
    body: InvitationPreviewRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> InvitationPreviewResponse:
    token_hash = hash_token(body.token)
    now = datetime.now(UTC)

    result = await db.execute(
        select(Invitation).where(
            Invitation.token_hash == token_hash,
            Invitation.status == InvitationStatus.PENDING,
            Invitation.expires_at > now,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Invitation not found or expired"
        )

    org = await db.get(Organization, inv.org_id)
    if not org:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Invitation not found or expired"
        )

    return InvitationPreviewResponse(org_name=org.name)


@router.post(
    "/accept",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def accept_invitation(
    body: InvitationAcceptRequest,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> TokenResponse:
    token_hash = hash_token(body.token)
    now = datetime.now(UTC)

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
    if result.rowcount == 0:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid, expired, or already used invitation",
        )

    inv_result = await db.execute(
        select(Invitation).where(Invitation.token_hash == token_hash)
    )
    inv = inv_result.scalar_one()

    user = User(
        org_id=inv.org_id,
        email_hash=inv.email_hash,
        display_name=body.display_name.strip(),
        role=inv.invited_role,
        password_hash=hash_password(body.password),
        consent_analytics=False,
        consent_ai_coaching=False,
    )
    db.add(user)
    await db.flush()

    access_token = create_access_token(user.id, user.org_id, user.role.value)
    raw_refresh, refresh_hash = generate_refresh_token()

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)
