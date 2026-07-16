import logging

import resend

from app.settings import settings

logger = logging.getLogger(__name__)

if settings.resend_api_key:
    resend.api_key = settings.resend_api_key


async def send_invitation_email(to_email: str, token: str, role: str) -> None:
    """
    Sends an invitation email using Resend.
    If RESEND_API_KEY is not set, logs the URL instead.
    """
    invite_url = f"{settings.frontend_url.rstrip('/')}/join/{token}"

    if not settings.resend_api_key:
        logger.info(
            f"Email sending skipped (no Resend API key). "
            f"URL for {to_email}: {invite_url}"
        )
        return

    try:
        # In a real app, you would use a verified domain
        # For testing, you can use onboarding@resend.dev
        r = resend.Emails.send(
            {
                "from": "Mentamind <onboarding@resend.dev>",
                "to": to_email,
                "subject": "You have been invited to Mentamind",
                "html": f"""
            <h2>Welcome to Mentamind!</h2>
            <p>You have been invited to join as a <strong>{
                    role.replace("_", " ").title()
                }</strong>.</p>
            <p>Click the link below to accept your invitation:</p>
            <p><a href="{invite_url}">{invite_url}</a></p>
            <p>This link will expire in {settings.invitation_expire_days} days.</p>
            """,
            }
        )
        logger.info(f"Invitation email sent to {to_email}. Resend ID: {r.get('id')}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")


async def send_verification_email(to_email: str, token: str) -> None:
    """Sends an email verification link."""
    verify_url = f"{settings.frontend_url.rstrip('/')}/verify-email/{token}"

    if not settings.resend_api_key:
        logger.info(
            f"Email sending skipped (no Resend API key). "
            f"Verification URL for {to_email}: {verify_url}"
        )
        return

    try:
        r = resend.Emails.send(
            {
                "from": "Mentamind <onboarding@resend.dev>",
                "to": to_email,
                "subject": "Verify your Mentamind email address",
                "html": f"""
            <h2>Welcome to Mentamind!</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="{verify_url}">{verify_url}</a></p>
            <p>This link will expire in 24 hours.</p>
            """,
            }
        )
        logger.info(f"Verification email sent to {to_email}. Resend ID: {r.get('id')}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {to_email}: {e}")


async def send_password_reset_email(to_email: str, token: str) -> None:
    """Sends a password reset link."""
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password/{token}"

    if not settings.resend_api_key:
        logger.info(
            f"Email sending skipped (no Resend API key). "
            f"Reset Password URL for {to_email}: {reset_url}"
        )
        return

    try:
        r = resend.Emails.send(
            {
                "from": "Mentamind <support@resend.dev>",
                "to": to_email,
                "subject": "Reset your Mentamind password",
                "html": f"""
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password.
            Click the link below to set a new one:</p>
            <p><a href="{reset_url}">{reset_url}</a></p>
            <p>This link will expire in 1 hour.
            If you did not request this, please ignore this email.</p>
            """,
            }
        )
        logger.info(
            f"Password reset email sent to {to_email}. Resend ID: {r.get('id')}"
        )
    except Exception as e:
        logger.error(f"Failed to send password reset email to {to_email}: {e}")
