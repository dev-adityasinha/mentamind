"""add assessment bank

Revision ID: 2026_07_15_add_assessment_bank
Revises: 2026_07_15_add_is_verified
Create Date: 2026-07-15 10:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2026_07_15_add_assessment_bank'
down_revision = '2026_07_15_add_is_verified'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('assessment_templates',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('short_id', sa.String(length=32), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('category', sa.String(length=64), nullable=True),
    sa.Column('color', sa.String(length=32), nullable=True),
    sa.Column('max_score', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('scoring_rules', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assessment_templates_short_id'), 'assessment_templates', ['short_id'], unique=True)
    
    op.create_table('assessment_questions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('template_id', sa.UUID(), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.ForeignKeyConstraint(['template_id'], ['assessment_templates.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_assessment_questions_template_id', 'assessment_questions', ['template_id'], unique=False)


def downgrade():
    op.drop_index('ix_assessment_questions_template_id', table_name='assessment_questions')
    op.drop_table('assessment_questions')
    op.drop_index(op.f('ix_assessment_templates_short_id'), table_name='assessment_templates')
    op.drop_table('assessment_templates')
