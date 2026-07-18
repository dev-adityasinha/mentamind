"""allow moderator and therapist as invitable roles

Widens the invitations.invited_role check constraint so admins can invite
members as moderator or therapist (previously only employee, manager,
hr_manager, wellness_officer, admin, counselor, student were allowed).

Revision ID: 2026_07_18_inv_roles
Revises: 2026_07_18_med_fav_weekly
Create Date: 2026-07-18 02:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "2026_07_18_inv_roles"
down_revision = "2026_07_18_med_fav_weekly"
branch_labels = None
depends_on = None

_OLD_ROLE_VALUES = (
    "('employee', 'manager', 'hr_manager', 'wellness_officer',"
    " 'admin', 'counselor', 'student')"
)
_NEW_ROLE_VALUES = (
    "('employee', 'manager', 'hr_manager', 'wellness_officer',"
    " 'admin', 'counselor', 'student', 'moderator', 'therapist')"
)
_CONSTRAINT = "ck_invitations_invited_role"


def upgrade() -> None:
    op.drop_constraint(_CONSTRAINT, "invitations", type_="check")
    op.create_check_constraint(
        _CONSTRAINT,
        "invitations",
        f"invited_role IN {_NEW_ROLE_VALUES}",
    )


def downgrade() -> None:
    op.drop_constraint(_CONSTRAINT, "invitations", type_="check")
    op.create_check_constraint(
        _CONSTRAINT,
        "invitations",
        f"invited_role IN {_OLD_ROLE_VALUES}",
    )
