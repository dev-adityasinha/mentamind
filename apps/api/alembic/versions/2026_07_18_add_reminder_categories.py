"""Add meditation_reminder and assessment_reminder notification categories

Widens the notification_events.category CHECK constraint so the reminder
scheduler can emit meditation and assessment reminders.

Revision ID: 2026_07_18_reminder_cats
Revises: 2026_07_18_inv_roles
Create Date: 2026-07-18 03:00:00.000000

"""
from alembic import op

revision = "2026_07_18_reminder_cats"
down_revision = "2026_07_18_inv_roles"
branch_labels = None
depends_on = None

_NEW = (
    "'checkin_reminder', 'burnout_alert', 'appointment_reminder', "
    "'wellness_tip', 'consent_update', 'journal_prompt', 'coach_session', "
    "'streak_milestone', 'community_reply', 'meditation_reminder', "
    "'assessment_reminder'"
)
_OLD = (
    "'checkin_reminder', 'burnout_alert', 'appointment_reminder', "
    "'wellness_tip', 'consent_update', 'journal_prompt', 'coach_session', "
    "'streak_milestone', 'community_reply'"
)


def upgrade() -> None:
    op.execute(
        "ALTER TABLE notification_events "
        "DROP CONSTRAINT ck_notification_events_category"
    )
    op.execute(
        "ALTER TABLE notification_events ADD CONSTRAINT "
        f"ck_notification_events_category CHECK (category IN ({_NEW}))"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE notification_events "
        "DROP CONSTRAINT ck_notification_events_category"
    )
    op.execute(
        "ALTER TABLE notification_events ADD CONSTRAINT "
        f"ck_notification_events_category CHECK (category IN ({_OLD}))"
    )
