"""update burnout risk

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-18 01:11:20.283972

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # We must update the existing rows first so they don't violate the new constraint
    op.execute(
        "UPDATE wellness_scores SET burnout_risk_level = 'green' "
        "WHERE burnout_risk_level = 'low'"
    )
    op.execute(
        "UPDATE wellness_scores SET burnout_risk_level = 'amber' "
        "WHERE burnout_risk_level = 'moderate'"
    )
    op.execute(
        "UPDATE wellness_scores SET burnout_risk_level = 'red' "
        "WHERE burnout_risk_level IN ('high', 'critical')"
    )

    # Drop the old constraint
    op.drop_constraint(
        "ck_wellness_scores_burnout_risk_level", "wellness_scores", type_="check"
    )

    # Add the new constraint
    op.create_check_constraint(
        "ck_wellness_scores_burnout_risk_level",
        "wellness_scores",
        "burnout_risk_level IN ('green', 'amber', 'red')",
    )


def downgrade() -> None:
    # Revert rows back
    op.execute(
        "UPDATE wellness_scores SET burnout_risk_level = 'low' "
        "WHERE burnout_risk_level = 'green'"
    )
    op.execute(
        "UPDATE wellness_scores SET burnout_risk_level = 'moderate' "
        "WHERE burnout_risk_level = 'amber'"
    )
    op.execute(
        "UPDATE wellness_scores SET burnout_risk_level = 'high' "
        "WHERE burnout_risk_level = 'red'"
    )

    # Drop the new constraint
    op.drop_constraint(
        "ck_wellness_scores_burnout_risk_level", "wellness_scores", type_="check"
    )

    # Add back the old constraint
    op.create_check_constraint(
        "ck_wellness_scores_burnout_risk_level",
        "wellness_scores",
        "burnout_risk_level IN ('low', 'moderate', 'high', 'critical')",
    )
