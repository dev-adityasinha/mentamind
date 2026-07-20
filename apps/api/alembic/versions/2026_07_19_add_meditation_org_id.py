"""Add org_id to meditation_tracks for per-organization tracks

Adds a nullable org_id to meditation_tracks. NULL = a global/shared track
(seeded CC0 audio) visible to every organization; a set value = a track
uploaded by that organization, private to it. Existing rows keep org_id NULL,
so the current library stays visible to everyone.

Revision ID: 2026_07_19_med_org
Revises: 2026_07_19_user_role
Create Date: 2026-07-19 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "2026_07_19_med_org"
down_revision = "2026_07_19_user_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "meditation_tracks",
        sa.Column("org_id", sa.Uuid(), nullable=True),
    )
    op.create_index("ix_meditation_tracks_org_id", "meditation_tracks", ["org_id"])
    op.create_foreign_key(
        "fk_meditation_tracks_org_id_organizations",
        "meditation_tracks",
        "organizations",
        ["org_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_meditation_tracks_org_id_organizations",
        "meditation_tracks",
        type_="foreignkey",
    )
    op.drop_index("ix_meditation_tracks_org_id", table_name="meditation_tracks")
    op.drop_column("meditation_tracks", "org_id")
