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
                role.replace('_', ' ').title()
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
