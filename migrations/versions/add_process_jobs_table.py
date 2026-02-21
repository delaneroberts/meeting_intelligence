"""Add process_jobs table for persistent job progress

Revision ID: a1b2c3d4e5f6
Revises: 8676192a3a07
Create Date: 2026-02-20

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '8676192a3a07'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'process_jobs',
        sa.Column('job_id', sa.String(length=128), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('progress', sa.Float(), nullable=True),
        sa.Column('message', sa.String(length=256), nullable=True),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('job_id'),
    )


def downgrade():
    op.drop_table('process_jobs')
