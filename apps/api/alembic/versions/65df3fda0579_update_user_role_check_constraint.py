"""update user role check constraint

Revision ID: 65df3fda0579
Revises: eabaa637eb84
Create Date: 2026-06-19 22:08:38.284904

"""
from collections.abc import Sequence

from alembic import op

revision: str = '65df3fda0579'
down_revision: str | None = 'eabaa637eb84'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role")
    op.execute("ALTER TABLE users ADD CONSTRAINT ck_users_role CHECK (role IN ('anonymous', 'employee', 'manager', 'hr_manager', 'wellness_officer', 'admin', 'counselor', 'student'))")

def downgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role")
    op.execute("ALTER TABLE users ADD CONSTRAINT ck_users_role CHECK (role IN ('employee', 'manager', 'hr_manager', 'wellness_officer', 'admin', 'counselor', 'student'))")
