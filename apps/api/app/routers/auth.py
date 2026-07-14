import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user, require_ghost_user
from app.models.organization import Organization
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.schemas.auth import (
    ConsentUpdateRequest,
    GhostMergeRequest,
    LoginRequest,
    RefreshRequest,
    RegisterOrganizationRequest,
    SpawnGhostResponse,
    TokenResponse,
)
from app.services.auth_service import (
    create_access_token,
    generate_refresh_token,
    hash_email,
    hash_password,
    hash_token,
    verify_password,
)
from app.settings import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    result = await db.execute(
        select(User).where(User.email_hash == hash_email(body.email))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    access_token = create_access_token(user.id, user.org_id, user.role.value)
    raw_refresh, refresh_hash = generate_refresh_token()

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=datetime.now(UTC)
            + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    token_hash = hash_token(body.refresh_token)
    now = datetime.now(UTC)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.is_revoked == False,  # noqa: E712
            RefreshToken.expires_at > now,
        )
    )
    stored = result.scalar_one_or_none()
    if not stored:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token"
        )

    stored.is_revoked = True

    user = await db.get(User, stored.user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    access_token = create_access_token(user.id, user.org_id, user.role.value)
    raw_refresh, refresh_hash = generate_refresh_token()

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=datetime.now(UTC)
            + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


@router.post(
    "/register-organization",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_organization(
    body: RegisterOrganizationRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    # Check if organization name already exists
    existing_org = await db.execute(
        select(Organization).where(Organization.name == body.org_name.strip())
    )
    if existing_org.scalar_one_or_none():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "An organization with this name already exists. "
            "Please choose a different name.",
        )

    email_hash = hash_email(body.email)
    existing = await db.execute(select(User).where(User.email_hash == email_hash))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    org = Organization(
        name=body.org_name.strip(),
        data_residency_region=body.data_residency_region,
    )
    db.add(org)
    await db.flush()

    user = User(
        org_id=org.id,
        email_hash=email_hash,
        display_name=body.display_name.strip(),
        role=UserRole.ADMIN,
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
            expires_at=datetime.now(UTC)
            + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    token_hash = hash_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored = result.scalar_one_or_none()
    if stored:
        stored.is_revoked = True
        await db.commit()


@router.post(
    "/spawn-ghost",
    response_model=SpawnGhostResponse,
    status_code=status.HTTP_201_CREATED,
)
async def spawn_ghost_user(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SpawnGhostResponse:
    if current_user.is_anonymous:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "A ghost user cannot spawn another ghost"
        )

    ghost_session_id = str(uuid.uuid4())

    ghost_user = User(
        is_anonymous=True,
        org_id=current_user.org_id,
        display_name="Anonymous Guest",
        role=UserRole.ANONYMOUS,
        consent_analytics=False,
        consent_ai_coaching=False,
        anonymous_session_id=ghost_session_id,
    )
    db.add(ghost_user)
    await db.flush()

    access_token = create_access_token(
        ghost_user.id, ghost_user.org_id, ghost_user.role.value
    )
    raw_refresh, refresh_hash = generate_refresh_token()

    db.add(
        RefreshToken(
            user_id=ghost_user.id,
            token_hash=refresh_hash,
            expires_at=datetime.now(UTC)
            + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()

    return SpawnGhostResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        ghost_session_id=ghost_session_id,
    )


@router.post("/ghost/merge", response_model=TokenResponse)
async def ghost_merge(
    body: GhostMergeRequest,
    current_user: Annotated[User, require_ghost_user()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Merge a ghost session into a new real user account.

    Requires a valid ghost JWT (obtained via /auth/spawn-ghost) to prove
    the caller controls the ghost session.  The anonymous_session_id that
    was assigned at spawn time is used automatically for data reattachment;
    clients do not supply it because it is stored server-side on the ghost
    user record.
    """
    if current_user.anonymous_session_id is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "No anonymous session: ghost was not spawned via /auth/spawn-ghost",
        )

    from app.services.ghost_merge import merge_ghost_user

    try:
        return await merge_ghost_user(
            db=db,
            ghost_user=current_user,
            anonymous_session_id=current_user.anonymous_session_id,
            email=body.email,
            display_name=body.display_name,
            password=body.password,
            role=UserRole.EMPLOYEE,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))


@router.post("/consent", status_code=status.HTTP_204_NO_CONTENT)
async def update_consent(
    body: ConsentUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Update user consent preferences (GDPR Art. 7)."""
    current_user.consent_analytics = body.analytics
    current_user.consent_ai_coaching = body.ai_coaching
    current_user.consent_community = body.community
    current_user.privacy_consent_version = body.version
    await db.commit()


@router.get("/export", status_code=status.HTTP_200_OK)
async def export_user_data(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Export all user data (GDPR Art. 15 - Right of access)."""
    from app.services.data_export import export_user_data

    return await export_user_data(db, current_user.id)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete user account and anonymize personal data (GDPR Art. 17)."""
    current_user.deleted_at = datetime.now(UTC)
    current_user.email_hash = None
    current_user.password_hash = None
    current_user.display_name = "Deleted Account"
    current_user.saml_subject_id = None
    current_user.saml_attributes = {}
    current_user.encryption_key_id = None
    current_user.anonymous_session_id = None
    await db.commit()
