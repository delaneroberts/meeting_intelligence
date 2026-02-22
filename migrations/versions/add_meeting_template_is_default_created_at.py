"""Add is_default and created_at to meeting_templates; unique name

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-21

"""
from alembic import op
import sqlalchemy as sa


revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    # SQLite: get existing columns
    r = conn.execute(sa.text("PRAGMA table_info(meeting_templates)"))
    cols = {row[1] for row in r}
    if 'is_default' not in cols:
        op.add_column('meeting_templates', sa.Column('is_default', sa.Boolean(), nullable=True, server_default=sa.text('0')))
        conn.execute(sa.text("UPDATE meeting_templates SET is_default = 0 WHERE is_default IS NULL"))
    if 'created_at' not in cols:
        op.add_column('meeting_templates', sa.Column('created_at', sa.DateTime(), nullable=True))
        conn.execute(sa.text("UPDATE meeting_templates SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
    # Unique index on name (ignore if already exists)
    try:
        op.create_index('ix_meeting_templates_name', 'meeting_templates', ['name'], unique=True)
    except Exception:
        pass


def downgrade():
    try:
        op.drop_index('ix_meeting_templates_name', table_name='meeting_templates')
    except Exception:
        pass
    conn = op.get_bind()
    r = conn.execute(sa.text("PRAGMA table_info(meeting_templates)"))
    cols = {row[1] for row in r}
    if 'created_at' in cols:
        op.drop_column('meeting_templates', 'created_at')
    if 'is_default' in cols:
        op.drop_column('meeting_templates', 'is_default')
