"""add moderator and therapist roles

Revision ID: 2026_07_14_add_new_roles
Revises: 45ccfa8f8006
Create Date: 2026-07-14 13:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '2026_07_14_add_new_roles'
down_revision = '45ccfa8f8006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role")
    op.execute("ALTER TABLE users ADD CONSTRAINT ck_users_role CHECK (role IN ('anonymous', 'employee', 'manager', 'hr_manager', 'wellness_officer', 'admin', 'counselor', 'student', 'moderator', 'therapist'))")

def downgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role")
    op.execute("ALTER TABLE users ADD CONSTRAINT ck_users_role CHECK (role IN ('anonymous', 'employee', 'manager', 'hr_manager', 'wellness_officer', 'admin', 'counselor', 'student'))")
