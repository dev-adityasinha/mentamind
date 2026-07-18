"""add meditation favorites table and weekly streak fields

Revision ID: 2026_07_18_med_fav_weekly
Revises: 2026_07_18_add_user_ban_fields
Create Date: 2026-07-18 01:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2026_07_18_med_fav_weekly"
down_revision = "2026_07_18_add_user_ban_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Weekly streak columns on the existing stats table.
    op.add_column(
        "meditation_stats",
        sa.Column(
            "weekly_streak",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "meditation_stats",
        sa.Column(
            "longest_weekly_streak",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # Favorites table.
    op.create_table(
        "meditation_favorites",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("track_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["track_id"], ["meditation_tracks.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "track_id", name="uq_meditation_favorite_user_track"
        ),
    )
    op.create_index(
        "ix_meditation_favorites_user_id",
        "meditation_favorites",
        ["user_id"],
    )
    op.create_index(
        "ix_meditation_favorites_track_id",
        "meditation_favorites",
        ["track_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_meditation_favorites_track_id", table_name="meditation_favorites"
    )
    op.drop_index(
        "ix_meditation_favorites_user_id", table_name="meditation_favorites"
    )
    op.drop_table("meditation_favorites")
    op.drop_column("meditation_stats", "longest_weekly_streak")
    op.drop_column("meditation_stats", "weekly_streak")
