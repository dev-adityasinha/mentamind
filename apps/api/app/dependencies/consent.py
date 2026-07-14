from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_user
from app.models.consent_record import ConsentType
from app.models.user import User


def _check_onboarding(user: User) -> User:
    """Pure check; raises 403 if onboarding is not yet complete."""
    if user.onboarding_completed_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Onboarding must be completed before accessing this resource",
        )
    return user


def _check_consent(user: User, *consent_types: ConsentType) -> User:
    """Pure check; raises 403 listing any consent types not yet granted."""
    missing = []
    for ct in consent_types:
        if ct == ConsentType.ANALYTICS and not user.consent_analytics:
            missing.append(ct.value)
        elif ct == ConsentType.AI_COACHING and not user.consent_ai_coaching:
            missing.append(ct.value)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Consent required: {', '.join(missing)}",
        )
    return user


def require_onboarding_complete():
    """Dependency factory: block the route until onboarding is complete."""

    async def _dep(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        return _check_onboarding(current_user)

    return Depends(_dep)


def require_consent(*consent_types: ConsentType):
    """Dependency factory: block the route if any listed consent is not granted.

    Also enforces onboarding completion, since consent state is only meaningful
    after the user has explicitly reviewed and submitted their choices.
    """

    async def _dep(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        _check_onboarding(current_user)
        return _check_consent(current_user, *consent_types)

    return Depends(_dep)
