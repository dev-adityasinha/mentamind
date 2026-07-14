"""mood_logs, wellness_scores, appointments tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-15

Uses VARCHAR + CHECK constraints. See 0002 for the rationale.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mood_logs",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("org_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("mood_score", sa.SmallInteger(), nullable=False),
        sa.Column("emotion_tags", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("context_encrypted", sa.String(1024), nullable=True),
        sa.Column("input_method", sa.String(16), nullable=False),
        sa.Column(
            "logged_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "mood_score >= 1 AND mood_score <= 5", name="ck_mood_logs_mood_score"
        ),
        sa.CheckConstraint(
            "input_method IN ('tap', 'voice', 'text')",
            name="ck_mood_logs_input_method",
        ),
    )
    op.create_index("ix_mood_logs_user_id", "mood_logs", ["user_id"])
    op.create_index("ix_mood_logs_org_id", "mood_logs", ["org_id"])
    op.create_index(
        "ix_mood_logs_user_logged_at",
        "mood_logs",
        ["user_id", sa.text("logged_at DESC")],
    )

    op.create_table(
        "wellness_scores",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("org_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("score_date", sa.Date(), nullable=False),
        sa.Column("composite_score", sa.SmallInteger(), nullable=False),
        sa.Column("mood_component", sa.SmallInteger(), nullable=False),
        sa.Column("sleep_component", sa.SmallInteger(), nullable=False),
        sa.Column("stress_component", sa.SmallInteger(), nullable=False),
        sa.Column("energy_component", sa.SmallInteger(), nullable=False),
        sa.Column("activity_component", sa.SmallInteger(), nullable=False),
        sa.Column("journaling_component", sa.SmallInteger(), nullable=False),
        sa.Column("burnout_risk_score", sa.SmallInteger(), nullable=True),
        sa.Column("burnout_risk_level", sa.String(16), nullable=True),
        sa.Column("model_version", sa.String(32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "score_date", name="uq_wellness_scores_user_date"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "composite_score >= 0 AND composite_score <= 100",
            name="ck_wellness_scores_composite",
        ),
        sa.CheckConstraint(
            "burnout_risk_score >= 0 AND burnout_risk_score <= 100",
            name="ck_wellness_scores_burnout_risk",
        ),
        sa.CheckConstraint(
            "mood_component >= 0 AND mood_component <= 100",
            name="ck_wellness_scores_mood_component",
        ),
        sa.CheckConstraint(
            "sleep_component >= 0 AND sleep_component <= 100",
            name="ck_wellness_scores_sleep_component",
        ),
        sa.CheckConstraint(
            "stress_component >= 0 AND stress_component <= 100",
            name="ck_wellness_scores_stress_component",
        ),
        sa.CheckConstraint(
            "energy_component >= 0 AND energy_component <= 100",
            name="ck_wellness_scores_energy_component",
        ),
        sa.CheckConstraint(
            "activity_component >= 0 AND activity_component <= 100",
            name="ck_wellness_scores_activity_component",
        ),
        sa.CheckConstraint(
            "journaling_component >= 0 AND journaling_component <= 100",
            name="ck_wellness_scores_journaling_component",
        ),
        sa.CheckConstraint(
            "burnout_risk_level IN ('low', 'moderate', 'high', 'critical')",
            name="ck_wellness_scores_burnout_risk_level",
        ),
    )
    op.create_index("ix_wellness_scores_user_id", "wellness_scores", ["user_id"])
    op.create_index("ix_wellness_scores_org_id", "wellness_scores", ["org_id"])

    op.create_table(
        "appointments",
        sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("org_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("counselor_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("session_type", sa.String(32), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["counselor_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "status IN ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')",
            name="ck_appointments_status",
        ),
        sa.CheckConstraint(
            "session_type IN ('individual', 'group', 'crisis', 'follow_up')",
            name="ck_appointments_session_type",
        ),
    )
    op.create_index("ix_appointments_user_id", "appointments", ["user_id"])
    op.create_index("ix_appointments_org_id", "appointments", ["org_id"])
    op.create_index("ix_appointments_counselor_id", "appointments", ["counselor_id"])
    op.create_index("ix_appointments_scheduled_at", "appointments", ["scheduled_at"])


def downgrade() -> None:
    op.drop_index("ix_appointments_scheduled_at", "appointments")
    op.drop_index("ix_appointments_counselor_id", "appointments")
    op.drop_index("ix_appointments_org_id", "appointments")
    op.drop_index("ix_appointments_user_id", "appointments")
    op.drop_table("appointments")

    op.drop_index("ix_wellness_scores_org_id", "wellness_scores")
    op.drop_index("ix_wellness_scores_user_id", "wellness_scores")
    op.drop_table("wellness_scores")

    op.drop_index("ix_mood_logs_user_logged_at", "mood_logs")
    op.drop_index("ix_mood_logs_org_id", "mood_logs")
    op.drop_index("ix_mood_logs_user_id", "mood_logs")
    op.drop_table("mood_logs")
