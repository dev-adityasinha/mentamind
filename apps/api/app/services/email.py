import logging
from email.message import EmailMessage

import aiosmtplib

from app.settings import settings

logger = logging.getLogger(__name__)


async def _send_email(to_email: str, subject: str, html: str) -> None:
    message = EmailMessage()
    message["From"] = f"Mentamind <{settings.smtp_from_email}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content("This email requires an HTML-capable client to view.")
    message.add_alternative(html, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username,
        password=settings.smtp_password,
        start_tls=True,
    )


async def send_invitation_email(to_email: str, token: str, role: str) -> None:
    """
    Sends an invitation email via SMTP.
    If SMTP credentials are not set, logs the URL instead.
    """
    invite_url = f"{settings.frontend_url.rstrip('/')}/join/{token}"

    if not settings.smtp_username or not settings.smtp_password:
        logger.info(
            f"Email sending skipped (no SMTP credentials). "
            f"URL for {to_email}: {invite_url}"
        )
        return

    try:
        await _send_email(
            to_email,
            "You have been invited to Mentamind",
            f"""
            <h2>Welcome to Mentamind!</h2>
            <p>You have been invited to join as a <strong>{
                role.replace("_", " ").title()
            }</strong>.</p>
            <p>Click the link below to accept your invitation:</p>
            <p><a href="{invite_url}">{invite_url}</a></p>
            <p>This link will expire in {settings.invitation_expire_days} days.</p>
            """,
        )
        logger.info(f"Invitation email sent to {to_email}.")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")


async def send_verification_email(to_email: str, token: str) -> None:
    """Sends an email verification link."""
    verify_url = f"{settings.frontend_url.rstrip('/')}/verify-email/{token}"

    if not settings.smtp_username or not settings.smtp_password:
        logger.info(
            f"Email sending skipped (no SMTP credentials). "
            f"Verification URL for {to_email}: {verify_url}"
        )
        return

    try:
        await _send_email(
            to_email,
            "Verify your Mentamind email address",
            f"""
            <h2>Welcome to Mentamind!</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="{verify_url}">{verify_url}</a></p>
            <p>This link will expire in 24 hours.</p>
            """,
        )
        logger.info(f"Verification email sent to {to_email}.")
    except Exception as e:
        logger.error(f"Failed to send verification email to {to_email}: {e}")


async def send_password_reset_email(to_email: str, token: str) -> None:
    """Sends a password reset link."""
    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password/{token}"

    if not settings.smtp_username or not settings.smtp_password:
        logger.info(
            f"Email sending skipped (no SMTP credentials). "
            f"Reset Password URL for {to_email}: {reset_url}"
        )
        return

    try:
        await _send_email(
            to_email,
            "Reset your Mentamind password",
            f"""
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password.
            Click the link below to set a new one:</p>
            <p><a href="{reset_url}">{reset_url}</a></p>
            <p>This link will expire in 1 hour.
            If you did not request this, please ignore this email.</p>
            """,
        )
        logger.info(f"Password reset email sent to {to_email}.")
    except Exception as e:
        logger.error(f"Failed to send password reset email to {to_email}: {e}")
