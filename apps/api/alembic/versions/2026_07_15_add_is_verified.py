"""add is_verified to user

Revision ID: 2026_07_15_add_is_verified
Revises: 71ec893b9657
Create Date: 2026-07-15 10:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2026_07_15_add_is_verified'
down_revision = '71ec893b9657'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('users', 'is_verified')
