"""SAML 2.0 Single Sign-On routes.

Requires python3-saml and SAML settings configured in .env.
Gracefully returns 501 Not Implemented when not configured.
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.services.auth_service import (
    create_access_token,
    generate_refresh_token,
    hash_email,
)
from app.settings import settings

router = APIRouter(prefix="/auth/saml", tags=["saml"])


def _saml_configured() -> bool:
    return bool(settings.saml_idp_sso_url and settings.saml_idp_x509_cert)


@router.get("/login")
async def saml_login():
    """Redirect the user to the IdP SAML login page."""
    if not _saml_configured():
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "SAML not configured")

    try:
        from onelogin.saml2.auth import OneLogin_Saml2_Auth

        req = {
            "http_host": settings.saml_sp_entity_id,
            "script_name": "/auth/saml/acs",
            "get_data": {},
            "post_data": {},
        }
        auth = OneLogin_Saml2_Auth(req, _get_saml_settings())
        return RedirectResponse(auth.login())
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))


@router.post("/acs", response_model=TokenResponse)
async def saml_acs(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """SAML Assertion Consumer Service — IdP redirects here after login."""
    if not _saml_configured():
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "SAML not configured")

    try:
        from onelogin.saml2.auth import OneLogin_Saml2_Auth

        form = await request.form()
        req = {
            "http_host": settings.saml_sp_entity_id,
            "script_name": "/auth/saml/acs",
            "get_data": {},
            "post_data": dict(form),
        }
        auth = OneLogin_Saml2_Auth(req, _get_saml_settings())
        auth.process_response()

        if auth.get_errors():
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                f"SAML auth failed: {auth.get_errors()}",
            )

        if not auth.is_authenticated():
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "SAML auth failed")

        attributes = auth.get_attributes()
        name_id = auth.get_nameid()
        email = (attributes.get("email", [None]) or [name_id])[0]
        email_hash = hash_email(email)

        result = await db.execute(select(User).where(User.saml_subject_id == name_id))
        user = result.scalar_one_or_none()

        if not user:
            result = await db.execute(select(User).where(User.email_hash == email_hash))
            user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "No account found. Contact your admin for an invitation.",
            )

        user.saml_subject_id = name_id
        user.saml_attributes = attributes
        user.last_active_at = datetime.now(UTC)
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

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))


@router.get("/metadata")
async def saml_metadata():
    """Return SAML SP metadata XML for IdP configuration."""
    if not _saml_configured():
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "SAML not configured")

    try:
        from onelogin.saml2.settings import OneLogin_Saml2_Settings

        saml_settings = OneLogin_Saml2_Settings(
            _get_saml_settings(), sp_validation_only=True
        )
        metadata = saml_settings.get_sp_metadata()
        errors = saml_settings.validate_metadata(metadata)
        if errors:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                f"Invalid SP metadata: {errors}",
            )
        from fastapi.responses import Response

        return Response(
            content=metadata,
            media_type="application/xml",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))


def _get_saml_settings() -> dict:
    """Build the python3-saml settings dict from our Settings model."""
    return {
        "strict": settings.saml_strict,
        "debug": settings.saml_debug,
        "sp": {
            "entityId": settings.saml_sp_entity_id,
            "assertionConsumerService": {
                "url": settings.saml_sp_acs_url,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
            },
            "singleLogoutService": {
                "url": "",
                "binding": "",
            },
            "NameIDFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        },
        "idp": {
            "entityId": settings.saml_idp_entity_id,
            "singleSignOnService": {
                "url": settings.saml_idp_sso_url,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            },
            "x509cert": settings.saml_idp_x509_cert,
        },
    }
