"""add mood energy and stress scores

Revision ID: 2026_07_14_add_energy_stress
Revises: 2026_07_14_add_profile_fields
Create Date: 2026-07-14 13:58:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '2026_07_14_add_energy_stress'
down_revision = '2026_07_14_add_profile_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('mood_logs', sa.Column('energy_score', sa.SmallInteger(), nullable=True))
    op.add_column('mood_logs', sa.Column('stress_score', sa.SmallInteger(), nullable=True))
    op.create_check_constraint('ck_mood_logs_energy_score', 'mood_logs', 'energy_score >= 1 AND energy_score <= 5')
    op.create_check_constraint('ck_mood_logs_stress_score', 'mood_logs', 'stress_score >= 1 AND stress_score <= 5')


def downgrade() -> None:
    op.drop_constraint('ck_mood_logs_stress_score', 'mood_logs', type_='check')
    op.drop_constraint('ck_mood_logs_energy_score', 'mood_logs', type_='check')
    op.drop_column('mood_logs', 'stress_score')
    op.drop_column('mood_logs', 'energy_score')
