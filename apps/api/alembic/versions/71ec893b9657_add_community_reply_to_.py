"""Add community_reply to NotificationCategory

Revision ID: 71ec893b9657
Revises: d7c0f3dca8bb
Create Date: 2026-07-14 18:54:15.540696

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '71ec893b9657'
down_revision: Union[str, None] = 'd7c0f3dca8bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute('ALTER TABLE notification_events DROP CONSTRAINT ck_notification_events_category')
    op.execute(
        """
        ALTER TABLE notification_events ADD CONSTRAINT ck_notification_events_category CHECK (
            category IN ('checkin_reminder', 'burnout_alert', 'appointment_reminder', 'wellness_tip', 'consent_update', 'journal_prompt', 'coach_session', 'streak_milestone', 'community_reply')
        )
        """
    )

def downgrade() -> None:
    op.execute('ALTER TABLE notification_events DROP CONSTRAINT ck_notification_events_category')
    op.execute(
        """
        ALTER TABLE notification_events ADD CONSTRAINT ck_notification_events_category CHECK (
            category IN ('checkin_reminder', 'burnout_alert', 'appointment_reminder', 'wellness_tip', 'consent_update', 'journal_prompt', 'coach_session', 'streak_milestone')
        )
        """
    )
