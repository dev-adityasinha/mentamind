from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.consent import require_onboarding_complete
from app.models.consent_record import (
    CONSENT_DOCUMENT_VERSION,
    ConsentAction,
    ConsentRecord,
    ConsentType,
)
from app.models.user import User
from app.schemas.consent import (
    ConsentRecordResponse,
    ConsentUpdateRequest,
    OnboardingCompleteRequest,
)
from app.schemas.user import UserResponse

router = APIRouter(tags=["onboarding"])


def _build_consent_record(
    user: User,
    consent_type: ConsentType,
    granted: bool,
) -> ConsentRecord:
    return ConsentRecord(
        user_id=user.id,
        org_id=user.org_id,
        consent_type=consent_type,
        action=ConsentAction.GRANTED if granted else ConsentAction.WITHDRAWN,
        version=CONSENT_DOCUMENT_VERSION,
        granted_at=datetime.now(UTC),
    )


@router.post("/onboarding/complete", response_model=UserResponse)
async def complete_onboarding(
    body: OnboardingCompleteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Set consent choices and mark onboarding done. Can only be called once."""
    if current_user.onboarding_completed_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Onboarding already completed",
        )

    current_user.consent_analytics = body.consent_analytics
    current_user.consent_ai_coaching = body.consent_ai_coaching
    current_user.onboarding_completed_at = datetime.now(UTC)

    if body.display_name is not None:
        current_user.display_name = body.display_name

    db.add(
        _build_consent_record(
            current_user, ConsentType.ANALYTICS, body.consent_analytics
        )
    )
    db.add(
        _build_consent_record(
            current_user, ConsentType.AI_COACHING, body.consent_ai_coaching
        )
    )

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.patch("/me/consent", response_model=UserResponse)
async def update_consent(
    body: ConsentUpdateRequest,
    current_user: Annotated[User, require_onboarding_complete()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Update consent preferences. Only writes a record when the value changes."""
    if (
        body.consent_analytics is not None
        and body.consent_analytics != current_user.consent_analytics
    ):
        current_user.consent_analytics = body.consent_analytics
        db.add(
            _build_consent_record(
                current_user, ConsentType.ANALYTICS, body.consent_analytics
            )
        )

    if (
        body.consent_ai_coaching is not None
        and body.consent_ai_coaching != current_user.consent_ai_coaching
    ):
        current_user.consent_ai_coaching = body.consent_ai_coaching
        db.add(
            _build_consent_record(
                current_user, ConsentType.AI_COACHING, body.consent_ai_coaching
            )
        )

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.get("/me/consent-records", response_model=list[ConsentRecordResponse])
async def list_consent_records(
    current_user: Annotated[User, require_onboarding_complete()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ConsentRecord]:
    """Return all consent events for the current user, most recent first."""
    result = await db.execute(
        select(ConsentRecord)
        .where(
            ConsentRecord.user_id == current_user.id,
            ConsentRecord.org_id == current_user.org_id,
        )
        .order_by(ConsentRecord.granted_at.desc())
    )
    return list(result.scalars().all())
