"""Add 'user' role and make it invitable

Widens two CHECK constraints so the new UserRole.USER ('user') value is valid:
  - ck_users_role            on users.role
  - ck_invitations_invited_role on invitations.invited_role

The role column is a VARCHAR guarded by a CHECK constraint (see migration 0004
for the rationale), so a new enum value requires updating those constraints or
inserts/invitations with role 'user' will be rejected.

Revision ID: 2026_07_19_user_role
Revises: 2026_07_18_username
Create Date: 2026-07-19 00:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "2026_07_19_user_role"
down_revision = "2026_07_18_username"
branch_labels = None
depends_on = None

# --- users.role ---
_USERS_CONSTRAINT = "ck_users_role"
_USERS_WITHOUT_USER = (
    "('anonymous', 'employee', 'manager', 'hr_manager', 'wellness_officer',"
    " 'admin', 'counselor', 'student', 'moderator', 'therapist')"
)
_USERS_WITH_USER = (
    "('anonymous', 'user', 'employee', 'manager', 'hr_manager',"
    " 'wellness_officer', 'admin', 'counselor', 'student', 'moderator',"
    " 'therapist')"
)

# --- invitations.invited_role ---
_INV_CONSTRAINT = "ck_invitations_invited_role"
_INV_WITHOUT_USER = (
    "('employee', 'manager', 'hr_manager', 'wellness_officer',"
    " 'admin', 'counselor', 'student', 'moderator', 'therapist')"
)
_INV_WITH_USER = (
    "('user', 'employee', 'manager', 'hr_manager', 'wellness_officer',"
    " 'admin', 'counselor', 'student', 'moderator', 'therapist')"
)


def upgrade() -> None:
    op.execute(f"ALTER TABLE users DROP CONSTRAINT IF EXISTS {_USERS_CONSTRAINT}")
    op.execute(
        f"ALTER TABLE users ADD CONSTRAINT {_USERS_CONSTRAINT} "
        f"CHECK (role IN {_USERS_WITH_USER})"
    )

    op.execute(f"ALTER TABLE invitations DROP CONSTRAINT IF EXISTS {_INV_CONSTRAINT}")
    op.execute(
        f"ALTER TABLE invitations ADD CONSTRAINT {_INV_CONSTRAINT} "
        f"CHECK (invited_role IN {_INV_WITH_USER})"
    )


def downgrade() -> None:
    op.execute(f"ALTER TABLE users DROP CONSTRAINT IF EXISTS {_USERS_CONSTRAINT}")
    op.execute(
        f"ALTER TABLE users ADD CONSTRAINT {_USERS_CONSTRAINT} "
        f"CHECK (role IN {_USERS_WITHOUT_USER})"
    )

    op.execute(f"ALTER TABLE invitations DROP CONSTRAINT IF EXISTS {_INV_CONSTRAINT}")
    op.execute(
        f"ALTER TABLE invitations ADD CONSTRAINT {_INV_CONSTRAINT} "
        f"CHECK (invited_role IN {_INV_WITH_USER})"
    )
