"""add moderator and therapist roles

Revision ID: 2026_07_14_add_new_roles
Revises: fdb6aab16281
Create Date: 2026-07-14 13:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '2026_07_14_add_new_roles'
down_revision = 'fdb6aab16281'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres ENUM ALTER TYPE must run outside of a transaction block
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'moderator'")
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'therapist'")


def downgrade() -> None:
    # Removing a value from a Postgres ENUM is not supported directly.
    pass
