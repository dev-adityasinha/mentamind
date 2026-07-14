"""add user profile fields

Revision ID: 2026_07_14_add_profile_fields
Revises: 2026_07_14_add_new_roles
Create Date: 2026-07-14 13:05:00.000000

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2026_07_14_add_profile_fields'
down_revision = '2026_07_14_add_new_roles'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user_settings', sa.Column('age', sa.Integer(), nullable=True))
    op.add_column('user_settings', sa.Column('gender', sa.String(length=50), nullable=True))
    op.add_column('user_settings', sa.Column('country', sa.String(length=2), nullable=True))
    op.add_column('user_settings', sa.Column('avatar_url', sa.String(length=1024), nullable=True))
    op.add_column('user_settings', sa.Column('mental_health_goals', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))


def downgrade() -> None:
    op.drop_column('user_settings', 'mental_health_goals')
    op.drop_column('user_settings', 'avatar_url')
    op.drop_column('user_settings', 'country')
    op.drop_column('user_settings', 'gender')
    op.drop_column('user_settings', 'age')
